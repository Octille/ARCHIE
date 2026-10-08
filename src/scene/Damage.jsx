import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

const CRACK_LIMIT = 44;
const DEBRIS_LIMIT = 28;

function makeCracks() {
  const items = [];
  const centers = [[-1.45, 2.68], [1.42, 1.45], [0.94, 2.95], [-0.42, 1.1]];
  centers.forEach(([cx, cy], centerIndex) => {
    const branches = 6 + centerIndex * 2;
    for (let branch = 0; branch < branches; branch += 1) {
      let x = cx;
      let y = cy;
      const angle = (branch / branches) * Math.PI * 2 + centerIndex * 0.37;
      const length = 0.18 + ((branch * 7 + centerIndex * 3) % 7) * 0.055;
      const steps = 2 + (branch % 2);
      for (let step = 0; step < steps; step += 1) {
        const segmentLength = length / steps;
        const bend = ((branch + step * 3) % 3 - 1) * 0.16;
        const a = angle + bend;
        const nx = x + Math.cos(a) * segmentLength;
        const ny = y + Math.sin(a) * segmentLength;
        items.push({ x: (x + nx) / 2, y: (y + ny) / 2, angle: Math.atan2(ny - y, nx - x), length: segmentLength, centerIndex });
        x = nx;
        y = ny;
      }
    }
  });
  return items.slice(0, CRACK_LIMIT);
}

const CRACKS = makeCracks();

function InstancedCracks({ stage, graduated }) {
  const ref = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useEffect(() => {
    if (!ref.current) return;
    const active = graduated ? 0 : stage < 1 ? 0 : stage === 1 ? 5 : stage === 2 ? 14 : stage === 3 ? 29 : CRACKS.length;
    for (let index = 0; index < CRACKS.length; index += 1) {
      const crack = CRACKS[index];
      dummy.position.set(crack.x, crack.y, 3.095);
      dummy.rotation.set(0, 0, crack.angle);
      const visible = index < active;
      dummy.scale.set(visible ? crack.length : 0, visible ? 0.012 : 0, 0.008);
      dummy.updateMatrix();
      ref.current.setMatrixAt(index, dummy.matrix);
    }
    ref.current.count = CRACKS.length;
    ref.current.instanceMatrix.needsUpdate = true;
  }, [stage, graduated, dummy]);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, CRACKS.length]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color="#a8f0c0" transparent opacity={0.72} toneMapped={false} />
    </instancedMesh>
  );
}

function BreakoutDebris({ active, reducedMotion, lastTrade, graduated, lowPower }) {
  const ref = useRef();
  const sparkRef = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const particles = useMemo(() => Array.from({ length: DEBRIS_LIMIT }, (_, index) => ({
    origin: new THREE.Vector3(((index * 17) % 23 - 11) * 0.12, 0.8 + ((index * 11) % 17) * 0.14, 2.95 + ((index * 7) % 9) * 0.012),
    velocity: new THREE.Vector3(((index * 13) % 11 - 5) * 0.13, 0.45 + ((index * 5) % 9) * 0.13, 0.3 + ((index * 3) % 7) * 0.1),
    scale: 0.025 + (index % 4) * 0.012,
    spin: (index % 2 ? 1 : -1) * (0.6 + (index % 5) * 0.2),
  })), []);
  const startTime = useRef(0);
  const pulse = useRef(0);
  const matricesReady = useRef(false);
  const burstKey = graduated ? 'graduation' : lastTrade?.at;

  useEffect(() => {
    if (active) startTime.current = Date.now();
  }, [active, burstKey]);

  useFrame((_, delta) => {
    if (!ref.current || !sparkRef.current) return;
    pulse.current = THREE.MathUtils.damp(pulse.current, active ? 1 : 0, 2.5, delta);
    if (!active && pulse.current < 0.001 && matricesReady.current) return;
    const elapsed = active ? (Date.now() - startTime.current) / 1000 : 4;
    const time = elapsed * (graduated ? 0.42 : 1);
    const count = lowPower || reducedMotion ? 10 : lastTrade?.big || graduated ? DEBRIS_LIMIT : 12;
    const sparkCount = lowPower || reducedMotion ? 5 : graduated ? 16 : lastTrade?.big ? 12 : 6;
    for (let index = 0; index < DEBRIS_LIMIT; index += 1) {
      const particle = particles[index];
      const visible = active && index < count && (time < 3 || (reducedMotion && elapsed < 1.2));
      if (!visible) {
        dummy.position.set(0, -20, 0);
        dummy.scale.setScalar(0);
      } else {
        const t = reducedMotion ? 0.3 : Math.min(time, 2.8);
        dummy.position.set(
          particle.origin.x + particle.velocity.x * t,
          particle.origin.y + particle.velocity.y * t - 0.62 * t * t,
          particle.origin.z + particle.velocity.z * t,
        );
        dummy.rotation.set(t * particle.spin, t * 0.7, t * particle.spin * 0.4);
        dummy.scale.setScalar(particle.scale * pulse.current);
      }
      dummy.updateMatrix();
      ref.current.setMatrixAt(index, dummy.matrix);
      const sparkVisible = active && index < sparkCount && (time < 1.4 || (reducedMotion && elapsed < 1.2));
      if (sparkVisible) {
        const sparkTime = reducedMotion ? 0.22 : Math.min(time, 1.35);
        dummy.position.set(
          particle.origin.x + particle.velocity.x * sparkTime * 1.8,
          particle.origin.y + particle.velocity.y * sparkTime * 1.45 - 0.38 * sparkTime * sparkTime,
          particle.origin.z + particle.velocity.z * sparkTime * 1.6,
        );
        dummy.rotation.set(0, 0, particle.spin * sparkTime);
        dummy.scale.setScalar(particle.scale * (graduated ? 0.9 : 0.68) * pulse.current);
      } else {
        dummy.position.set(0, -20, 0);
        dummy.scale.setScalar(0);
      }
      dummy.updateMatrix();
      sparkRef.current.setMatrixAt(index, dummy.matrix);
    }
    ref.current.instanceMatrix.needsUpdate = true;
    sparkRef.current.instanceMatrix.needsUpdate = true;
    matricesReady.current = true;
  });

  return (
    <>
    <instancedMesh ref={ref} args={[undefined, undefined, DEBRIS_LIMIT]} frustumCulled={false}>
      <icosahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color="#b7d3ba" roughness={0.4} metalness={0.18} emissive="#64ec95" emissiveIntensity={0.18} />
    </instancedMesh>
    <instancedMesh ref={sparkRef} args={[undefined, undefined, DEBRIS_LIMIT]} frustumCulled={false}>
      <sphereGeometry args={[1, 8, 6]} />
      <meshBasicMaterial color="#ffc36a" toneMapped={false} />
    </instancedMesh>
    </>
  );
}

function AlarmLight() {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (ref.current) ref.current.intensity = 0.7 + (Math.sin(clock.elapsedTime * 4.1) + 1) * 0.35;
  });
  return <pointLight ref={ref} position={[0, 2.4, 3.18]} color="#ff483d" distance={4} />;
}

export default function Damage({ stage, graduated, lastTrade, reducedMotion, lowPower = false }) {
  const previousTrade = useRef(0);
  const lastHit = Number(lastTrade?.at || 0);
  const tradeHit = Boolean(!graduated && lastHit && lastHit !== previousTrade.current && lastTrade?.side === 'buy');
  useEffect(() => { if (lastHit) previousTrade.current = lastHit; }, [lastHit]);
  const breakout = graduated;
  return (
    <group>
      {stage >= 1 && <InstancedCracks stage={stage} graduated={graduated} />}
      {(stage >= 1 || tradeHit || breakout) && <BreakoutDebris active={tradeHit || breakout} reducedMotion={reducedMotion} lastTrade={lastTrade} graduated={graduated} lowPower={lowPower} />}
      {stage >= 3 && stage < 5 && !reducedMotion && <AlarmLight />}
    </group>
  );
}
