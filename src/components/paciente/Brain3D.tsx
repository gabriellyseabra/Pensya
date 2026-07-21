import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";

/* ============================================================
 * Cérebro 3D interativo — modelo anatômico real (brain.glb).
 * Marcadores funcionais são "grudados" na superfície por raycast
 * e, ao passar o mouse, abrem um tooltip com o nome da área, as
 * habilidades em déficit e as que estão sendo estimuladas.
 * ============================================================ */

export type BrainRegion = {
  key: string;
  nome: string;
  status: "estimulacao" | "deficit" | "estavel" | "sem_dados";
  /** direção aproximada da região (frente = +z, direita = +x, cima = +y) */
  dir: [number, number, number];
  /** o que a área é responsável (para o card glass) */
  resp: string;
  deficit: string[];
  estimulo: string[];
  media: number | null;
};

const STATUS_COLOR: Record<BrainRegion["status"], string> = {
  estimulacao: "#8b5cf6",
  deficit: "#f43f5e",
  estavel: "#10b981",
  sem_dados: "#cbd5e1",
};

useGLTF.preload("/brain.glb");

const TARGET_SIZE = 2.4;
// Orientação do modelo importado (o wrapper Sketchfab já entrega Y-up).
const MODEL_ROTATION: [number, number, number] = [0, 0, 0];

type Snapped = { pos: THREE.Vector3 };

function BrainModel({
  regioes,
  onSnap,
}: {
  regioes: BrainRegion[];
  onSnap: (map: Record<string, Snapped>) => void;
}) {
  const { scene } = useGLTF("/brain.glb");
  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.rotation.set(...MODEL_ROTATION);
    clone.updateMatrixWorld(true);
    // Normaliza: centraliza na origem e escala para um tamanho alvo
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const scale = TARGET_SIZE / Math.max(size.x, size.y, size.z);
    clone.scale.setScalar(scale);
    clone.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
    clone.updateMatrixWorld(true);
    // Realça um pouco o material anatômico
    clone.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        const mat = m.material as THREE.MeshStandardMaterial;
        if (mat && "roughness" in mat) {
          // Tinge de rosa suave para combinar com o tema (multiplica a textura)
          mat.color = new THREE.Color("#f2c6d0");
          mat.roughness = Math.min(1, (mat.roughness ?? 0.8) * 0.85);
          mat.metalness = 0;
          mat.envMapIntensity = 0.6;
          mat.needsUpdate = true;
        }
      }
    });
    return clone;
  }, [scene]);

  // Snap dos marcadores na superfície via raycast (de fora para o centro)
  useEffect(() => {
    const meshes: THREE.Mesh[] = [];
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) meshes.push(m);
    });
    const ray = new THREE.Raycaster();
    const out: Record<string, Snapped> = {};
    for (const r of regioes) {
      const dir = new THREE.Vector3(...r.dir).normalize();
      const origin = dir.clone().multiplyScalar(6);
      ray.set(origin, dir.clone().multiplyScalar(-1));
      const hits = ray.intersectObjects(meshes, true);
      if (hits.length > 0) {
        out[r.key] = { pos: hits[0].point.clone().addScaledVector(dir, 0.03) };
      } else {
        out[r.key] = { pos: dir.multiplyScalar(TARGET_SIZE * 0.5) };
      }
    }
    onSnap(out);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, regioes.length]);

  return <primitive object={model} />;
}

function Marker({
  region,
  pos,
  hovered,
  onHover,
}: {
  region: BrainRegion;
  pos: THREE.Vector3;
  hovered: boolean;
  onHover: (k: string | null) => void;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const pulsing = region.status === "estimulacao" || region.status === "deficit";
  const color = STATUS_COLOR[region.status];

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (ringRef.current && pulsing) {
      const s = 1 + Math.sin(t * 3) * 0.25 + 0.4;
      ringRef.current.scale.setScalar(s);
      (ringRef.current.material as THREE.MeshBasicMaterial).opacity =
        0.5 - Math.sin(t * 3) * 0.25;
    }
    if (ref.current) {
      const target = hovered ? 1.8 : 1;
      ref.current.scale.lerp(new THREE.Vector3(target, target, target), 0.2);
    }
  });

  return (
    <group position={pos}>
      {pulsing && (
        <mesh ref={ringRef}>
          <sphereGeometry args={[0.05, 16, 16]} />
          <meshBasicMaterial color={color} transparent opacity={0.4} depthWrite={false} />
        </mesh>
      )}
      <mesh
        ref={ref}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(region.key);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          onHover(null);
          document.body.style.cursor = "auto";
        }}
      >
        <sphereGeometry args={[0.05, 20, 20]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={hovered ? 1 : 0.5}
          roughness={0.3}
        />
      </mesh>
    </group>
  );
}

function Scene({
  regioes,
  hover,
  onHover,
}: {
  regioes: BrainRegion[];
  hover: string | null;
  onHover: (k: string | null) => void;
}) {
  const [snapped, setSnapped] = useState<Record<string, Snapped>>({});

  return (
    <>
      <ambientLight intensity={0.85} />
      <directionalLight position={[3, 4, 5]} intensity={1.15} />
      <directionalLight position={[-4, 1, -3]} intensity={0.55} color="#cbb8ff" />
      <BrainModel regioes={regioes} onSnap={setSnapped} />
      {regioes.map((r) =>
        snapped[r.key] ? (
          <Marker
            key={r.key}
            region={r}
            pos={snapped[r.key].pos}
            hovered={hover === r.key}
            onHover={onHover}
          />
        ) : null,
      )}
      <OrbitControls
        enablePan={false}
        enableZoom
        minDistance={2.8}
        maxDistance={6}
        autoRotate={!hover}
        autoRotateSpeed={0.9}
        enableDamping
        dampingFactor={0.08}
      />
    </>
  );
}

export default function Brain3D({
  regioes,
  hover = null,
  onHover,
}: {
  regioes: BrainRegion[];
  hover?: string | null;
  onHover?: (k: string | null) => void;
}) {
  return (
    <Canvas
      camera={{ position: [2.6, 0.7, 3.2], fov: 40 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      style={{ width: "100%", height: "100%" }}
    >
      <Scene regioes={regioes} hover={hover} onHover={(k) => onHover?.(k)} />
    </Canvas>
  );
}
