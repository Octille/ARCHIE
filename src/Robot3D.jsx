import { Component, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import Cell from './scene/Cell.jsx';
import Robot from './scene/Robot.jsx';
import useDamageLevel from './scene/useDamageLevel.js';

const reducedMotionQuery = '(prefers-reduced-motion: reduce)';
const mobileQuery = '(max-width: 700px), (pointer: coarse)';
const CAMERA_BASE_DISTANCE = 8.6;
const MIN_CAMERA_ZOOM = 0.5;
const MAX_CAMERA_ZOOM = 1.87;

function canRenderWebGL() {
  if (typeof document === 'undefined') return true;
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2') || canvas.getContext('webgl');
    const supported = Boolean(context);
    context?.getExtension('WEBGL_lose_context')?.loseContext();
    return supported;
  } catch {
    return false;
  }
}

function usePreference(query, fallback = false) {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : fallback);
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, [query]);
  return matches;
}

class SceneErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  componentDidCatch(error) { this.props.onUnavailable?.(error?.message ? `3D scene error: ${error.message}` : undefined); }

  render() { return this.state.failed ? null : this.props.children; }
}

function CameraRig({ cameraCommand, lastTrade, reducedMotion, mobile, onCameraEnd }) {
  const controls = useRef();
  const previousShake = useRef(new THREE.Vector3());
  const target = useMemo(() => new THREE.Vector3(0, 1.65, 0), []);

  useEffect(() => {
    if (!controls.current || !cameraCommand) return;
    const orbit = controls.current;
    const radius = CAMERA_BASE_DISTANCE / THREE.MathUtils.clamp(cameraCommand.zoom || 1, MIN_CAMERA_ZOOM, MAX_CAMERA_ZOOM);
    const azimuth = THREE.MathUtils.degToRad((cameraCommand.yaw || 0) - 24);
    const elevation = THREE.MathUtils.degToRad((cameraCommand.pitch || 0) - 7);
    const polar = Math.PI / 2 - elevation;
    orbit.target.copy(target);
    orbit.object.position.set(
      target.x + radius * Math.sin(polar) * Math.sin(azimuth),
      target.y + radius * Math.cos(polar),
      target.z + radius * Math.sin(polar) * Math.cos(azimuth),
    );
    orbit.update();
  }, [cameraCommand?.yaw, cameraCommand?.pitch, cameraCommand?.zoom, target]);

  useEffect(() => () => {
    if (controls.current) controls.current.object.position.sub(previousShake.current);
  }, []);

  const handleEnd = useCallback(() => {
    if (!controls.current || !onCameraEnd) return;
    const control = controls.current;
    onCameraEnd({
      yaw: THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(control.getAzimuthalAngle()) + 24, -32, 32),
      pitch: THREE.MathUtils.clamp(90 - THREE.MathUtils.radToDeg(control.getPolarAngle()) + 7, -12, 16),
      zoom: THREE.MathUtils.clamp(CAMERA_BASE_DISTANCE / control.getDistance(), MIN_CAMERA_ZOOM, MAX_CAMERA_ZOOM),
    });
  }, [onCameraEnd]);

  useFrame(({ camera, clock }) => {
    if (!controls.current) return;
    camera.position.sub(previousShake.current);
    previousShake.current.set(0, 0, 0);
    const age = Date.now() - Number(lastTrade?.at || 0);
    const isBuy = lastTrade?.side === 'buy' && age >= 0 && age < 520;
    if (isBuy && !reducedMotion) {
      const strength = lastTrade.big ? 0.09 : 0.035;
      const envelope = 1 - age / 520;
      previousShake.current.set(
        Math.sin(clock.elapsedTime * 63) * strength * envelope,
        Math.cos(clock.elapsedTime * 57) * strength * envelope * 0.65,
        0,
      );
      camera.position.add(previousShake.current);
    }
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      enableZoom
      zoomSpeed={0.7}
      enableDamping
      dampingFactor={0.075}
      minAzimuthAngle={-1.02}
      maxAzimuthAngle={1.02}
      minPolarAngle={0.98}
      maxPolarAngle={2.12}
      minDistance={CAMERA_BASE_DISTANCE / MAX_CAMERA_ZOOM}
      maxDistance={CAMERA_BASE_DISTANCE / MIN_CAMERA_ZOOM}
      autoRotate={!reducedMotion && !mobile}
      autoRotateSpeed={0.12}
      onEnd={handleEnd}
    />
  );
}

function SceneContents({ mood, progress, graduated, preview, lastTrade, speech, soundOn, audioReady, fallbackSpeechAt, onRobotClick, onGlassClick, camera, onCameraEnd, reducedMotion, mobile, onThud }) {
  const damage = useDamageLevel(progress, graduated, preview);
  const lowPower = mobile;
  const alarmMotion = reducedMotion || mobile;
  return (
    <>
      <CameraRig cameraCommand={camera} lastTrade={lastTrade} reducedMotion={alarmMotion} mobile={mobile} onCameraEnd={onCameraEnd} />
      <Cell progress={damage.progress} graduated={damage.graduated} damageStage={damage.stage} lastTrade={lastTrade} onGlassClick={onGlassClick} reducedMotion={alarmMotion} lowPower={lowPower} soundOn={soundOn} onThud={onThud} />
      <Robot mood={mood} progress={damage.progress} graduated={damage.graduated} lastTrade={lastTrade} speech={speech} soundOn={soundOn} audioReady={audioReady} fallbackSpeechAt={fallbackSpeechAt} reducedMotion={reducedMotion} onRobotClick={onRobotClick} />
      {!mobile && !reducedMotion && (
        <EffectComposer multisampling={0}>
          <Bloom intensity={0.42} luminanceThreshold={0.72} luminanceSmoothing={0.22} mipmapBlur />
          <Vignette offset={0.22} darkness={0.62} eskil={false} />
        </EffectComposer>
      )}
    </>
  );
}

export default function Robot3D({
  mood = 'idle',
  progress = 0,
  graduated = false,
  developmentPreview = false,
  lastTrade = null,
  speech = null,
  soundOn = false,
  audioReady = true,
  fallbackSpeechAt = 0,
  camera = { yaw: -4, pitch: 4, zoom: 1 },
  active = true,
  onRobotClick,
  onGlassClick,
  onCameraEnd,
  onThud,
  onReady,
  onUnavailable,
}) {
  const supportsWebGL = useMemo(canRenderWebGL, []);
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || document.visibilityState !== 'hidden');
  const reducedMotion = usePreference(reducedMotionQuery);
  const mobile = usePreference(mobileQuery);
  const [contextLost, setContextLost] = useState(false);
  const dpr = useMemo(() => mobile ? [1, 1.25] : [1, 1.75], [mobile]);
  const gl = useMemo(() => ({ antialias: !mobile, powerPreference: 'high-performance', alpha: true, preserveDrawingBuffer: false }), [mobile]);
  const cameraOptions = useMemo(() => ({ position: [3.6, 1.1, 8.3], fov: 39, near: 0.1, far: 40 }), []);
  const handleCreated = useCallback(({ gl: renderer }) => {
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.domElement.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      setContextLost(true);
      onUnavailable?.('The 3D graphics context was lost. Reload the page to restart the scene.');
    }, { once: true });
    setContextLost(false);
    onReady?.();
  }, [onReady, onUnavailable]);

  useEffect(() => {
    const update = () => setVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  useEffect(() => {
    if (!supportsWebGL) onUnavailable?.('This browser could not create a WebGL graphics context. Enable hardware acceleration or use a browser with WebGL support.');
    if (contextLost) onUnavailable?.('The 3D graphics context was lost. Reload the page to restart the scene.');
  }, [supportsWebGL, contextLost, onUnavailable]);

  if (!supportsWebGL || contextLost) return null;
  return (
    <div className="robot-3d-canvas-wrap" aria-hidden="true">
      <Canvas
        shadows={!mobile}
        dpr={dpr}
        frameloop={visible && active ? 'always' : 'never'}
        camera={cameraOptions}
        gl={gl}
        onCreated={handleCreated}
        onPointerMissed={() => {}}
      >
        <SceneErrorBoundary onUnavailable={onUnavailable}>
          <Suspense fallback={null}>
            <SceneContents mood={mood} progress={progress} graduated={graduated} preview={developmentPreview} lastTrade={lastTrade} speech={speech} soundOn={soundOn} audioReady={audioReady} fallbackSpeechAt={fallbackSpeechAt} onRobotClick={onRobotClick} onGlassClick={onGlassClick} camera={camera} onCameraEnd={onCameraEnd} reducedMotion={reducedMotion} mobile={mobile} onThud={onThud} />
          </Suspense>
        </SceneErrorBoundary>
      </Canvas>
    </div>
  );
}
