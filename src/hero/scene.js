/* =========================================================
   Hero WebGL : la saison en 12 barres (une par mois)
   - hauteur = nombre de courses, segments empilés par catégorie
   - caméra quasi fixe (légère dérive + parallaxe souris limitée),
     figée pendant le survol
   - interaction portée par 12 vrais <button> HTML superposés aux barres :
     zones de survol élargies, focus clavier, Entrée = clic
   ========================================================= */
import * as THREE from "three";
import { A, tokHex, MONTHS, MONTHS_LONG, CATS, monthStats, tipHTML } from "./layout.js";

const tok = (n) => new THREE.Color(tokHex(n));
const SLOT = 3.6;          // espacement entre mois
const BW = 2.3;            // largeur / profondeur d'une barre
const GAP = 0.09;          // fin liseré entre segments
const MAX_H = 15;          // hauteur du mois le plus chargé

export function mountScene(host) {
  const tip = document.getElementById("hero-tip");
  const zone = host.parentElement;
  const stats = monthStats(A.races);
  const maxTotal = Math.max(...stats.map((s) => s.total));
  const unit = MAX_H / maxTotal;
  const xOf = (m) => (m - 5.5) * SLOT;
  const hOf = (m) => stats[m].total * unit;

  /* ---------- renderer / scène ---------- */
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(tok("--bg-0"), 60, 130);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 300);
  const world = new THREE.Group();
  world.rotation.y = -0.32; // légère perspective : décembre un peu plus proche
  scene.add(world);

  /* ---------- sol : courbes de niveau orange très discrètes ---------- */
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 80).rotateX(-Math.PI / 2),
    new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uColor: { value: tok("--accent") } },
      vertexShader: "varying vec2 vP; void main(){ vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: `
        varying vec2 vP; uniform vec3 uColor;
        float h(vec2 p){ return sin(p.x*.07+1.3)*cos(p.y*.09) + .55*sin(p.x*.13-p.y*.1+2.) + .3*cos(p.x*.23+p.y*.19); }
        void main(){
          float v = h(vP) * 3.2;
          float line = 1. - clamp(abs(fract(v) - .5) / fwidth(v), 0., 1.);
          float fade = smoothstep(46., 10., length(vP * vec2(.7, 1.2)));
          gl_FragColor = vec4(uColor, line * .17 * fade);
        }`
    })
  );
  world.add(floor);

  // axe janvier → décembre + graduations
  const axisPts = [xOf(0) - SLOT / 2, 0.02, BW / 2 + 0.9, xOf(11) + SLOT / 2, 0.02, BW / 2 + 0.9];
  for (let m = 0; m < 12; m++) axisPts.push(xOf(m), 0.02, BW / 2 + 0.6, xOf(m), 0.02, BW / 2 + 1.2);
  world.add(new THREE.LineSegments(
    new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(axisPts, 3)),
    new THREE.LineBasicMaterial({ color: tok("--accent"), transparent: true, opacity: 0.55 })
  ));

  // halo au sol sous le mois survolé
  const halo = new THREE.Mesh(
    new THREE.PlaneGeometry(SLOT * 2.2, SLOT * 2.2).rotateX(-Math.PI / 2),
    new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uColor: { value: tok("--accent") }, uA: { value: 0 } },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: "varying vec2 vUv; uniform vec3 uColor; uniform float uA; void main(){ float d = length(vUv - .5) * 2.; gl_FragColor = vec4(uColor, smoothstep(1., 0., d) * .55 * uA); }"
    })
  );
  halo.position.y = 0.03;
  world.add(halo);

  /* ---------- barres : segments instanciés ---------- */
  const segs = [];
  stats.forEach((s) => {
    let y = 0;
    CATS.forEach((c) => {
      const n = s.parts[c.id];
      if (!n) return;
      const h = n * unit;
      segs.push({ m: s.m, y, h: Math.max(0.05, h - GAP), color: tok(c.token) });
      y += h;
    });
  });
  const N = segs.length;
  const geo = new THREE.BoxGeometry(BW, 1, BW).translate(0, 0.5, 0);
  const aColor = new Float32Array(N * 3), aMonth = new Float32Array(N);
  const mat4 = new THREE.Matrix4();
  const bars = new THREE.InstancedMesh(geo, null, N);
  segs.forEach((g, i) => {
    mat4.makeScale(1, g.h, 1).setPosition(xOf(g.m), g.y, 0);
    bars.setMatrixAt(i, mat4);
    aColor.set([g.color.r, g.color.g, g.color.b], i * 3);
    aMonth[i] = g.m;
  });
  geo.setAttribute("aColor", new THREE.InstancedBufferAttribute(aColor, 3));
  geo.setAttribute("aMonth", new THREE.InstancedBufferAttribute(aMonth, 1));
  bars.material = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uHover: { value: -1 }, uWhite: { value: tok("--text") } },
    vertexShader: `
      attribute vec3 aColor; attribute float aMonth;
      uniform float uTime; uniform float uHover;
      varying vec3 vC; varying float vLY; varying vec3 vN; varying float vH; varying float vDim;
      void main(){
        float g = clamp((uTime - .2 - aMonth * .07) / .9, 0., 1.);
        g = 1. - pow(1. - g, 4.);
        vec4 wp = instanceMatrix * vec4(position, 1.0);
        wp.y *= max(g, .002);
        vC = aColor; vLY = position.y; vN = normal;
        vH = step(abs(aMonth - uHover), .5);
        vDim = step(0., uHover) * (1. - vH);
        gl_Position = projectionMatrix * modelViewMatrix * wp;
      }`,
    fragmentShader: `
      varying vec3 vC; varying float vLY; varying vec3 vN; varying float vH; varying float vDim; uniform vec3 uWhite;
      void main(){
        float light = .62 + .38 * max(dot(normalize(vN), normalize(vec3(.4, .9, .6))), 0.);
        vec3 c = vC * light * (.82 + .18 * vLY);
        c += step(.965, vLY) * .18;                // liseré clair en haut de chaque segment
        c = mix(c, c * .38, vDim);                 // les autres mois s'effacent pendant le survol
        c = mix(c, mix(c, uWhite, .18), vH);       // le mois survolé s'illumine
        gl_FragColor = vec4(c * (1. + vH * .25), 1.);
      }`
  });
  world.add(bars);

  /* ---------- boutons HTML superposés (interaction + clavier) ---------- */
  const layer = document.getElementById("hero-months");
  layer.innerHTML = stats.map((s) => `<button class="hm-btn" type="button" data-hm="${s.m}" aria-label="${MONTHS_LONG[s.m]} : ${s.total} course${s.total > 1 ? "s" : ""} — afficher ce mois"><span class="hm-label">${MONTHS[s.m]}</span></button>`).join("");
  layer.hidden = false;
  const btns = [...layer.querySelectorAll(".hm-btn")];
  let hovered = -1;
  const setHover = (m) => {
    if (m === hovered) return;
    hovered = m;
    bars.material.uniforms.uHover.value = m;
    btns.forEach((b, i) => b.classList.toggle("is-hot", i === m));
    if (m < 0) { tip.classList.remove("show"); return; }
    tip.innerHTML = tipHTML(stats[m]);
    tip.classList.add("show");
    halo.position.x = xOf(m);
  };
  btns.forEach((b, m) => {
    b.addEventListener("pointerenter", () => setHover(m));
    b.addEventListener("pointerleave", () => setHover(-1));
    b.addEventListener("focus", () => setHover(m));
    b.addEventListener("blur", () => setHover(-1));
    b.addEventListener("click", () => A.filterMonth(m));
  });

  /* ---------- caméra ---------- */
  const look = new THREE.Vector3(0, 5.5, 0);
  const mouse = new THREE.Vector2(), target = new THREE.Vector2();
  let camDist = 48, visible = true, scrollP = 0;
  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    renderer.setSize(w, h, false);
    const aspect = w / h;
    camera.aspect = aspect;
    // les 12 mois occupent ~45 % de la largeur, à droite du texte et sous le titre
    const frac = aspect > 1.5 ? 0.45 : 0.38;
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    camDist = (12 * SLOT) / (frac * 2 * tanV * aspect);
    camera.setViewOffset(w, h, -(aspect > 1.5 ? 0.26 : 0.3) * w, -0.2 * h, w, h);
    camera.updateProjectionMatrix();
  }
  resize();
  new ResizeObserver(resize).observe(host);
  zone.addEventListener("pointermove", (e) => {
    const b = host.getBoundingClientRect();
    target.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1);
  }, { passive: true });
  zone.addEventListener("pointerleave", () => target.set(0, 0));
  addEventListener("scroll", () => { scrollP = Math.min(1, Math.max(0, scrollY / (host.clientHeight || 1))); }, { passive: true });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(host);

  /* ---------- placement des boutons + info-bulle ancrée ---------- */
  const v = new THREE.Vector3();
  const toScreen = (x, y, z) => {
    v.set(x, y, z).applyMatrix4(world.matrixWorld).project(camera);
    return [(v.x * 0.5 + 0.5) * host.clientWidth, (-v.y * 0.5 + 0.5) * host.clientHeight];
  };
  function placeButtons(grow) {
    btns.forEach((b, m) => {
      const x = xOf(m), h = Math.max(hOf(m) * grow, 2.5);
      const [lx, by] = toScreen(x - SLOT * 0.48, 0, BW / 2);
      const [rx] = toScreen(x + SLOT * 0.48, 0, BW / 2);
      const [, ty] = toScreen(x, h + 1.2, 0);
      b.style.transform = `translate(${lx.toFixed(1)}px, ${ty.toFixed(1)}px)`;
      b.style.width = `${(rx - lx).toFixed(1)}px`;
      b.style.height = `${(by - ty + 34).toFixed(1)}px`; // + la zone du libellé sous l'axe
    });
    if (hovered >= 0) {
      const [tx, ty] = toScreen(xOf(hovered), hOf(hovered), 0);
      const tw = tip.offsetWidth, th = tip.offsetHeight;
      tip.style.setProperty("--tx", `${Math.min(host.clientWidth - tw - 12, Math.max(12, tx - tw / 2)).toFixed(1)}px`);
      tip.style.setProperty("--ty", `${Math.max(76, ty - th - 22).toFixed(1)}px`);
    }
  }

  /* ---------- boucle ---------- */
  const t0 = performance.now();
  let drift = 0, last = t0;
  host.classList.add("ready");
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!visible || document.hidden) return;
    const t = (now - t0) / 1000;
    const grow = Math.min(1, Math.max(0, (t - 0.2) / 1.7));
    bars.material.uniforms.uTime.value = t;
    // au survol : caméra et dérive figées
    if (hovered < 0) { drift += dt; mouse.lerp(target, 0.04); }
    halo.material.uniforms.uA.value += ((hovered >= 0 ? 1 : 0) - halo.material.uniforms.uA.value) * 0.15;
    const p = scrollP;
    camera.position.set(Math.sin(drift * 0.18) * 1.2 + mouse.x * 1.6, camDist * 0.3 + mouse.y * 0.8 - p * 4, camDist - p * camDist * 0.35);
    camera.lookAt(look.x, look.y - p * 2, look.z);
    renderer.domElement.style.opacity = String(1 - Math.min(1, Math.max(0, (p - 0.35) / 0.5)));
    layer.style.opacity = renderer.domElement.style.opacity;
    world.updateMatrixWorld();
    placeButtons(grow);
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
}
