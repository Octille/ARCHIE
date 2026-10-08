import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import Damage from './Damage.jsx';
import CrewMember from './CrewMember.jsx';

const STEEL = '#53635a';
const WALL = '#101b15';

function clickGlass(event, onGlassClick) {
  const hitRobot = event.intersections?.some(({ object }) => {
    let current = object;
    while (current) {
      if (current.userData?.archie) return true;
      current = current.parent;
    }
    return false;
  });
  if (!hitRobot) {
    event.stopPropagation();
    onGlassClick?.(event);
  }
}

function Beam({ start, end, radius = 0.035, color = STEEL, emissive = '#000000' }) {
  const a = useMemo(() => new THREE.Vector3(...start), [start.join(',')]);
  const b = useMemo(() => new THREE.Vector3(...end), [end.join(',')]);
  const direction = useMemo(() => b.clone().sub(a), [a, b]);
  const midpoint = useMemo(() => a.clone().add(b).multiplyScalar(0.5), [a, b]);
  return (
    <mesh position={midpoint} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize())} castShadow>
      <cylinderGeometry args={[radius, radius, direction.length(), 8]} />
      <meshStandardMaterial color={color} metalness={0.82} roughness={0.28} emissive={emissive} emissiveIntensity={0.4} />
    </mesh>
  );
}

function Monitor({ position, accent, label, bars = 4 }) {
  const screenTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    context.fillStyle = '#06130d';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = accent;
    context.font = 'bold 40px monospace';
    context.fillText(label, 28, 62);
    context.globalAlpha = 0.55;
    context.fillRect(28, 83, 456, 2);
    context.globalAlpha = 1;
    context.strokeStyle = accent;
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(28, 202);
    for (let point = 0; point < 12; point += 1) {
      context.lineTo(28 + point * 40, 158 + ((point * 37 + label.length * 13) % 54));
    }
    context.stroke();
    return new THREE.CanvasTexture(canvas);
  }, [accent, label]);
  useEffect(() => () => screenTexture.dispose(), [screenTexture]);
  return (
    <group position={position}>
      <mesh castShadow>
        <boxGeometry args={[1.18, 0.68, 0.08]} />
        <meshStandardMaterial color="#26342b" metalness={0.75} roughness={0.34} />
      </mesh>
      <mesh position={[0, 0, 0.047]}>
        <planeGeometry args={[1.04, 0.54]} />
        <meshStandardMaterial map={screenTexture} emissive="white" emissiveMap={screenTexture} emissiveIntensity={0.3} roughness={0.2} toneMapped={false} />
      </mesh>
      {Array.from({ length: bars }, (_, index) => (
        <mesh key={index} position={[-0.37 + index * 0.23, -0.03 + (index % 2) * 0.08, 0.056]}>
          <boxGeometry args={[0.035, 0.12 + (index % 3) * 0.035, 0.012]} />
          <meshBasicMaterial color={index === bars - 1 ? '#ffc05b' : accent} />
        </mesh>
      ))}
      <mesh position={[0, -0.41, -0.07]} castShadow>
        <boxGeometry args={[0.08, 0.18, 0.11]} />
        <meshStandardMaterial color="#35473a" metalness={0.78} roughness={0.32} />
      </mesh>
    </group>
  );
}

function Console({ position, color }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.34, 0]} castShadow>
        <boxGeometry args={[0.78, 0.58, 0.56]} />
        <meshStandardMaterial color="#26352c" metalness={0.7} roughness={0.32} />
      </mesh>
      <mesh position={[0, 0.34, 0.286]}>
        <planeGeometry args={[0.56, 0.35]} />
        <meshStandardMaterial color="#07100a" emissive={color} emissiveIntensity={0.42} />
      </mesh>
      {[-0.22, -0.07, 0.08, 0.23].map((x, index) => (
        <mesh key={x} position={[x, 0.08, 0.16]}>
          <sphereGeometry args={[0.025, 8, 8]} />
          <meshBasicMaterial color={index === 2 ? '#ffbd55' : '#69ef96'} />
        </mesh>
      ))}
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[0.88, 0.08, 0.64]} />
        <meshStandardMaterial color="#58665d" metalness={0.9} roughness={0.24} />
      </mesh>
    </group>
  );
}

function CalmThud({ soundOn, onThud }) {
  const ring = useRef();
  const material = useRef();
  const nextAt = useRef(30);
  const pulseAt = useRef(-1);
  useFrame(({ clock }) => {
    const time = clock.elapsedTime;
    if (time >= nextAt.current) {
      pulseAt.current = time;
      nextAt.current = time + 30;
      if (soundOn) onThud?.();
    }
    const age = time - pulseAt.current;
    if (!ring.current || !material.current) return;
    const visible = pulseAt.current >= 0 && age < 1.4;
    ring.current.visible = visible;
    ring.current.scale.setScalar(visible ? 0.35 + age * 2.4 : 0.001);
    material.current.opacity = visible ? 0.18 * (1 - age / 1.4) : 0;
  });
  return (
    <mesh ref={ring} position={[0, 0.035, -2.35]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.26, 0.29, 40]} />
      <meshBasicMaterial ref={material} color="#78c68a" transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}

function Room({ progress, graduated, reducedMotion, onGlassClick, lowPower }) {
  const warning = !graduated && progress >= 75;
  const amber = !graduated && progress >= 50 && progress < 75;
  const accent = graduated ? '#caffd2' : warning ? '#ff4a40' : amber ? '#ffad42' : '#52ed83';
  const frameX = [-3, 0, 3];
  const frameY = [0.08, 1.3, 2.7, 4];

  return (
    <>
      <color attach="background" args={['#030805']} />
      <fog attach="fog" args={['#07100a', 9, 18]} />
      <ambientLight intensity={0.36} color="#b7d8bd" />
      <hemisphereLight args={['#8bbd91', '#080d09', 0.42]} />
      <directionalLight position={[4, 7, 5]} intensity={1.45} color="#d5f0dc" castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-camera-far={15} shadow-camera-left={-6} shadow-camera-right={6} shadow-camera-top={7} shadow-camera-bottom={-2} />
      <pointLight position={[0, 3.65, -2.45]} intensity={warning && !reducedMotion ? 2.1 : 1.15} color={accent} distance={8} />
      <pointLight position={[-2.5, 2.4, 1.5]} intensity={0.7} color="#ffc36b" distance={5} />
      {warning && !reducedMotion && <pointLight position={[2.7, 2.8, -1.8]} intensity={1.7} color="#ff302d" distance={6} />}

      {/* Sealed metal floor and the archive wall */}
      <mesh position={[0, -0.12, 0]} receiveShadow>
        <boxGeometry args={[6.4, 0.24, 6.4]} />
        <meshStandardMaterial color="#111a15" metalness={0.68} roughness={0.38} />
      </mesh>
      <mesh position={[0, 2, -3.14]} receiveShadow>
        <boxGeometry args={[6.12, 4.08, 0.22]} />
        <meshStandardMaterial color={WALL} metalness={0.58} roughness={0.42} />
      </mesh>
      <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[6, 6]} />
        <meshStandardMaterial color="#101c14" metalness={0.6} roughness={0.38} />
      </mesh>
      <gridHelper args={[6, 18, '#38764a', '#183221']} position={[0, 0.025, 0]} />
      <mesh position={[0, 0.045, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.02, 1.055, 64]} />
        <meshBasicMaterial color={accent} transparent opacity={0.68} side={THREE.DoubleSide} />
      </mesh>

      {/* Three glass walls, with a front opening for the two sliding door leaves. */}
      <mesh position={[-3.02, 2, 0]} rotation={[0, Math.PI / 2, 0]} onClick={(event) => clickGlass(event, onGlassClick)}>
        <planeGeometry args={[6, 4]} />
        <meshPhysicalMaterial color="#5c936c" transparent opacity={0.12} roughness={0.08} metalness={0.15} transmission={0.12} thickness={0.08} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[3.02, 2, 0]} rotation={[0, -Math.PI / 2, 0]} onClick={(event) => clickGlass(event, onGlassClick)}>
        <planeGeometry args={[6, 4]} />
        <meshPhysicalMaterial color="#5c936c" transparent opacity={0.12} roughness={0.08} metalness={0.15} transmission={0.12} thickness={0.08} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      {/* Steel frame makes the glass read as a built cell instead of a box. */}
      {frameX.map((x) => <Beam key={`back-x-${x}`} start={[x, 0, -3]} end={[x, 4, -3]} radius={0.055} />)}
      {frameY.map((y) => <Beam key={`back-y-${y}`} start={[-3, y, -3]} end={[3, y, -3]} radius={0.045} />)}
      {[-3, 3].map((x) => <Beam key={`side-v-${x}`} start={[x, 0, -3]} end={[x, 4, 3]} radius={0.047} />)}
      {frameY.map((y) => <Beam key={`side-${y}`} start={[-3, y, -3]} end={[-3, y, 3]} radius={0.04} />)}
      {frameY.map((y) => <Beam key={`side-r-${y}`} start={[3, y, -3]} end={[3, y, 3]} radius={0.04} />)}
      {[-3, 3].map((z) => <Beam key={`front-v-${z}`} start={[-3, 0, z]} end={[-3, 4, z]} radius={0.04} />)}
      {[-3, 3].map((x) => <Beam key={`front-r-${x}`} start={[x, 0, 3]} end={[x, 4, 3]} radius={0.04} />)}
      <Beam start={[-3, 4, 3]} end={[3, 4, 3]} radius={0.045} />
      <Beam start={[-3, 0.12, 3]} end={[3, 0.12, 3]} radius={0.045} />
      {!graduated && <mesh position={[0, 2, 3.02]} onClick={(event) => clickGlass(event, onGlassClick)}>
        <planeGeometry args={[6, 4]} />
        <meshPhysicalMaterial color="#5c936c" transparent opacity={0.055} roughness={0.08} metalness={0.1} transmission={0.08} thickness={0.04} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>}

      <SlidingDoors progress={progress} graduated={graduated} />
      <mesh position={[0, 0.38, 3.17]}>
        <boxGeometry args={[0.28, 0.32, 0.08]} />
        <meshStandardMaterial color="#25352a" metalness={0.75} roughness={0.28} emissive={graduated ? '#7cff91' : '#ff9e32'} emissiveIntensity={graduated ? 0.9 : 0.3} />
      </mesh>
      <mesh position={[0, 0.4, 3.22]}>
        <sphereGeometry args={[0.035, 12, 12]} />
        <meshBasicMaterial color={graduated ? '#caffd1' : '#ffb044'} />
      </mesh>

      <Monitor position={[-1.15, 3.14, -2.99]} accent="#5af18b" label="ARCHIVE" bars={5} />
      <Monitor position={[1.18, 3.14, -2.99]} accent={warning ? '#ff554b' : '#ffb451'} label="CORE TEMP" bars={4} />
      <Console position={[-2.24, 0, 1.2]} color={accent} />
      <Console position={[2.24, 0, 1.2]} color="#ffb34c" />
      <mesh position={[0, 0.32, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.9, 1.04, 0.24, 48]} />
        <meshStandardMaterial color="#34463a" metalness={0.84} roughness={0.24} emissive="#184c29" emissiveIntensity={0.22} />
      </mesh>
      {!lowPower && <ContactShadows position={[0, 0.02, 0]} opacity={0.38} scale={6} blur={2.1} far={3} resolution={256} frames={1} />}
    </>
  );
}

export default function Cell({ progress, graduated, damageStage, lastTrade, onGlassClick, reducedMotion, lowPower = false, soundOn = false, onThud }) {
  const crewCount = graduated ? 0 : damageStage === 0 ? 0 : damageStage === 1 ? 1 : damageStage === 2 ? 2 : damageStage >= 3 ? 3 : 0;
  const crewPositions = [[-2.55, 1.45], [2.55, 0.35], [-2.55, -1.45]];
  return (
    <group>
      <Room progress={progress} graduated={graduated} reducedMotion={reducedMotion} onGlassClick={onGlassClick} lowPower={lowPower} />
      {[-3, 3].map((x) => <Beam key={`roof-side-${x}`} start={[x, 4, -3]} end={[x, 4, 3]} radius={0.05} />)}
      {[-3, 3].map((z) => <Beam key={`roof-depth-${z}`} start={[-3, 4, z]} end={[3, 4, z]} radius={0.05} />)}
      {[-2, 2].map((x) => <Beam key={`roof-brace-${x}`} start={[x, 3.98, -2.9]} end={[x, 3.98, 2.9]} radius={0.024} color={accentColor(progress)} emissive={accentColor(progress)} />)}
      <Damage stage={damageStage} graduated={graduated} lastTrade={lastTrade} reducedMotion={reducedMotion} lowPower={lowPower} />
      {damageStage === 0 && !graduated && <CalmThud soundOn={soundOn} onThud={onThud} />}
      {crewPositions.slice(0, crewCount).map(([x, z], index) => (
        <CrewMember key={index} index={index} position={[x, 0, z]} stage={damageStage} lastTrade={lastTrade} reducedMotion={reducedMotion} />
      ))}
    </group>
  );
}

function accentColor(progress) {
  return progress >= 75 ? '#ff4940' : progress >= 50 ? '#ffa83e' : '#50e887';
}

function SlidingDoors({ progress, graduated }) {
  const leftRef = useRef();
  const rightRef = useRef();
  useFrame((_, delta) => {
    const gap = graduated ? 2.05 : progress >= 80 ? 0.62 : 0;
    if (leftRef.current) leftRef.current.position.x = THREE.MathUtils.damp(leftRef.current.position.x, -0.82 - gap, 2.4, delta);
    if (rightRef.current) rightRef.current.position.x = THREE.MathUtils.damp(rightRef.current.position.x, 0.82 + gap, 2.4, delta);
  });
  return (
    <group>
      {[[-1, leftRef], [1, rightRef]].map(([side, ref]) => (
        <group key={side} ref={ref} position={[side * 0.82, 0, 3.07]}>
          <mesh position={[0, 2, 0]}>
            <planeGeometry args={[1.58, 3.82]} />
            <meshPhysicalMaterial color="#79d895" transparent opacity={0.11} roughness={0.06} transmission={0.12} thickness={0.05} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
          {[-0.76, 0.76].map((x) => <Beam key={`rail-${x}`} start={[x, 0.16, 0.01]} end={[x, 3.92, 0.01]} radius={0.032} color={graduated ? '#a7e9ac' : STEEL} />)}
          <mesh position={[0, 0.37, 0.045]}>
            <boxGeometry args={[1.4, 0.18, 0.022]} />
            <meshStandardMaterial color="#c29242" metalness={0.45} roughness={0.45} />
          </mesh>
          {Array.from({ length: 6 }, (_, index) => (
            <mesh key={index} position={[-0.5 + index * 0.2, 0.37, 0.058]} rotation={[0, 0, -0.55]}>
              <boxGeometry args={[0.06, 0.2, 0.012]} />
              <meshBasicMaterial color="#20271e" />
            </mesh>
          ))}
        </group>
      ))}
      {[-1.62, 1.62].map((x) => <Beam key={`jamb-${x}`} start={[x, 0.16, 3.08]} end={[x, 3.92, 3.08]} radius={0.035} color={graduated ? '#a7e9ac' : STEEL} />)}
      {[0.16, 3.92].map((y) => <Beam key={`header-${y}`} start={[-1.62, y, 3.08]} end={[1.62, y, 3.08]} radius={0.04} color={graduated ? '#a7e9ac' : STEEL} />)}
    </group>
  );
}
