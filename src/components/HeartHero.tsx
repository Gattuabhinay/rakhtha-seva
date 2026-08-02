import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

/** Physiologic lub–dub squeeze curve (0..1), phase in [0,1). */
function cardiacSqueeze(phase: number): number {
  const p = ((phase % 1) + 1) % 1;
  const pulse = (a: number, b: number, peak: number) => {
    if (p < a || p > b) return 0;
    const t = (p - a) / (b - a);
    return Math.sin(t * Math.PI) * peak;
  };
  // S1 (lub) stronger + S2 (dub) softer — real cardiac feel
  return pulse(0.0, 0.16, 1) + pulse(0.2, 0.34, 0.52);
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

/** Build ECG polyline points for current cardiac phase (morphing wave). */
function ecgPoints(phase: number, width = 220, height = 30): string {
  const mid = height * 0.52;
  const pts: string[] = [];
  const n = 56;
  for (let i = 0; i <= n; i++) {
    const x = (i / n) * width;
    const local = (i / n + (1 - phase)) % 1;
    let y = mid;
    // QRS morph spike near phase 0
    if (local > 0.02 && local < 0.08) {
      const t = (local - 0.02) / 0.06;
      y = mid - Math.sin(t * Math.PI) * 12;
    } else if (local > 0.08 && local < 0.12) {
      const t = (local - 0.08) / 0.04;
      y = mid + Math.sin(t * Math.PI) * 7;
    } else if (local > 0.22 && local < 0.3) {
      // smaller T / second beat echo
      const t = (local - 0.22) / 0.08;
      y = mid - Math.sin(t * Math.PI) * 5;
    }
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return pts.join(" ");
}

/**
 * Photoreal heart with live WebGL morph —
 * lub–dub geometry deform, blood-rush tint, orbit, ECG sync.
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
    camera.position.set(0.08, 0.06, 2.55);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.className = "heart-webgl-canvas";
    renderer.domElement.setAttribute("aria-label", "Animated anatomical human heart");
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 1.95;
    controls.maxDistance = 4.0;
    controls.autoRotate = !reduceMotion;
    controls.autoRotateSpeed = 0.55;
    controls.target.set(0, 0.02, 0);

    const root = new THREE.Group();
    scene.add(root);

    // Soft key + rim so the morph reads in depth
    const key = new THREE.DirectionalLight(0xfff1f2, 1.15);
    key.position.set(1.2, 1.4, 2.2);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffb4c0, 0.45);
    fill.position.set(-1.6, 0.2, 1.2);
    scene.add(fill);
    scene.add(new THREE.AmbientLight(0xffe4e8, 0.55));

    const back = new THREE.Mesh(
      new THREE.CircleGeometry(1.15, 72),
      new THREE.MeshBasicMaterial({
        color: 0xc4143a,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
      }),
    );
    back.position.z = -0.28;
    root.add(back);

    const ringGeo = new THREE.RingGeometry(0.92, 1.05, 80);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xff2a4f,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.z = -0.12;
    root.add(ring);

    const particleCount = 96;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(particleCount * 3);
    const pPhase = new Float32Array(particleCount);
    for (let i = 0; i < particleCount; i++) pPhase[i] = Math.random();
    pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({
      color: 0xff3b5c,
      size: 0.028,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(pGeo, pMat);
    root.add(points);

    // High-res plane for smooth morph (not faceted)
    const geo = new THREE.PlaneGeometry(2.15, 2.15, 96, 96);
    const base = Float32Array.from(geo.attributes.position.array as ArrayLike<number>);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      side: THREE.DoubleSide,
      roughness: 0.55,
      metalness: 0.08,
    });
    const heart = new THREE.Mesh(geo, mat);
    root.add(heart);

    const clock = new THREE.Clock();
    let bpm = 72;

    const onResize = () => {
      if (disposed) return;
      const { w: nw, h: nh } = size();
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(host);

    /** Organic morph: ventricle bias + apex lift + surface ripple */
    const deform = (squeeze: number, t: number) => {
      const pos = geo.attributes.position.array as Float32Array;
      for (let i = 0; i < pos.length; i += 3) {
        const x0 = base[i];
        const y0 = base[i + 1];
        const z0 = base[i + 2];
        const u = x0 / 2.15 + 0.5;
        const v = y0 / 2.15 + 0.5;
        const dx = u - 0.48;
        const dy = v - 0.5;
        const radial = Math.sqrt(dx * dx + dy * dy * 1.15);
        const muscle = THREE.MathUtils.smoothstep(0.55, 0.04, radial);
        // Left ventricle (viewer right) contracts a touch more
        const side = THREE.MathUtils.clamp(0.55 + dx * 0.9, 0.35, 1);
        const compress = squeeze * muscle * side;
        const apex = THREE.MathUtils.smoothstep(0.15, 0.55, 1 - v) * squeeze * 0.1;

        pos[i] = x0 * (1 - compress * 0.13) + dx * compress * 0.02;
        pos[i + 1] = y0 * (1 - compress * 0.1) - apex * 0.35;
        pos[i + 2] =
          z0 +
          compress * 0.22 +
          Math.sin(t * 2.4 + v * 16 + u * 9) * 0.014 * (1 - squeeze * 0.45) * muscle;
      }
      geo.attributes.position.needsUpdate = true;
      geo.computeVertexNormals();
    };

    const tick = () => {
      if (disposed) return;
      frame = requestAnimationFrame(tick);
      const t = clock.getElapsedTime();
      const phase = reduceMotion ? 0.08 : (t * bpm) / 60;
      const phase01 = phase % 1;
      const squeeze = reduceMotion ? 0.14 : cardiacSqueeze(phase01);

      deform(squeeze, t);

      // Whole-organ morph scale (systole shrink)
      const beatX = 1 + squeeze * 0.04;
      const beatY = 1 - squeeze * 0.055;
      root.scale.set(beatX, beatY, 1 + squeeze * 0.08);
      root.rotation.y = Math.sin(t * 0.28) * 0.16;
      root.rotation.z = Math.sin(t * 0.19) * 0.03;
      heart.rotation.x = Math.sin(t * 0.4) * 0.05;

      // Blood-rush color morph on systole
      const rush = 1 - squeeze * 0.1;
      mat.color.setRGB(1, rush, rush * 0.97);
      mat.emissive.setRGB(squeeze * 0.18, 0, squeeze * 0.04);
      mat.opacity = 0.97 + squeeze * 0.03;

      back.scale.setScalar(1 + squeeze * 0.28);
      (back.material as THREE.MeshBasicMaterial).opacity = 0.1 + squeeze * 0.32;
      ring.scale.setScalar(1 + squeeze * 0.18);
      ringMat.opacity = 0.12 + squeeze * 0.35;
      ring.rotation.z = t * 0.15;

      // Particles morph outward on each beat
      const arr = points.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        const speed = 0.2 + (i % 9) * 0.014;
        const u = (pPhase[i] + t * speed) % 1;
        const ang = u * Math.PI * 2 + i * 0.11;
        const burst = squeeze * 0.22;
        const r = 0.72 + Math.sin(u * Math.PI * 2 + i) * 0.2 + burst;
        arr[i * 3] = Math.cos(ang) * r * (1 + (i % 3) * 0.04);
        arr[i * 3 + 1] = Math.sin(ang * 1.55) * (0.62 + burst * 0.3);
        arr[i * 3 + 2] = Math.sin(ang * 0.9) * 0.38 - 0.02 + squeeze * 0.06;
      }
      points.geometry.attributes.position.needsUpdate = true;
      pMat.opacity = 0.25 + squeeze * 0.7;
      pMat.size = 0.018 + squeeze * 0.036;

      if (glowRef.current) {
        glowRef.current.style.opacity = String(0.26 + squeeze * 0.6);
        glowRef.current.style.transform = `scale(${1 + squeeze * 0.38})`;
      }
      if (ecgRef.current) {
        ecgRef.current.setAttribute("points", ecgPoints(phase01));
        ecgRef.current.style.strokeOpacity = String(0.55 + squeeze * 0.45);
      }

      // Subtle BPM drift for living feel
      if (!reduceMotion) bpm = 70 + Math.sin(t * 0.07) * 4;

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
        mat.color.set("#b01030");
        mat.emissive.set("#4a0510");
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
      ringGeo.dispose();
      ringMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === host) {
        host.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="heart-stage heart-live">
      <div className="heart-photo-glow" ref={glowRef} aria-hidden />
      <div className="heart-morph-veil" aria-hidden />
      <div className="heart-webgl" ref={hostRef} />
      <div className="heart-ecg" aria-hidden>
        <svg viewBox="0 0 220 30" preserveAspectRatio="none">
          <polyline
            ref={ecgRef}
            className="heart-ecg-line"
            points="0,15 220,15"
          />
        </svg>
      </div>
      <p className="heart-credit">Live morph · lub–dub cycle · drag to orbit</p>
    </div>
  );
}
