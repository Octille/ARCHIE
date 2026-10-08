import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

export default function CrewMember({ index, position, stage, lastTrade, reducedMotion }) {
  const arm = useRef();
  const body = useRef();
  const swingStart = useRef(-20);
  const nextHit = useRef(0);
  const pauseUntil = useRef(0);
  const pendingSwing = useRef(false);
  const pendingPause = useRef(false);
  const previousTrade = useRef(0);
  const tradeAt = Number(lastTrade?.at || 0);

  useEffect(() => {
    if (!tradeAt || tradeAt === previousTrade.current) return;
    previousTrade.current = tradeAt;
    const nearestCrew = stage === 1 ? 0 : 1;
    if (lastTrade?.side === 'buy' && index === nearestCrew) pendingSwing.current = true;
    if (lastTrade?.side === 'sell') pendingPause.current = true;
  }, [tradeAt, lastTrade?.side, index]);

  useFrame(({ clock }) => {
    if (!arm.current || !body.current) return;
    const now = clock.elapsedTime;
    if (pendingSwing.current) { swingStart.current = now; pendingSwing.current = false; }
    if (pendingPause.current) { pauseUntil.current = now + 1.3; pendingPause.current = false; }
    if (!nextHit.current) nextHit.current = now + 2.5 + index * 1.8;
    const delay = stage >= 4 ? 2.8 : stage === 3 ? 4.7 : stage === 2 ? 7.5 : 11;
    if (stage >= 1 && now > nextHit.current && now > pauseUntil.current) {
      swingStart.current = now;
      nextHit.current = now + delay + index * 1.2;
    }
    const elapsed = now - swingStart.current;
    const hit = elapsed >= 0 && elapsed < (reducedMotion ? 0.28 : 0.72);
    const wave = hit ? Math.sin((elapsed / (reducedMotion ? 0.28 : 0.72)) * Math.PI) : 0;
    arm.current.rotation.z = -0.28 - wave * (lastTrade?.big && hit ? 1.35 : 0.95);
    body.current.rotation.z = Math.sin(now * 1.5 + index) * 0.018 - wave * 0.05;
    body.current.position.y = Math.abs(Math.sin(now * 1.3 + index)) * 0.025;
  });

  return (
    <group position={position}>
      <group ref={body}>
        <mesh position={[0, 0.9, 0]} castShadow>
          <capsuleGeometry args={[0.15, 0.65, 4, 8]} />
          <meshStandardMaterial color="#19231c" metalness={0.58} roughness={0.42} />
        </mesh>
        <mesh position={[0, 1.45, 0]} castShadow>
          <sphereGeometry args={[0.21, 12, 10]} />
          <meshStandardMaterial color="#26372b" metalness={0.62} roughness={0.35} />
        </mesh>
        <mesh position={[0, 1.46, 0.19]}>
          <boxGeometry args={[0.2, 0.045, 0.025]} />
          <meshBasicMaterial color="#72e790" />
        </mesh>
        <mesh position={[-0.1, 0.25, 0]} castShadow>
          <cylinderGeometry args={[0.05, 0.07, 0.5, 7]} />
          <meshStandardMaterial color="#34463a" metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[0.1, 0.25, 0]} castShadow>
          <cylinderGeometry args={[0.05, 0.07, 0.5, 7]} />
          <meshStandardMaterial color="#34463a" metalness={0.7} roughness={0.3} />
        </mesh>
        <group ref={arm} position={[0.18, 1.23, 0.04]}>
          <mesh position={[0, -0.3, 0]} rotation={[0, 0, -0.12]} castShadow>
            <cylinderGeometry args={[0.055, 0.06, 0.58, 8]} />
            <meshStandardMaterial color="#46544b" metalness={0.68} roughness={0.3} />
          </mesh>
          {/* The little blunt crowbar is a tool prop, never a weapon. */}
          <group position={[0.02, -0.62, 0.04]} rotation={[0, 0, -0.35]}>
            <mesh position={[0, 0.3, 0]} castShadow>
              <cylinderGeometry args={[0.025, 0.035, 0.56, 8]} />
              <meshStandardMaterial color="#b78a4c" metalness={0.65} roughness={0.3} />
            </mesh>
            <mesh position={[0.08, 0.58, 0]} rotation={[0, 0, 0.7]} castShadow>
              <cylinderGeometry args={[0.028, 0.035, 0.2, 7]} />
              <meshStandardMaterial color="#c1ccd0" metalness={0.86} roughness={0.22} />
            </mesh>
          </group>
        </group>
      </group>
      <pointLight position={[0, 1.55, 0.24]} color="#8cffad" intensity={0.18} distance={1.2} />
    </group>
  );
}
