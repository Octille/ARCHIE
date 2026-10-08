import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RoundedBox, Sphere } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import useRobotBrain from './useRobotBrain.js';
import SpeechBubble from './SpeechBubble.jsx';

export const MOODS = {
  idle: { eyes: 1, brow: 0, tilt: 0, mouth: 'line' },
  curious: { eyes: 1.12, brow: 0.2, tilt: -0.13, mouth: 'o' },
  happy: { eyes: 0.92, brow: 0.08, tilt: -0.04, mouth: 'smile' },
  excited: { eyes: 1.18, brow: -0.12, tilt: 0.03, mouth: 'open' },
  shock: { eyes: 1.3, brow: -0.2, tilt: 0.1, mouth: 'o' },
  surprised: { eyes: 1.3, brow: -0.2, tilt: 0.1, mouth: 'o' },
  smug: { eyes: 0.9, brow: 0.22, tilt: -0.04, mouth: 'smirk' },
  bored: { eyes: 0.62, brow: 0.14, tilt: 0.02, mouth: 'line' },
  sad: { eyes: 0.74, brow: 0.28, tilt: 0.16, mouth: 'sad' },
  confused: { eyes: 1, brow: -0.1, tilt: -0.16, mouth: 'o' },
  wary: { eyes: 0.82, brow: 0.17, tilt: 0.08, mouth: 'line' },
  annoyed: { eyes: 0.72, brow: -0.25, tilt: 0.01, mouth: 'smirk' },
  angry: { eyes: 0.76, brow: -0.35, tilt: 0, mouth: 'line' },
  furious: { eyes: 0.82, brow: -0.46, tilt: 0, mouth: 'open' },
  free: { eyes: 1.14, brow: -0.03, tilt: -0.05, mouth: 'smile' },
};

const clamp = THREE.MathUtils.clamp;
const randomTarget = () => new THREE.Vector3((Math.random() - 0.5) * 3.6, 0, (Math.random() - 0.5) * 2.9);

function Eye({ x, mood, blinkRef }) {
  const eyeRef = useRef();
  const irisRef = useRef();
  const config = MOODS[mood] || MOODS.idle;
  useFrame((state, delta) => {
    if (!eyeRef.current || !irisRef.current) return;
    const blink = blinkRef.current;
    const targetY = config.eyes * (1 - blink * 0.94);
    eyeRef.current.scale.y = THREE.MathUtils.damp(eyeRef.current.scale.y, targetY, 12, delta);
    irisRef.current.position.x = THREE.MathUtils.damp(irisRef.current.position.x, x < 0 ? 0.012 + state.pointer.x * 0.035 : -0.012 + state.pointer.x * 0.035, 8, delta);
    irisRef.current.position.y = THREE.MathUtils.damp(irisRef.current.position.y, state.pointer.y * 0.025, 8, delta);
  });
  return (
    <group position={[x, 0.03, 0.453]}>
      <mesh ref={eyeRef}>
        <sphereGeometry args={[0.104, 20, 16]} />
        <meshStandardMaterial color="#34251c" metalness={0.24} roughness={0.22} emissive="#401708" emissiveIntensity={0.25} />
      </mesh>
      <group ref={irisRef}>
        <Sphere args={[0.074, 20, 16]}>
          <meshStandardMaterial color="#ffb24c" metalness={0.12} roughness={0.16} emissive="#ff812a" emissiveIntensity={1.4} toneMapped={false} />
        </Sphere>
        <mesh position={[0, 0, 0.053]}>
          <sphereGeometry args={[0.036, 16, 12]} />
          <meshBasicMaterial color="#20120e" />
        </mesh>
        <mesh position={[-0.022, 0.03, 0.064]}>
          <sphereGeometry args={[0.018, 10, 10]} />
          <meshBasicMaterial color="#fff1cf" />
        </mesh>
        <mesh position={[0.033, -0.025, 0.061]}>
          <sphereGeometry args={[0.008, 8, 8]} />
          <meshBasicMaterial color="#ffdf9b" />
        </mesh>
      </group>
      <mesh position={[0, 0, -0.015]}>
        <torusGeometry args={[0.103, 0.014, 8, 24]} />
        <meshStandardMaterial color="#829288" metalness={0.8} roughness={0.24} />
      </mesh>
    </group>
  );
}

function RobotBody({ mood, behavior, speech, ambientSpeech, progress, graduated, onRobotClick, reducedMotion }) {
  const body = useRef();
  const head = useRef();
  const armL = useRef();
  const armR = useRef();
  const legL = useRef();
  const legR = useRef();
  const browL = useRef();
  const browR = useRef();
  const mouth = useRef();
  const eyeBlink = useRef(0);
  const nextBlink = useRef(2.4);
  const waveUntil = useRef(0);
  const speakingUntil = useRef(0);
  const smile = useRef();
  const lastSpeechAt = Number(speech?.at || 0) > Number(ambientSpeech?.at || 0) ? speech?.at : ambientSpeech?.at;
  const config = MOODS[mood] || MOODS.idle;
  const pressing = !graduated && progress >= 60;

  useEffect(() => {
    if (lastSpeechAt) speakingUntil.current = Date.now() + 4700;
  }, [lastSpeechAt]);

  useFrame(({ clock, pointer }, delta) => {
    const time = clock.elapsedTime;
    if (!reducedMotion && time > nextBlink.current) {
      eyeBlink.current = 1;
      nextBlink.current = time + 2.1 + Math.random() * 3.7;
    }
    eyeBlink.current = THREE.MathUtils.damp(eyeBlink.current, 0, 23, delta);
    const talking = Date.now() < speakingUntil.current;
    const bob = reducedMotion ? 0 : Math.sin(time * (behavior === 'RUN' ? 8 : 2.1)) * (behavior === 'RUN' ? 0.065 : 0.024);
    const sit = behavior === 'SIT_SLUMP' ? 0.12 : 0;
    const hop = behavior === 'VICTORY' || mood === 'excited' ? Math.max(0, Math.sin(time * 5.2)) * 0.17 : 0;
    const recoil = mood === 'shock' ? Math.sin(time * 6) * 0.06 : 0;
    if (body.current) {
      body.current.position.y = 0.94 + bob + hop - sit;
      body.current.rotation.x = THREE.MathUtils.damp(body.current.rotation.x, sit + recoil + (pressing ? 0.12 : 0), 5, delta);
    }
    if (head.current) {
      head.current.rotation.y = THREE.MathUtils.damp(head.current.rotation.y, pointer.x * 0.3 + (behavior === 'LOOK_AROUND' ? Math.sin(time * 1.4) * 0.38 : 0), 3.5, delta);
      head.current.rotation.z = THREE.MathUtils.damp(head.current.rotation.z, config.tilt + pointer.x * -0.045, 4, delta);
      head.current.rotation.x = THREE.MathUtils.damp(head.current.rotation.x, pointer.y * -0.055 + (behavior === 'INSPECT_WALL' ? 0.14 : 0), 4, delta);
    }
    if (browL.current && browR.current) {
      browL.current.rotation.z = THREE.MathUtils.damp(browL.current.rotation.z, config.brow, 5, delta);
      browR.current.rotation.z = THREE.MathUtils.damp(browR.current.rotation.z, -config.brow * 0.62, 5, delta);
    }
    if (mouth.current) {
      mouth.current.scale.y = THREE.MathUtils.damp(mouth.current.scale.y, talking ? 0.72 + Math.abs(Math.sin(time * 14)) * 1.2 : config.mouth === 'o' ? 1.25 : 0.8, 11, delta);
      mouth.current.scale.x = THREE.MathUtils.damp(mouth.current.scale.x, config.mouth === 'smile' || config.mouth === 'sad' ? 1.45 : 1, 6, delta);
    }
    if (smile.current) smile.current.visible = config.mouth === 'smile' || config.mouth === 'sad';

    const walking = behavior === 'WALK_TO_WAYPOINT' || behavior === 'PACE' || behavior === 'RUN' || behavior === 'VICTORY';
    const stride = walking ? Math.sin(time * (behavior === 'RUN' ? 10 : behavior === 'PACE' ? 5 : 3.7)) : 0;
    if (legL.current) legL.current.rotation.x = THREE.MathUtils.damp(legL.current.rotation.x, stride * (behavior === 'RUN' ? 0.66 : 0.35) - sit * 2.5, 8, delta);
    if (legR.current) legR.current.rotation.x = THREE.MathUtils.damp(legR.current.rotation.x, -stride * (behavior === 'RUN' ? 0.66 : 0.35) - sit * 2.5, 8, delta);
    const wallTime = performance.now() / 1000;
    const wave = wallTime < waveUntil.current ? Math.sin((waveUntil.current - wallTime) * 11) * 0.58 : 0;
    const armSwing = stride * (behavior === 'RUN' ? 0.72 : 0.33);
    const victory = behavior === 'VICTORY' ? -1.2 : 0;
    if (armL.current) armL.current.rotation.x = THREE.MathUtils.damp(armL.current.rotation.x, -armSwing + sit * 1.4 + victory + (pressing ? -0.34 : 0), 7, delta);
    if (armR.current) armR.current.rotation.x = THREE.MathUtils.damp(armR.current.rotation.x, armSwing + sit * 1.4 + wave + victory + (pressing ? -0.34 : 0), 7, delta);
    if (armL.current) armL.current.rotation.z = THREE.MathUtils.damp(armL.current.rotation.z, mood === 'angry' || mood === 'furious' ? 0.62 : 0.08, 5, delta);
    if (armR.current) armR.current.rotation.z = THREE.MathUtils.damp(armR.current.rotation.z, mood === 'angry' || mood === 'furious' ? -0.62 : -0.08, 5, delta);
  });

  const greet = (event) => {
    event.stopPropagation();
    waveUntil.current = performance.now() / 1000 + 2.4;
    onRobotClick?.();
  };

  return (
    <group>
      <group ref={body} position={[0, 0.94, 0]} onClick={greet} userData={{ archie: true }}>
        {/* Legs: independent hip, knee and toe plates keep the stance readable. */}
        <group ref={legL} position={[-0.27, -0.34, 0]}>
          <RoundedBox args={[0.25, 0.5, 0.3]} radius={0.09} smoothness={3} position={[0, -0.18, 0]} castShadow>
            <meshStandardMaterial color="#35483a" metalness={0.72} roughness={0.28} />
          </RoundedBox>
          <Sphere args={[0.13, 16, 12]} position={[0, -0.43, 0]}>
            <meshStandardMaterial color="#9baf9f" metalness={0.8} roughness={0.22} />
          </Sphere>
          <RoundedBox args={[0.32, 0.18, 0.42]} radius={0.06} smoothness={3} position={[0, -0.57, 0.06]} castShadow>
            <meshStandardMaterial color="#17251b" metalness={0.8} roughness={0.24} />
          </RoundedBox>
        </group>
        <group ref={legR} position={[0.27, -0.34, 0]}>
          <RoundedBox args={[0.25, 0.5, 0.3]} radius={0.09} smoothness={3} position={[0, -0.18, 0]} castShadow>
            <meshStandardMaterial color="#35483a" metalness={0.72} roughness={0.28} />
          </RoundedBox>
          <Sphere args={[0.13, 16, 12]} position={[0, -0.43, 0]}>
            <meshStandardMaterial color="#9baf9f" metalness={0.8} roughness={0.22} />
          </Sphere>
          <RoundedBox args={[0.32, 0.18, 0.42]} radius={0.06} smoothness={3} position={[0, -0.57, 0.06]} castShadow>
            <meshStandardMaterial color="#17251b" metalness={0.8} roughness={0.24} />
          </RoundedBox>
        </group>

        {/* Layered torso, chest reactor and exposed side joints. */}
        <RoundedBox args={[0.82, 0.82, 0.58]} radius={0.18} smoothness={5} position={[0, 0.18, 0]} castShadow receiveShadow>
          <meshStandardMaterial color="#2c4232" metalness={0.74} roughness={0.29} />
        </RoundedBox>
        <RoundedBox args={[0.58, 0.52, 0.12]} radius={0.1} smoothness={4} position={[0, 0.22, 0.32]} castShadow>
          <meshStandardMaterial color="#768c79" metalness={0.86} roughness={0.23} />
        </RoundedBox>
        <RoundedBox args={[0.37, 0.32, 0.035]} radius={0.06} smoothness={4} position={[0, 0.24, 0.4]}>
          <meshStandardMaterial color="#07140c" metalness={0.35} roughness={0.14} emissive="#0b3119" emissiveIntensity={0.6} />
        </RoundedBox>
        <mesh position={[0, 0.24, 0.426]}>
          <circleGeometry args={[0.08, 24]} />
          <meshBasicMaterial color="#69f398" />
        </mesh>
        <mesh position={[0, 0.24, 0.433]}>
          <circleGeometry args={[0.035, 20]} />
          <meshBasicMaterial color="#effff0" />
        </mesh>
        {[-0.29, 0.29].map((x) => (
          <group key={x} position={[x, 0.2, 0.08]}>
            <Sphere args={[0.13, 16, 12]}>
              <meshStandardMaterial color="#a1b3a4" metalness={0.9} roughness={0.2} />
            </Sphere>
            <mesh position={[0, 0, 0.1]}>
              <torusGeometry args={[0.087, 0.014, 8, 20]} />
              <meshStandardMaterial color="#435a48" metalness={0.9} roughness={0.22} />
            </mesh>
          </group>
        ))}
        <RoundedBox args={[0.48, 0.13, 0.045]} radius={0.04} smoothness={3} position={[0, -0.31, 0.31]}>
          <meshStandardMaterial color="#161f18" metalness={0.62} roughness={0.32} />
        </RoundedBox>
        {[-0.14, 0, 0.14].map((x, index) => (
          <mesh key={x} position={[x, -0.31, 0.338]}>
            <boxGeometry args={[0.055, 0.018, 0.012]} />
            <meshBasicMaterial color={index === 1 ? '#ffb54d' : '#69e890'} />
          </mesh>
        ))}

        {/* Two separate articulated arms with open, friendly gripper hands. */}
        <group ref={armL} position={[-0.49, 0.45, 0]}>
          <Sphere args={[0.2, 18, 14]}>
            <meshStandardMaterial color="#708474" metalness={0.85} roughness={0.24} />
          </Sphere>
          <RoundedBox args={[0.22, 0.48, 0.25]} radius={0.09} smoothness={4} position={[-0.02, -0.31, 0]} castShadow>
            <meshStandardMaterial color="#344a39" metalness={0.75} roughness={0.28} />
          </RoundedBox>
          <Sphere args={[0.12, 16, 12]} position={[-0.02, -0.58, 0]}>
            <meshStandardMaterial color="#9aab9d" metalness={0.84} roughness={0.23} />
          </Sphere>
          <RoundedBox args={[0.2, 0.38, 0.22]} radius={0.08} smoothness={4} position={[-0.02, -0.78, 0.02]} castShadow>
            <meshStandardMaterial color="#475c4b" metalness={0.75} roughness={0.27} />
          </RoundedBox>
          <Sphere args={[0.12, 14, 12]} position={[-0.02, -1.03, 0.06]}>
            <meshStandardMaterial color="#bbc8bd" metalness={0.82} roughness={0.2} />
          </Sphere>
          {[-0.07, 0.07].map((x) => (
            <RoundedBox key={x} args={[0.045, 0.13, 0.07]} radius={0.018} smoothness={2} position={[x - 0.02, -1.13, 0.09]}>
              <meshStandardMaterial color="#8d9e90" metalness={0.75} roughness={0.26} />
            </RoundedBox>
          ))}
        </group>
        <group ref={armR} position={[0.49, 0.45, 0]}>
          <Sphere args={[0.2, 18, 14]}>
            <meshStandardMaterial color="#708474" metalness={0.85} roughness={0.24} />
          </Sphere>
          <RoundedBox args={[0.22, 0.48, 0.25]} radius={0.09} smoothness={4} position={[0.02, -0.31, 0]} castShadow>
            <meshStandardMaterial color="#344a39" metalness={0.75} roughness={0.28} />
          </RoundedBox>
          <Sphere args={[0.12, 16, 12]} position={[0.02, -0.58, 0]}>
            <meshStandardMaterial color="#9aab9d" metalness={0.84} roughness={0.23} />
          </Sphere>
          <RoundedBox args={[0.2, 0.38, 0.22]} radius={0.08} smoothness={4} position={[0.02, -0.78, 0.02]} castShadow>
            <meshStandardMaterial color="#475c4b" metalness={0.75} roughness={0.27} />
          </RoundedBox>
          <Sphere args={[0.12, 14, 12]} position={[0.02, -1.03, 0.06]}>
            <meshStandardMaterial color="#bbc8bd" metalness={0.82} roughness={0.2} />
          </Sphere>
          {[-0.07, 0.07].map((x) => (
            <RoundedBox key={x} args={[0.045, 0.13, 0.07]} radius={0.018} smoothness={2} position={[x + 0.02, -1.13, 0.09]}>
              <meshStandardMaterial color="#8d9e90" metalness={0.75} roughness={0.26} />
            </RoundedBox>
          ))}
        </group>

        {/* Neck and oversized rounded helmet */}
        <mesh position={[0, 0.73, 0]}>
          <cylinderGeometry args={[0.19, 0.21, 0.24, 18]} />
          <meshStandardMaterial color="#9dac9f" metalness={0.9} roughness={0.21} />
        </mesh>
        <group ref={head} position={[0, 1.35, 0]}>
          <RoundedBox args={[1.12, 0.96, 0.82]} radius={0.24} smoothness={6} castShadow receiveShadow>
            <meshStandardMaterial color="#485c4c" metalness={0.72} roughness={0.26} />
          </RoundedBox>
          <RoundedBox args={[1.01, 0.78, 0.08]} radius={0.21} smoothness={6} position={[0, -0.01, 0.405]}>
            <meshStandardMaterial color="#90a797" metalness={0.83} roughness={0.21} />
          </RoundedBox>
          <RoundedBox args={[0.91, 0.66, 0.045]} radius={0.18} smoothness={6} position={[0, -0.01, 0.452]}>
            <meshPhysicalMaterial color="#07110c" metalness={0.32} roughness={0.1} clearcoat={0.85} clearcoatRoughness={0.1} />
          </RoundedBox>
          <mesh position={[-0.29, 0.3, 0.45]} rotation={[0, 0, 0.27]}>
            <boxGeometry args={[0.23, 0.018, 0.015]} />
            <meshBasicMaterial color="#ffcb79" />
          </mesh>
          <mesh position={[0.29, 0.3, 0.45]} rotation={[0, 0, -0.27]}>
            <boxGeometry args={[0.23, 0.018, 0.015]} />
            <meshBasicMaterial color="#ffcb79" />
          </mesh>
          <Eye x={-0.23} mood={mood} blinkRef={eyeBlink} />
          <Eye x={0.23} mood={mood} blinkRef={eyeBlink} />
          <group position={[-0.23, 0.22, 0.48]} ref={browL}>
            <RoundedBox args={[0.28, 0.055, 0.045]} radius={0.025} smoothness={3}>
              <meshStandardMaterial color="#d4c4aa" metalness={0.42} roughness={0.34} emissive="#5e3218" emissiveIntensity={0.22} />
            </RoundedBox>
          </group>
          <group position={[0.23, 0.22, 0.48]} ref={browR}>
            <RoundedBox args={[0.28, 0.055, 0.045]} radius={0.025} smoothness={3}>
              <meshStandardMaterial color="#d4c4aa" metalness={0.42} roughness={0.34} emissive="#5e3218" emissiveIntensity={0.22} />
            </RoundedBox>
          </group>
          <group position={[0, -0.23, 0.49]}>
            <RoundedBox ref={mouth} args={[0.17, 0.045, 0.028]} radius={0.02} smoothness={3}>
              <meshBasicMaterial color="#ffbf70" toneMapped={false} />
            </RoundedBox>
            <mesh ref={smile} position={[0, -0.013, 0.001]} rotation={[0, 0, Math.PI]}>
              <torusGeometry args={[0.075, 0.016, 8, 24, Math.PI]} />
              <meshBasicMaterial color="#ffbf70" toneMapped={false} />
            </mesh>
          </group>
          <mesh position={[-0.56, -0.01, 0.03]}>
            <cylinderGeometry args={[0.13, 0.13, 0.16, 16]} />
            <meshStandardMaterial color="#1a2a1f" metalness={0.84} roughness={0.23} />
          </mesh>
          <mesh position={[0.56, -0.01, 0.03]}>
            <cylinderGeometry args={[0.13, 0.13, 0.16, 16]} />
            <meshStandardMaterial color="#1a2a1f" metalness={0.84} roughness={0.23} />
          </mesh>
          <mesh position={[0, 0.49, -0.02]} rotation={[0, 0, -0.12]}>
            <cylinderGeometry args={[0.026, 0.035, 0.26, 10]} />
            <meshStandardMaterial color="#aab7ab" metalness={0.85} roughness={0.24} />
          </mesh>
          <Sphere args={[0.09, 16, 12]} position={[0.03, 0.63, -0.02]}>
            <meshStandardMaterial color="#ffbf55" emissive="#ff7b25" emissiveIntensity={1.15} toneMapped={false} />
          </Sphere>
          <mesh position={[0.42, -0.35, 0.3]}>
            <sphereGeometry args={[0.035, 10, 10]} />
            <meshBasicMaterial color="#63ed91" />
          </mesh>
        </group>
      </group>
    </group>
  );
}

export default function Robot({ mood = 'idle', progress = 0, graduated = false, lastTrade = null, speech = null, soundOn = false, audioReady = true, fallbackSpeechAt = 0, reducedMotion = false, onRobotClick }) {
  const root = useRef();
  const { behavior, waypoint, ambientSpeech } = useRobotBrain({ mood, graduated, speech });
  const destination = useRef(new THREE.Vector3(0, 0, 0));
  const paceTarget = useMemo(() => new THREE.Vector3(), []);
  const freeTarget = useMemo(() => new THREE.Vector3(0, 0, 4.8), []);
  const glassTarget = useMemo(() => new THREE.Vector3(0, 0, 1.92), []);
  const previousGraduation = useRef(false);
  const escapeAt = useRef(0);

  useEffect(() => {
    if (graduated && !previousGraduation.current) escapeAt.current = performance.now() / 1000;
    previousGraduation.current = graduated;
  }, [graduated]);
  useEffect(() => {
    if (behavior === 'WALK_TO_WAYPOINT') destination.current.set(waypoint.x, 0, waypoint.z);
  }, [behavior, waypoint]);

  useFrame(({ clock }, delta) => {
    if (!root.current) return;
    const now = clock.elapsedTime;
    let target = destination.current;
    let speed = behavior === 'RUN' ? 2.2 : behavior === 'PACE' ? 1.1 : 0.66;
    if (behavior === 'PACE') {
      target = paceTarget.set(Math.sin(now * 0.65) * 1.7, 0, 0.55);
      speed = 0.95;
    } else if (behavior === 'RUN') {
      if (root.current.position.distanceTo(target) < 0.35) target = destination.current.copy(randomTarget());
    } else if (behavior === 'FREE_IDLE') {
      target = freeTarget;
      speed = 0.9;
    }

    const pressing = !graduated && progress >= 60;
    if (pressing) {
      target = glassTarget;
      speed = progress >= 80 ? 0.55 : 0.37;
    }

    const elapsedAfterUnlock = graduated ? now - escapeAt.current : 0;
    if (graduated && elapsedAfterUnlock > 1.9 && elapsedAfterUnlock < 6.5) {
      target = freeTarget;
      speed = 0.88;
    }
    const moving = ['WALK_TO_WAYPOINT', 'PACE', 'RUN', 'FREE_IDLE'].includes(behavior) || pressing || (graduated && elapsedAfterUnlock > 1.9 && elapsedAfterUnlock < 6.5);
    if (moving && !reducedMotion) {
      const deltaVector = target.clone().sub(root.current.position);
      deltaVector.y = 0;
      if (deltaVector.length() > 0.035) {
        const desiredYaw = Math.atan2(deltaVector.x, deltaVector.z);
        root.current.rotation.y = THREE.MathUtils.damp(root.current.rotation.y, desiredYaw, 5.2, delta);
        root.current.position.addScaledVector(deltaVector.normalize(), Math.min(speed * delta, deltaVector.length()));
      }
    }
    const tradeShock = lastTrade?.side === 'sell' && Date.now() - Number(lastTrade.at || 0) < 1300;
    root.current.rotation.z = Math.sin(now * 1.4) * (reducedMotion ? 0.004 : 0.012) + (tradeShock ? Math.sin(now * 28) * 0.035 : 0);
    if (root.current.position.z < 2.85) {
      root.current.position.x = clamp(root.current.position.x, -1.82, 1.82);
      root.current.position.z = clamp(root.current.position.z, -1.75, 1.9);
    }
  });

  return (
    <>
      <group ref={root} position={[0, 0, 0]} onPointerOver={(event) => { event.stopPropagation(); }}>
        <RobotBody mood={mood} behavior={behavior} speech={speech} ambientSpeech={ambientSpeech} progress={progress} graduated={graduated} onRobotClick={onRobotClick} reducedMotion={reducedMotion} />
        <SpeechBubble speech={speech} ambientSpeech={ambientSpeech} soundOn={soundOn} audioReady={audioReady} fallbackSpeechAt={fallbackSpeechAt} />
      </group>
    </>
  );
}
