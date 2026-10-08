import { readFile, rename, writeFile } from 'node:fs/promises';

const DAILY_PROMPTS = [
  { question: 'I have keys but no locks, and a space but no room. What am I?', answer: 'keyboard' },
  { question: 'The more you take from me, the larger I get. What am I?', answer: 'hole' },
  { question: 'I can be cracked, made, told, and played. What am I?', answer: 'joke' },
  { question: 'What gets wetter the more it dries?', answer: 'towel' },
  { question: 'I have a face and two hands, but no arms or legs. What am I?', answer: 'clock' },
];
const POLLS = [
  { id: 'next-expression', title: 'WHAT SHOULD A.R.C.H.I.E. LEARN NEXT?', options: [
    { id: 'side-eye', label: 'A devastating side-eye' },
    { id: 'victory-dance', label: 'A tiny victory dance' },
    { id: 'dramatic-sigh', label: 'A dramatic system sigh' },
  ] },
];

const emptyStore = () => ({ votes: {}, answers: {}, predictions: {}, points: {}, graduations: {} });
const utcDate = () => new Date().toISOString().slice(0, 10);
const dayNumber = (date) => Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
const promptForToday = () => {
  const date = utcDate();
  return { id: date, ...DAILY_PROMPTS[((dayNumber(date) % DAILY_PROMPTS.length) + DAILY_PROMPTS.length) % DAILY_PROMPTS.length] };
};
const validClientId = (id) => typeof id === 'string' && /^[a-zA-Z0-9_-]{16,80}$/.test(id);
const cleanText = (text, max = 180) => typeof text === 'string' ? text.trim().replace(/\s+/g, ' ').slice(0, max) : '';
const rankName = (score) => score >= 100 ? 'TRUSTY' : score >= 20 ? 'INMATE' : 'NEW ARRIVAL';

export function createCommunityStore(filePath) {
  let store = emptyStore();
  let writeQueue = Promise.resolve();
  const rateLimits = new Map();

  async function load() {
    try { store = { ...emptyStore(), ...JSON.parse(await readFile(filePath, 'utf8')) }; }
    catch (error) { if (error.code !== 'ENOENT') console.warn('Community data could not be loaded:', error.message); }
  }
  const ready = load();

  function persist() {
    const operation = writeQueue.then(async () => {
      const tmp = `${filePath}.tmp`;
      await writeFile(tmp, `${JSON.stringify(store)}\n`);
      await rename(tmp, filePath);
    });
    writeQueue = operation.catch((error) => console.error('Community data could not be saved:', error.message));
    return operation;
  }

  function limit(key, max, windowMs) {
    const now = Date.now();
    const values = (rateLimits.get(key) || []).filter((at) => now - at < windowMs);
    if (values.length >= max) return false;
    values.push(now);
    rateLimits.set(key, values);
    return true;
  }

  async function snapshot({ mint = '', graduated = false } = {}) {
    await ready;
    const prompt = promptForToday();
    const poll = POLLS[0];
    const pollVotes = store.votes[poll.id] || {};
    const counts = poll.options.map((option) => ({ ...option, count: Object.values(pollVotes).filter((vote) => vote === option.id).length }));
    const answers = (store.answers[prompt.id] || []).slice(-8).reverse().map(({ answer, correct, at }) => ({ answer, correct, at }));
    const mintGraduated = graduated || Boolean(store.graduations[mint]);
    const players = Object.entries(store.points).map(([clientId, points]) => ({
      name: `INMATE #${clientId.slice(-4).toUpperCase()}`,
      points,
      rank: rankName(points),
    })).sort((a, b) => b.points - a.points).slice(0, 10);
    const predictions = Object.values(store.predictions[mint] || {});
    return {
      interrogation: { id: prompt.id, question: prompt.question, topResponses: answers },
      poll: { id: poll.id, title: poll.title, options: counts, total: Object.keys(pollVotes).length },
      prediction: {
        available: Boolean(mint),
        graduated: mintGraduated,
        myPredictionAllowed: Boolean(mint) && !mintGraduated,
        total: predictions.length,
        leaderboard: players,
        durations: [1, 6, 24, 72],
      },
    };
  }

  async function vote({ clientId, pollId, optionId }, rateKey) {
    await ready;
    if (!validClientId(clientId)) return { status: 400, error: 'A browser session ID is required.' };
    if (!limit(`vote:${rateKey}`, 12, 60_000)) return { status: 429, error: 'Too many votes. Try again later.' };
    const poll = POLLS.find((item) => item.id === pollId);
    if (!poll || !poll.options.some((option) => option.id === optionId)) return { status: 400, error: 'Choose an available poll option.' };
    const votes = store.votes[poll.id] ||= {};
    if (votes[clientId]) return { status: 409, error: 'This browser has already voted in this poll.' };
    votes[clientId] = optionId;
    try { await persist(); }
    catch { delete votes[clientId]; return { status: 503, error: 'The vote could not be saved. Please try again.' }; }
    return { status: 200, ok: true };
  }

  async function answer({ clientId, promptId, answer }, rateKey) {
    await ready;
    if (!validClientId(clientId)) return { status: 400, error: 'A browser session ID is required.' };
    if (!limit(`answer:${rateKey}`, 8, 60_000)) return { status: 429, error: 'Too many submissions. Try again later.' };
    const prompt = promptForToday();
    const response = cleanText(answer);
    if (promptId !== prompt.id || response.length < 1) return { status: 400, error: 'Enter an answer to today’s question.' };
    const responses = store.answers[prompt.id] ||= [];
    if (responses.some((item) => item.clientId === clientId)) return { status: 409, error: 'This browser already answered today.' };
    const correct = response.toLowerCase().replace(/[^a-z0-9]/g, '') === prompt.answer;
    const pointsEarned = correct ? 10 : 0;
    const entry = { clientId, answer: response, correct, pointsEarned, at: Date.now() };
    const previousPoints = store.points[clientId] || 0;
    responses.push(entry);
    if (correct) store.points[clientId] = previousPoints + pointsEarned;
    try { await persist(); }
    catch {
      const index = responses.indexOf(entry);
      if (index >= 0) responses.splice(index, 1);
      if (correct) {
        if (previousPoints) store.points[clientId] = previousPoints;
        else delete store.points[clientId];
      }
      return { status: 503, error: 'The answer could not be saved. Please try again.' };
    }
    return { status: 200, ok: true, correct, pointsEarned };
  }

  async function predict({ clientId, mint, hours }, { graduated, rateKey }) {
    await ready;
    if (!validClientId(clientId)) return { status: 400, error: 'A browser session ID is required.' };
    if (!mint) return { status: 409, error: 'Set a contract address before making an escape prediction.' };
    if (graduated || store.graduations[mint]) return { status: 409, error: 'Migration is verified; predictions are closed.' };
    if (!limit(`prediction:${rateKey}`, 8, 60_000)) return { status: 429, error: 'Too many predictions. Try again later.' };
    const duration = Number(hours);
    if (![1, 6, 24, 72].includes(duration)) return { status: 400, error: 'Choose one of the listed time windows.' };
    const predictions = store.predictions[mint] ||= {};
    if (predictions[clientId]) return { status: 409, error: 'This browser already predicted for this contract.' };
    const prediction = { clientId, hours: duration, at: Date.now(), points: 0, resolved: false };
    predictions[clientId] = prediction;
    try { await persist(); }
    catch { delete predictions[clientId]; return { status: 503, error: 'The prediction could not be saved. Please try again.' }; }
    return { status: 200, ok: true, resolved: prediction.resolved, points: prediction.points };
  }

  function resolvePrediction(prediction, graduationAt) {
    const actualHours = Math.max(0, (graduationAt - prediction.at) / 3_600_000);
    const tolerance = Math.max(prediction.hours, 24);
    prediction.points = Math.round(100 * Math.max(0, 1 - Math.abs(actualHours - prediction.hours) / tolerance));
    prediction.resolved = true;
    store.points[prediction.clientId] = (store.points[prediction.clientId] || 0) + prediction.points;
  }

  async function recordGraduation(mint, at = Date.now()) {
    if (!mint) return;
    await ready;
    if (store.graduations[mint]) return;
    store.graduations[mint] = { at };
    for (const prediction of Object.values(store.predictions[mint] || {})) resolvePrediction(prediction, at);
    await persist();
  }

  return { snapshot, vote, answer, predict, recordGraduation };
}
