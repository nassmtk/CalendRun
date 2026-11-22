import * as THREE from "three";
import { A, tokHex, MONTHS, CAT, L, xOf, dayOf, layout } from "./layout.js";

const tok = (n) => new THREE.Color(tokHex(n));

/* =========================================================
   Scène WebGL
   ========================================================= */
export function mountScene(host) {
  const tip = document.getElementById("hero-tip");
  const items = layout(A.races);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(tok("--bg-0"), 70, 200);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 400);
  const world = new THREE.Group();
  world.rotation.y = -0.2; // légère perspective : décembre un peu plus proche // la saison comme une piste : janvier au premier plan, décembre vers l'horizon
  scene.add(world);

  /* ---------- sol : courbes de niveau orange très discrètes ---------- */
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(160, 110, 1, 1).rotateX(-Math.PI / 2),
    new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uColor: { value: tok("--accent") }, uTime: { value: 0 } },
      vertexShader: `varying vec2 vP; void main(){ vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        varying vec2 vP; uniform vec3 uColor; uniform float uTime;
        float h(vec2 p){
          return sin(p.x*.045+1.3)*cos(p.y*.06) + .55*sin(p.x*.09-p.y*.07+2.) + .3*cos(p.x*.16+p.y*.13);
        }
        void main(){
          float v = h(vP * 1.6) * 3.5;
          float f = abs(fract(v) - .5) / fwidth(v);
          float line = 1. - clamp(f, 0., 1.);
          float g = max(abs(fract(vP.x/5.)-.5)/fwidth(vP.x/5.), 0.);
          float grid = (1. - clamp(g, 0., 1.)) * .25;
          float fade = smoothstep(70., 18., length(vP * vec2(.8, 1.3)));
          float a = (line * .16 + grid * .05) * fade;
          gl_FragColor = vec4(uColor, a);
        }`
    })
  );
  floor.position.y = -0.01;
  world.add(floor);

  /* ---------- ligne de temps + graduations des mois ---------- */
  const axis = new THREE.Mesh(
    new THREE.PlaneGeometry(2 * L, 0.1).rotateX(-Math.PI / 2),
    new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { a: { value: tok("--accent") }, b: { value: tok("--accent-2") }, uDraw: { value: 0 } },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: "varying vec2 vUv; uniform vec3 a; uniform vec3 b; uniform float uDraw; void main(){ if (vUv.x > uDraw) discard; gl_FragColor = vec4(mix(a,b,vUv.x), .9); }"
    })
  );
  axis.position.set(0, 0.02, 3.2);
  world.add(axis);

  const labelTex = (text) => {
    const c = document.createElement("canvas"); c.width = 256; c.height = 64;
    const g = c.getContext("2d");
    g.font = "600 30px 'JetBrains Mono', monospace"; g.fillStyle = tokHex("--muted"); g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(text, 128, 32);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  };
  const tickMat = new THREE.LineBasicMaterial({ color: tok("--accent"), transparent: true, opacity: 0.35 });
  const tickPts = [];
  for (let m = 0; m < 12; m++) {
    const x = xOf(dayOf(new Date(2027, m, 1)));
    tickPts.push(x, 0.02, 2.6, x, 0.02, 3.8);
    const mid = xOf(dayOf(new Date(2027, m, 15)));
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: labelTex(MONTHS[m]), transparent: true, depthWrite: false }));
    lab.position.set(mid, 0.03, 4.6);
    world.add(lab);
  }
  const ticks = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(tickPts, 3)), tickMat);
  world.add(ticks);

  /* ---------- colonnes (instanciées) ---------- */
  const N = items.length;
  const box = new THREE.BoxGeometry(0.42, 1, 0.42).translate(0, 0.5, 0);
  const aColor = new Float32Array(N * 3), aDelay = new Float32Array(N), aIndex = new Float32Array(N);
  const colMat = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: { uTime: { value: 0 }, uHover: { value: -1 }, uWhite: { value: tok("--text") } },
    vertexShader: `
      attribute vec3 aColor; attribute float aDelay; attribute float aIndex;
      uniform float uTime; uniform float uHover;
      varying vec3 vC; varying float vY; varying float vH; varying vec3 vN;
      void main(){
        float g = clamp((uTime - aDelay) / .9, 0., 1.);
        g = 1. - pow(1. - g, 4.);
        vec3 p = position; p.y *= max(g, .001);
        vC = aColor; vY = position.y; vH = step(abs(aIndex - uHover), .5); vN = normal;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `
      varying vec3 vC; varying float vY; varying float vH; varying vec3 vN; uniform vec3 uWhite;
      void main(){
        float side = .55 + .45 * abs(vN.x) + .25 * vN.y;
        vec3 c = vC * (.28 + .9 * pow(vY, 1.4)) * side;
        c = mix(c, uWhite, vH * (.35 + .4 * vY));
        float a = .55 + .45 * vY + vH * .3;
        gl_FragColor = vec4(c * (1. + vH * .6), a);
      }`
  });
  const cols = new THREE.InstancedMesh(box, colMat, N);
  const m4 = new THREE.Matrix4(), tops = new Float32Array(N * 3), topCol = new Float32Array(N * 3), topSize = new Float32Array(N);
  items.forEach((it, i) => {
    m4.makeScale(1, it.h, 1).setPosition(it.x, 0, it.z);
    cols.setMatrixAt(i, m4);
    const c = tok(it.cat);
    aColor.set([c.r, c.g, c.b], i * 3); topCol.set([c.r, c.g, c.b], i * 3);
    aDelay[i] = 0.25 + (it.day / 364) * 1.6 + Math.abs(it.z) * 0.03;
    aIndex[i] = i;
    tops.set([it.x, it.h, it.z], i * 3);
    topSize[i] = it.r.compact ? 2.2 : 3.4;
    it.top = new THREE.Vector3(it.x, it.h, it.z);
  });
  box.setAttribute("aColor", new THREE.InstancedBufferAttribute(aColor, 3));
  box.setAttribute("aDelay", new THREE.InstancedBufferAttribute(aDelay, 1));
  box.setAttribute("aIndex", new THREE.InstancedBufferAttribute(aIndex, 1));
  cols.instanceMatrix.needsUpdate = true;
  cols.computeBoundingSphere();
  world.add(cols);
  // zone de survol plus large que la colonne visible (colonnes fines = cibles difficiles)
  const hit = new THREE.InstancedMesh(new THREE.BoxGeometry(1.3, 1, 1.3).translate(0, 0.5, 0), new THREE.MeshBasicMaterial(), N);
  hit.visible = false;
  for (let i = 0; i < N; i++) { cols.getMatrixAt(i, m4); hit.setMatrixAt(i, m4); }
  hit.computeBoundingSphere();
  world.add(hit);

  // halo au sommet de chaque colonne
  const glowTex = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 64;
    const g = c.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.2, "rgba(255,255,255,.8)"); gr.addColorStop(0.55, "rgba(255,255,255,.15)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const topGeo = new THREE.BufferGeometry();
  topGeo.setAttribute("position", new THREE.BufferAttribute(tops, 3));
  topGeo.setAttribute("aColor", new THREE.BufferAttribute(topCol, 3));
  topGeo.setAttribute("aSize", new THREE.BufferAttribute(topSize, 1));
  topGeo.setAttribute("aDelay", new THREE.BufferAttribute(aDelay, 1));
  topGeo.setAttribute("aIndex", new THREE.BufferAttribute(aIndex, 1));
  const topMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTex: { value: glowTex }, uTime: { value: 0 }, uHover: { value: -1 }, uPR: { value: renderer.getPixelRatio() } },
    vertexShader: `
      attribute vec3 aColor; attribute float aSize; attribute float aDelay; attribute float aIndex;
      uniform float uTime; uniform float uHover; uniform float uPR;
      varying vec3 vC; varying float vA;
      void main(){
        float g = clamp((uTime - aDelay) / .9, 0., 1.); g = 1. - pow(1. - g, 4.);
        float hv = step(abs(aIndex - uHover), .5);
        vec3 p = position; p.y *= max(g, .001);
        vec4 mv = modelViewMatrix * vec4(p, 1.);
        vC = aColor; vA = g;
        gl_PointSize = aSize * (1. + hv * 1.6) * (1. + .12 * sin(uTime * 1.8 + aIndex)) * uPR * (220. / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform sampler2D uTex; varying vec3 vC; varying float vA;
      void main(){ float t = texture2D(uTex, gl_PointCoord).a; gl_FragColor = vec4(vC + .25, t * vA * .9); }`
  });
  world.add(new THREE.Points(topGeo, topMat));

  /* ---------- interaction ---------- */
  const ptr = new THREE.Vector2(9, 9), mouse = new THREE.Vector2(), target = new THREE.Vector2();
  const ray = new THREE.Raycaster();
  const look = new THREE.Vector3();
  let camDist = 100;
  let hovered = -1, visible = true, scrollP = 0;
  const zone = host.parentElement;

  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    renderer.setSize(w, h, false);
    const aspect = w / h;
    camera.aspect = aspect;
    // la ligne de temps (2L) doit occuper ~55 % de la largeur ; la scène est poussée à droite du texte
    const frac = aspect > 1.5 ? 0.5 : aspect > 1.1 ? 0.62 : 0.9;
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    camDist = (2 * L) / (frac * 2 * tanV * aspect);
    const shift = aspect > 1.5 ? 0.25 : aspect > 1.1 ? 0.16 : 0;
    camera.setViewOffset(w, h, -shift * w, aspect > 1.1 ? -0.16 * h : 0, w, h); // à droite et un peu plus bas que le titre
    camera.updateProjectionMatrix();
    look.set(0, 3.5, 0);
  }
  resize();
  new ResizeObserver(resize).observe(host);

  zone.addEventListener("pointermove", (e) => {
    const b = host.getBoundingClientRect();
    ptr.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1);
    target.copy(ptr);
  }, { passive: true });
  zone.addEventListener("pointerleave", () => { ptr.set(9, 9); target.set(0, 0); setHover(-1); });
  zone.addEventListener("click", (e) => {
    if (hovered < 0 || e.target.closest("a, button, input, kbd, .hero-search")) return;
    A.openSheet(items[hovered].r.id);
  });
  addEventListener("scroll", () => { scrollP = Math.min(1, Math.max(0, scrollY / (host.clientHeight || 1))); }, { passive: true });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(host);
  document.addEventListener("visibilitychange", () => clock.getDelta());

  function setHover(i) {
    if (i === hovered) return;
    hovered = i;
    colMat.uniforms.uHover.value = i;
    topMat.uniforms.uHover.value = i;
    zone.style.cursor = i >= 0 ? "pointer" : "";
    if (i < 0) { tip.classList.remove("show"); return; }
    const r = items[i].r;
    tip.innerHTML = `<span class="ht-date">${A.fmtShort(r._date)} 2027</span><b>${A.esc(r.name)}</b><span>${A.esc(r.city)}${r.arr ? " " + A.esc(r.arr) : ""} · ${A.esc(r._distLabel)}</span>`;
    tip.classList.add("show");
  }
  const v3 = new THREE.Vector3();
  function placeTip() {
    if (hovered < 0) return;
    v3.copy(items[hovered].top).applyMatrix4(world.matrixWorld).project(camera);
    const x = (v3.x * 0.5 + 0.5) * host.clientWidth, y = (-v3.y * 0.5 + 0.5) * host.clientHeight;
    const tw = tip.offsetWidth;
    tip.style.setProperty("--tx", `${Math.min(host.clientWidth - tw - 12, Math.max(12, x - tw / 2))}px`);
    tip.style.setProperty("--ty", `${Math.max(80, y - tip.offsetHeight - 18)}px`);
  }

  /* ---------- boucle ---------- */
  const clock = new THREE.Clock();
  let t = 0;
  const t0 = performance.now();
  host.classList.add("ready");
  function frame() {
    requestAnimationFrame(frame);
    if (!visible || document.hidden) { clock.getDelta(); return; }
    clock.getDelta();
    t = (performance.now() - t0) / 1000; // temps réel : l'intro ne dépend pas du framerate
    colMat.uniforms.uTime.value = topMat.uniforms.uTime.value = t;
    axis.material.uniforms.uDraw.value = Math.min(1, t / 2.2);

    mouse.lerp(target, 0.06);
    const drift = Math.sin(t * 0.12) * 4;
    const p = scrollP;
    camera.position.set(drift * 0.6 + mouse.x * 5, camDist * 0.3 + mouse.y * 3 - p * 8, camDist * 0.95 - p * camDist * 0.45);
    camera.lookAt(look.x + mouse.x * 2, look.y - p * 2, look.z);
    renderer.domElement.style.opacity = String(1 - Math.min(1, Math.max(0, (p - 0.35) / 0.55)));

    if (ptr.x < 2 && t > 1.2) {
      ray.setFromCamera(ptr, camera);
      const h = ray.intersectObject(hit, false)[0];
      setHover(h ? h.instanceId : -1);
    }
    placeTip();
    renderer.render(scene, camera);
  }
  frame();
}
