import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { COR_INTERVENCAO, REGIAO_POR_KEY, pontosDaRegiao, type RegiaoDef } from "@/lib/neuro-mapa";

/* ============================================================
 * Cérebro 3D — modelo anatômico real (brain.glb).
 *
 * Dois canais visuais independentes, para que um nunca apague o outro:
 *   COR do marcador  → desempenho na avaliação (paleta das rubricas)
 *   HALO pulsante    → a região está sendo trabalhada na intervenção
 *
 * Posicionamento: coordenadas anatômicas normalizadas (não regex, não
 * "direção genérica"). Regiões corticais são projetadas na superfície;
 * estruturas profundas (hipocampo, amígdala, cingulado) ficam no interior
 * e só aparecem corretamente no modo corte, com o córtex translúcido.
 * ============================================================ */

export type BrainRegion = {
  key: string;
  /** Canal 1 — desempenho (percentil ponderado das variáveis mapeadas). */
  desempenho: number | null;
  /** Cor já resolvida pela rubrica do sistema. */
  cor: string;
  /** Canal 2 — intensidade da intervenção em curso (0 = nenhuma, 1 = forte). */
  intervencao: number;
  /** Canal 3 — variação em pontos de percentil desde a avaliação inicial. */
  delta: number | null;
};

/** Rede funcional desenhada como arco entre as regiões que a compõem. */
export type BrainRede = {
  key: string;
  regioes: string[];
  cor: string;
  /** 0..1 — o quanto a rede está implicada; vira espessura do arco. */
  intensidade: number;
};

/** Variação relevante o bastante para virar seta — abaixo disso é ruído. */
const DELTA_MINIMO = 5;
const COR_GANHO = "#22c55e";
const COR_PERDA = "#f43f5e";

useGLTF.preload("/brain.glb");

const TARGET_SIZE = 2.4;
const MODEL_ROTATION: [number, number, number] = [0, 0, 0];

/** Posição de cada marcador, já no espaço da cena. */
type Ponto = { regiaoKey: string; pos: THREE.Vector3; profunda: boolean };

function BrainModel({
  regioesDef,
  modoCorte,
  onPontos,
}: {
  regioesDef: RegiaoDef[];
  modoCorte: boolean;
  onPontos: (p: Ponto[]) => void;
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
    // Materiais clonados por mesh — o modo corte altera opacidade sem
    // contaminar outras instâncias do GLTF em cache.
    clone.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.material) {
        const mat = (m.material as THREE.MeshStandardMaterial).clone();
        mat.color = new THREE.Color("#f2c6d0");
        mat.roughness = Math.min(1, (mat.roughness ?? 0.8) * 0.85);
        mat.metalness = 0;
        mat.envMapIntensity = 0.6;
        mat.needsUpdate = true;
        m.material = mat;
      }
    });
    return clone;
  }, [scene]);

  // Modo corte: córtex translúcido para revelar as estruturas profundas.
  useEffect(() => {
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.material) return;
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.transparent = modoCorte;
      mat.opacity = modoCorte ? 0.24 : 1;
      mat.depthWrite = !modoCorte;
      mat.needsUpdate = true;
    });
  }, [model, modoCorte]);

  // Posiciona os marcadores a partir das coordenadas anatômicas normalizadas.
  useEffect(() => {
    const meshes: THREE.Mesh[] = [];
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) meshes.push(m);
    });

    const box = new THREE.Box3().setFromObject(model);
    const meia = box.getSize(new THREE.Vector3()).multiplyScalar(0.5);
    const centro = box.getCenter(new THREE.Vector3());
    const raio = Math.max(meia.x, meia.y, meia.z);
    const ray = new THREE.Raycaster();
    const out: Ponto[] = [];

    for (const def of regioesDef) {
      for (const [nx, ny, nz] of pontosDaRegiao(def)) {
        const alvo = new THREE.Vector3(
          centro.x + nx * meia.x,
          centro.y + ny * meia.y,
          centro.z + nz * meia.z,
        );

        if (def.profunda) {
          // Estrutura interna: fica onde a anatomia manda, sem projetar na casca.
          out.push({ regiaoKey: def.key, pos: alvo, profunda: true });
          continue;
        }

        // Cortical: projeta radialmente na superfície externa do modelo.
        const dir = alvo.clone().sub(centro);
        if (dir.lengthSq() === 0) dir.set(0, 0, 1);
        dir.normalize();
        const origem = centro.clone().addScaledVector(dir, raio * 3);
        ray.set(origem, dir.clone().multiplyScalar(-1));
        const hits = ray.intersectObjects(meshes, true);
        const pos =
          hits.length > 0 ? hits[0].point.clone().addScaledVector(dir, 0.035) : alvo.clone();
        out.push({ regiaoKey: def.key, pos, profunda: false });
      }
    }
    onPontos(out);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, regioesDef]);

  return <primitive object={model} />;
}

function Marker({
  ponto,
  dados,
  hovered,
  modoCorte,
  onHover,
}: {
  ponto: Ponto;
  dados: BrainRegion;
  hovered: boolean;
  modoCorte: boolean;
  onHover: (k: string | null) => void;
}) {
  const coreRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const emIntervencao = dados.intervencao > 0;
  // Marcador profundo precisa furar o córtex para ser visto no modo corte.
  const atravessa = ponto.profunda && modoCorte;

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (haloRef.current && emIntervencao) {
      const amp = 0.18 + 0.22 * dados.intervencao;
      haloRef.current.scale.setScalar(1.5 + Math.sin(t * 2.4) * amp);
      (haloRef.current.material as THREE.MeshBasicMaterial).opacity =
        (0.42 - Math.sin(t * 2.4) * 0.2) * (0.5 + 0.5 * dados.intervencao);
    }
    if (coreRef.current) {
      const alvo = hovered ? 1.75 : 1;
      coreRef.current.scale.lerp(new THREE.Vector3(alvo, alvo, alvo), 0.2);
    }
  });

  return (
    <group position={ponto.pos}>
      {/* Canal 2 — intervenção: halo lilás, deliberadamente fora da paleta
          de desempenho para não ser lido como "nota". */}
      {emIntervencao && (
        <mesh ref={haloRef} renderOrder={atravessa ? 3 : 0}>
          <sphereGeometry args={[0.05, 16, 16]} />
          <meshBasicMaterial
            color={COR_INTERVENCAO}
            transparent
            opacity={0.4}
            depthWrite={false}
            depthTest={!atravessa}
          />
        </mesh>
      )}
      {/* Canal 1 — desempenho: cor da rubrica. */}
      <mesh
        ref={coreRef}
        renderOrder={atravessa ? 4 : 0}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(dados.key);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          onHover(null);
          document.body.style.cursor = "auto";
        }}
      >
        <sphereGeometry args={[0.05, 20, 20]} />
        <meshStandardMaterial
          color={dados.cor}
          emissive={dados.cor}
          emissiveIntensity={hovered ? 0.9 : 0.4}
          roughness={0.3}
          depthTest={!atravessa}
        />
      </mesh>
      {/* Canal 3 — evolução: seta para cima (ganho) ou para baixo (perda). */}
      {dados.delta != null && Math.abs(dados.delta) >= DELTA_MINIMO && (
        <mesh
          position={[0, 0.11, 0]}
          rotation={[dados.delta > 0 ? 0 : Math.PI, 0, 0]}
          renderOrder={atravessa ? 4 : 0}
        >
          <coneGeometry args={[0.028, 0.06, 12]} />
          <meshBasicMaterial
            color={dados.delta > 0 ? COR_GANHO : COR_PERDA}
            depthTest={!atravessa}
          />
        </mesh>
      )}
    </group>
  );
}

/**
 * Arcos das redes funcionais. Para cada par de regiões vizinhas na rede,
 * liga os DOIS pontos MAIS PRÓXIMOS entre si — assim uma rede lateralizada
 * (leitura, linguagem) não atravessa a linha média sem necessidade.
 */
function RedeArcos({
  rede,
  pontos,
  destacada,
}: {
  rede: BrainRede;
  pontos: Ponto[];
  destacada: boolean;
}) {
  const geometria = useMemo(() => {
    const porRegiao = new Map<string, THREE.Vector3[]>();
    for (const p of pontos) {
      if (!porRegiao.has(p.regiaoKey)) porRegiao.set(p.regiaoKey, []);
      porRegiao.get(p.regiaoKey)!.push(p.pos);
    }
    const presentes = rede.regioes.filter((k) => porRegiao.get(k)?.length);
    if (presentes.length < 2) return null;

    const raio = (0.005 + 0.013 * rede.intensidade) * (destacada ? 1.9 : 1);
    const geometrias: THREE.TubeGeometry[] = [];

    for (let i = 0; i < presentes.length - 1; i++) {
      const as = porRegiao.get(presentes[i])!;
      const bs = porRegiao.get(presentes[i + 1])!;
      // Par de pontos mais próximo entre as duas regiões
      let melhor: [THREE.Vector3, THREE.Vector3] | null = null;
      let menor = Infinity;
      for (const a of as) {
        for (const b of bs) {
          const d = a.distanceToSquared(b);
          if (d < menor) {
            menor = d;
            melhor = [a, b];
          }
        }
      }
      if (!melhor) continue;
      const [a, b] = melhor;
      // Meio empurrado para fora, para o arco não afundar no córtex
      const meio = a.clone().lerp(b, 0.5);
      meio.multiplyScalar(1 + 0.16 * (1 - rede.intensidade * 0.4));
      const curva = new THREE.QuadraticBezierCurve3(a, meio, b);
      geometrias.push(new THREE.TubeGeometry(curva, 22, raio, 6, false));
    }
    if (geometrias.length === 0) return null;
    return geometrias;
  }, [rede, pontos, destacada]);

  // TubeGeometry não é liberada pelo GC do three: descarta na troca.
  useEffect(() => {
    return () => {
      for (const g of geometria ?? []) g.dispose();
    };
  }, [geometria]);

  if (!geometria) return null;
  return (
    <>
      {geometria.map((g, i) => (
        <mesh key={i} geometry={g} renderOrder={1}>
          <meshBasicMaterial
            color={rede.cor}
            transparent
            opacity={destacada ? 0.85 : 0.3 + 0.35 * rede.intensidade}
            depthWrite={false}
          />
        </mesh>
      ))}
    </>
  );
}

function Scene({
  regioes,
  redes,
  hover,
  hoverRede,
  modoCorte,
  girar,
  onHover,
}: {
  regioes: BrainRegion[];
  redes: BrainRede[];
  hover: string | null;
  hoverRede: string | null;
  modoCorte: boolean;
  girar: boolean;
  onHover: (k: string | null) => void;
}) {
  const [pontos, setPontos] = useState<Ponto[]>([]);

  const porKey = useMemo(() => {
    const m: Record<string, BrainRegion> = {};
    for (const r of regioes) m[r.key] = r;
    return m;
  }, [regioes]);

  // Só posiciona as regiões que de fato temos para exibir.
  const regioesDef = useMemo(
    () => regioes.map((r) => REGIAO_POR_KEY[r.key]).filter(Boolean) as RegiaoDef[],
    [regioes],
  );

  const pontosVisiveis = useMemo(
    () => (modoCorte ? pontos : pontos.filter((p) => !p.profunda)),
    [pontos, modoCorte],
  );

  return (
    <>
      <ambientLight intensity={0.85} />
      <directionalLight position={[3, 4, 5]} intensity={1.15} />
      <directionalLight position={[-4, 1, -3]} intensity={0.55} color="#cbb8ff" />
      <BrainModel regioesDef={regioesDef} modoCorte={modoCorte} onPontos={setPontos} />
      {/* Arcos primeiro: as redes são o pano de fundo, não o assunto.
          Fora do modo corte, estruturas profundas não entram no traçado —
          seus marcadores estão ocultos e o arco mergulharia no córtex. */}
      {redes.map((r) => (
        <RedeArcos
          key={r.key}
          rede={r}
          pontos={pontosVisiveis}
          destacada={hoverRede === r.key || (!!hover && r.regioes.includes(hover))}
        />
      ))}
      {pontos.map((p, i) => {
        const dados = porKey[p.regiaoKey];
        if (!dados) return null;
        // Estrutura profunda fora do modo corte ficaria escondida dentro do
        // córtex opaco: some, em vez de virar um ponto flutuante enganoso.
        if (p.profunda && !modoCorte) return null;
        return (
          <Marker
            key={`${p.regiaoKey}-${i}`}
            ponto={p}
            dados={dados}
            hovered={hover === p.regiaoKey}
            modoCorte={modoCorte}
            onHover={onHover}
          />
        );
      })}
      <OrbitControls
        enablePan={false}
        enableZoom
        minDistance={2.8}
        maxDistance={6}
        autoRotate={girar && !hover}
        autoRotateSpeed={0.9}
        enableDamping
        dampingFactor={0.08}
      />
    </>
  );
}

export default function Brain3D({
  regioes,
  redes = [],
  hover = null,
  hoverRede = null,
  modoCorte = false,
  girar = false,
  onHover,
}: {
  regioes: BrainRegion[];
  /** Redes funcionais a desenhar como arcos. Vazio = só os marcadores. */
  redes?: BrainRede[];
  hover?: string | null;
  hoverRede?: string | null;
  /** Córtex translúcido, revelando hipocampo, amígdala e cingulado. */
  modoCorte?: boolean;
  /** Rotação automática — desligada por padrão: atrapalha conduzir a devolutiva. */
  girar?: boolean;
  onHover?: (k: string | null) => void;
}) {
  return (
    <Canvas
      camera={{ position: [2.6, 0.7, 3.2], fov: 40 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      style={{ width: "100%", height: "100%" }}
    >
      <Scene
        regioes={regioes}
        redes={redes}
        hover={hover}
        hoverRede={hoverRede}
        modoCorte={modoCorte}
        girar={girar}
        onHover={(k) => onHover?.(k)}
      />
    </Canvas>
  );
}
