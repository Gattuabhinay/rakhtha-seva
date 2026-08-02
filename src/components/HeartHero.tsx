import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

/** Physiologic lub–dub squeeze (0..1). */
function cardiacSqueeze(phase: number): number {
  const p = ((phase % 1) + 1) % 1;
  const pulse = (a: number, b: number, peak: number) => {
    if (p < a || p > b) return 0;
    const t = (p - a) / (b - a);
    return Math.sin(t * Math.PI) * peak;
  };
  return pulse(0.02, 0.18, 1) + pulse(0.22, 0.38, 0.55);
}

function loadTexture(url: string): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      const tex = new THREE.Texture(img);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      resolve(tex);
    };
    img.onerror = () => reject(new Error(`Failed to load ${url}`));
    img.src = url;
  });
}

/**
 * Photoreal anatomical heart with a real WebGL cardiac cycle —
 * geometry lub–dub, blood-rush tint, orbit controls, ECG sync.
 */
export function HeartHero() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const glowRef = useRef<HTMLDivElement | null>(null);
  const ecgRef = useRef<SVGPolylineElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let frame = 0;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const size = () => ({
      w: Math.max(host.clientWidth, 280),
      h: Math.max(host.clientHeight, 280),
    });

    const scene = new THREE.Scene();
    const { w, h } = size();
    const camera = new THREE.PerspectiveCamera(34, w / h, 0.1, 40);
    camera.position.set(0, 0.04, 2.65);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.className = "heart-webgl-canvas";
    renderer.domElement.setAttribute("aria-label", "Animated anatomical human heart");
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.enablePan = false;
    controls.minDistance = 2;
    controls.maxDistance = 4.2;
    controls.autoRotate = !reduceMotion;
    controls.autoRotateSpeed = 0.7;
    controls.target.set(0, 0.02, 0);

    const root = new THREE.Group();
    scene.add(root);

    const back = new THREE.Mesh(
      new THREE.CircleGeometry(1.1, 64),
      new THREE.MeshBasicMaterial({
        color: 0xc4143a,
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
      }),
    );
    back.position.z = -0.22;
    root.add(back);

    const particleCount = 64;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(particleCount * 3);
    const pPhase = new Float32Array(particleCount);
    for (let i = 0; i < particleCount; i++) pPhase[i] = Math.random();
    pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({
      color: 0xff2a4f,
      size: 0.03,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(pGeo, pMat);
    root.add(points);

    const geo = new THREE.PlaneGeometry(2.2, 2.2, 80, 80);
    const base = Float32Array.from(geo.attributes.position.array as ArrayLike<number>);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const heart = new THREE.Mesh(geo, mat);
    root.add(heart);

    const clock = new THREE.Clock();

    const onResize = () => {
      if (disposed) return;
      const { w: nw, h: nh } = size();
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(host);

    const deform = (squeeze: number, t: number) => {
      const pos = geo.attributes.position.array as Float32Array;
      for (let i = 0; i < pos.length; i += 3) {
        const x0 = base[i];
        const y0 = base[i + 1];
        const z0 = base[i + 2];
        const u = x0 / 2.2 + 0.5;
        const v = y0 / 2.2 + 0.5;
        const dx = u - 0.5;
        const dy = v - 0.48;
        const radial = Math.sqrt(dx * dx + dy * dy);
        const muscle = THREE.MathUtils.smoothstep(0.5, 0.05, radial);
        const compress = squeeze * muscle;
        pos[i] = x0 * (1 - compress * 0.11);
        pos[i + 1] = y0 * (1 - compress * 0.09);
        pos[i + 2] =
          z0 +
          compress * 0.18 +
          Math.sin(t * 2.6 + v * 14) * 0.012 * (1 - squeeze * 0.4) * muscle;
      }
      geo.attributes.position.needsUpdate = true;
    };

    const tick = () => {
      if (disposed) return;
      frame = requestAnimationFrame(tick);
      const t = clock.getElapsedTime();
      const squeeze = reduceMotion ? 0.12 : cardiacSqueeze((t * 74) / 60);

      deform(squeeze, t);

      const beat = 1 + squeeze * 0.05;
      root.scale.set(beat, beat * (1 - squeeze * 0.04), 1);
      root.rotation.y = Math.sin(t * 0.3) * 0.14;
      heart.rotation.x = Math.sin(t * 0.45) * 0.06;

      const rush = 1 - squeeze * 0.06;
      mat.color.setRGB(1, rush, rush * 0.98);
      mat.opacity = 0.96 + squeeze * 0.04;

      back.scale.setScalar(1 + squeeze * 0.2);
      (back.material as THREE.MeshBasicMaterial).opacity = 0.12 + squeeze * 0.24;

      const arr = points.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        const u = (pPhase[i] + t * (0.24 + (i % 7) * 0.016)) % 1;
        const ang = u * Math.PI * 2 + i * 0.12;
        const r = 0.8 + Math.sin(u * Math.PI * 3 + i) * 0.22 + squeeze * 0.14;
        arr[i * 3] = Math.cos(ang) * r;
        arr[i * 3 + 1] = Math.sin(ang * 1.65) * 0.7;
        arr[i * 3 + 2] = Math.sin(ang) * 0.42 - 0.04;
      }
      points.geometry.attributes.position.needsUpdate = true;
      pMat.opacity = 0.28 + squeeze * 0.65;
      pMat.size = 0.02 + squeeze * 0.032;

      if (glowRef.current) {
        glowRef.current.style.opacity = String(0.28 + squeeze * 0.55);
        glowRef.current.style.transform = `scale(${1 + squeeze * 0.32})`;
      }
      if (ecgRef.current) {
        ecgRef.current.style.strokeOpacity = String(0.5 + squeeze * 0.45);
      }

      controls.update();
      renderer.render(scene, camera);
    };

    tick();

    void loadTexture("/hero-heart-bio.png")
      .then((tex) => {
        if (disposed) {
          tex.dispose();
          return;
        }
        tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        mat.map = tex;
        mat.needsUpdate = true;
      })
      .catch(() => {
        mat.color = new THREE.Color("#b01030");
      });

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      ro.disconnect();
      controls.dispose();
      mat.map?.dispose();
      geo.dispose();
      mat.dispose();
      pGeo.dispose();
      pMat.dispose();
      back.geometry.dispose();
      (back.material as THREE.Material).dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === host) {
        host.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="heart-stage heart-live">
      <div className="heart-photo-glow" ref={glowRef} aria-hidden />
      <div className="heart-webgl" ref={hostRef} />
      <div className="heart-ecg" aria-hidden>
        <svg viewBox="0 0 220 30" preserveAspectRatio="none">
          <polyline
            ref={ecgRef}
            className="heart-ecg-line"
            points="0,15 24,15 32,15 38,4 44,26 50,15 78,15 86,15 92,5 98,25 104,15 220,15"
          />
        </svg>
      </div>
      <p className="heart-credit">Live cardiac cycle · drag to orbit</p>
    </div>
  );
}
