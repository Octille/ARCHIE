const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function isSolanaAddress(value) {
  if (typeof value !== 'string' || value.length < 32 || value.length > 44) return false;
  let number = 0n;
  for (const char of value) {
    const digit = BASE58.indexOf(char);
    if (digit < 0) return false;
    number = number * 58n + BigInt(digit);
  }
  let byteLength = 0;
  while (number > 0n) {
    byteLength += 1;
    number >>= 8n;
  }
  const leadingZeroBytes = value.match(/^1*/)?.[0].length || 0;
  return leadingZeroBytes + byteLength === 32;
}
