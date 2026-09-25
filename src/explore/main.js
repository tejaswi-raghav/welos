import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { DATA, BLADE } from './model-data.js';

/* ============ SOURCE MODEL (transcribed 1:1 from the supplied welos model scene graph) ============ */

const T_MAX = 17;
const RM = matchMedia('(prefers-reduced-motion: reduce)');
let reduce = RM.matches; RM.addEventListener?.('change', e => reduce = e.matches);
const $ = s => document.querySelector(s);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = x => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const ramp = (t, a, b) => ease((t - a) / (b - a));
const lerp = (a, b, u) => a + (b - a) * u;

/* ============ RENDERER ============ */
const canvas = $('#gl');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  $('#veilMsg').textContent = 'This exhibit needs WebGL. Open it in a recent browser with hardware acceleration turned on.';
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.62;
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);

const hemi = new THREE.HemisphereLight(0xffffff, 0xd8d6d0, 0.55); scene.add(hemi);
const key = new THREE.DirectionalLight(0xffffff, 2.1);
key.position.set(6, 12, 8); key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 40 });
key.shadow.bias = -0.0005; key.shadow.normalBias = 0.025;
scene.add(key);
const fill = new THREE.DirectionalLight(0xffffff, 0.55); fill.position.set(-8, 5, -4); scene.add(fill);
const sunLight = new THREE.DirectionalLight(0xffc873, 0); sunLight.position.set(-3, 14, 5); scene.add(sunLight);

/* ============ BUILD MODEL FROM DATA ============ */
const [, nTxt, gTxt, mTxt] = DATA.trim().split(/@N\n|\n@G\n|\n@M\n/);
const vec = s => s ? s.split(',').map(Number) : [0, 0, 0];
const bladeIndex = []; for (let i = 0; i < 24; i++) { const a = 2 * i; bladeIndex.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }

const geos = gTxt.split('\n').map(line => {
  const p = line.split(',');
  const k = p[0], n = p.slice(1).map(Number);
  switch (k) {
    case 'R': return new RoundedBoxGeometry(n[0], n[1], n[2], 3, n[3]);
    case 'B': return new THREE.BoxGeometry(n[0], n[1], n[2]);
    case 'C': return new THREE.CylinderGeometry(n[0], n[1], n[2], n[3], n[4] ?? 1, !!n[5], n[6] ?? 0, n[7] ?? Math.PI * 2);
    case 'O': return new THREE.TorusGeometry(n[0], n[1], n[2], n[3], n[4]);
    case 'I': return new THREE.CircleGeometry(n[0], n[1]);
    case 'U': {
      const pts = p[2].split(';').map(s => new THREE.Vector3(...s.trim().split(' ').map(Number)));
      return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5), 48, +p[1], 8, false);
    }
    case 'F': { // helical rotor blade; blades 2 and 3 are the same strip rotated 120° / 240°
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(BLADE, 3));
      g.setIndex(bladeIndex); g.rotateY(-n[0] * Math.PI * 2 / 3); g.computeVertexNormals();
      return g;
    }
  }
});
const mats = mTxt.split('\n').map(line => {
  const [hex, metal, rough, em, ei, side] = line.split(',');
  return new THREE.MeshStandardMaterial({
    color: '#' + hex, metalness: +metal, roughness: +rough,
    emissive: em ? '#' + em : 0x000000, emissiveIntensity: em ? +ei : 1,
    side: side === '2' ? THREE.DoubleSide : THREE.FrontSide
  });
});

const nodes = [];
nTxt.split('\n').forEach(line => {
  const p = line.split('|'); let o, pos, rot;
  if (p[0] === 'g') { o = new THREE.Group(); o.userData.partId = p[2]; o.name = p[2] || p[5] || ''; pos = p[3]; rot = p[4]; }
  else { o = new THREE.Mesh(geos[+p[4]], mats[+p[5]].clone()); pos = p[2]; rot = p[3]; o.castShadow = true; o.receiveShadow = true; }
  o.position.fromArray(vec(pos)); o.rotation.set(...vec(rot));
  if (+p[1] >= 0) nodes[+p[1]].add(o);
  nodes.push(o);
});

/* semantic grouping — identifiers only, geometry and transforms untouched */
const KEY = {};
const tag = (i, k) => { const o = nodes[i]; o.userData.key = k; (KEY[k] ||= []).push(o); };
nodes.forEach((o, i) => { if (o.userData.partId) tag(i, o.userData.partId); });
tag(20, 'canopy'); tag(71, 'wind-mast'); tag(139, 'enclosure-door'); tag(142, 'backplate'); tag(185, 'power-cabinet');
tag(1, 'base-slab'); tag(19, 'base-slab'); tag(2, 'base-plate');
for (let i = 3; i <= 10; i++) tag(i, 'foot');
for (let i = 11; i <= 18; i++) tag(i, 'post');
['filter-stage-1', 'filter-cap-1', 'filter-stage-2', 'filter-cap-2', 'filter-stage-3', 'filter-cap-3', 'filter-header'].forEach((k, j) => tag(113 + j, k));
for (let j = 0; j < 5; j++) tag(128 + j, 'pipe-' + j);
tag(209, 'pv-cable'); tag(210, 'wind-cable');

const modelRoot = nodes[0];
const baseGroup = new THREE.Group(), assembly = new THREE.Group();
[...modelRoot.children].forEach(c => { const i = nodes.indexOf(c); ((i >= 1 && i <= 10) || i === 19 ? baseGroup : assembly).add(c); });
modelRoot.add(baseGroup, assembly);
assembly.userData.key = 'assembly'; KEY.assembly = [assembly];
scene.add(modelRoot);

const meshes = [];
modelRoot.traverse(o => {
  if (!o.isMesh) return;
  let a = o; while (a && !a.userData.key) a = a.parent;
  o.userData.dimKey = a ? a.userData.key : 'misc';
  o.userData.base = o.material.color.clone();
  o.userData.dim = 0;
  meshes.push(o);
});
const ROTOR = KEY['vawt-rotor'][0]; const rotorY0 = ROTOR.rotation.y;
for (const k in KEY) for (const o of KEY[k]) o.userData.home = o.position.clone();
scene.updateMatrixWorld(true);
for (const k in KEY) for (const o of KEY[k]) o.userData.homeWorld = o.getWorldPosition(new THREE.Vector3());

/* ground: shadow catcher + fading technical grid */
const GROUND_Y = -2.385;
const shadowMat = new THREE.ShadowMaterial({ opacity: .17 });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), shadowMat);
ground.rotation.x = -Math.PI / 2; ground.position.y = GROUND_Y; ground.receiveShadow = true; scene.add(ground);
const gridMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false,
  uniforms: { uColor: { value: new THREE.Color(0x000000) }, uAlpha: { value: .09 } },
  vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
  fragmentShader: `uniform vec3 uColor; uniform float uAlpha; varying vec3 vW;
    float line(float v, float s){ float c = v/s; float d = abs(fract(c-.5)-.5)/fwidth(c); return 1.-min(d,1.); }
    void main(){ float g = max(line(vW.x,.5), line(vW.z,.5))*.55 + max(line(vW.x,2.5), line(vW.z,2.5))*.6;
      float f = 1. - smoothstep(4.5, 11., length(vW.xz));
      gl_FragColor = vec4(uColor, clamp(g,0.,1.)*f*uAlpha);
      #include <colorspace_fragment>
    }`
});
const grid = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), gridMat);
grid.rotation.x = -Math.PI / 2; grid.position.y = GROUND_Y + 0.002; scene.add(grid);

/* ============ EXPLODE CHOREOGRAPHY ============
   [key, offset in parent space, explode start (scene t), reassembly start]
   Reassembly order: base, storage, treatment, pump, power, chassis, solar, wind. */
const MOVES = [
  ['vawt-rotor', [0, 1.75, 0], 2.05, 15.72],
  ['wind-brake', [0, 1.0, 0], 2.14, 15.72],
  ['wind-generator', [0, 0.44, 0], 2.22, 15.72],
  ['canopy', [0, 0.62, -0.4], 3.05, 15.6],
  ['pv-array', [0, 0.82, 0], 3.12, 15.6],
  ['soiling-sensor', [0, 0.98, 0], 3.12, 15.6],
  ['cleaning-manifold', [0, 0.42, -0.24], 3.2, 15.6],
  ['enclosure', [-0.4, 0.12, -0.42], 4.05, 15.5],
  ['backplate', [-0.2, 0.06, -0.22], 4.1, 15.5],
  ['power-cabinet', [0.34, 0.04, -0.56], 4.1, 15.5],
  ['controller-pcb', [-0.32, 0.4, 0.8], 5.05, 15.4],
  ['energy-meter', [0.4, 0.35, 0.75], 5.08, 15.4],
  ['protection', [0, -0.5, 0.95], 5.1, 15.4],
  ['communications', [-0.45, -0.18, 0.75], 5.12, 15.4],
  ['terminal-blocks', [0.35, -0.22, 0.85], 5.14, 15.4],
  ['thermal-management', [0.38, 0.22, 0.65], 5.16, 15.4],
  ['lifepo4-battery', [0.2, -0.3, 0.95], 5.12, 15.4],
  ['hybrid-inverter', [0.2, 0.45, 0.9], 5.15, 15.4],
  ['mppt', [-0.45, 0.45, 0.72], 5.18, 15.4],
  ['wind-rectifier', [0.45, 0.45, 0.72], 5.18, 15.4],
  ['dc-bus', [0, 0.53, 0.72], 5.2, 15.4],
  ['load-panel', [0.7, 0, 0.6], 5.2, 15.4],
  ['rain-gutter', [0, -0.3, 0.42], 6.05, 15.6],
  ['first-flush', [-0.75, 0.05, 0.2], 6.12, 15.1],
  ['water-tank', [-0.75, 0, 0.35], 7.05, 15.1],
  ['filter-train', [-0.1, 0.02, 1.05], 8.05, 15.2],
  ['filter-header', [0, 0.32, 0], 8.18, 15.2],
  ['filter-cap-1', [-0.14, 0.14, 0], 8.22, 15.2], ['filter-stage-1', [-0.14, 0, 0], 8.22, 15.2],
  ['filter-cap-2', [0, 0.14, 0], 8.22, 15.2],
  ['filter-cap-3', [0.14, 0.14, 0], 8.22, 15.2], ['filter-stage-3', [0.14, 0, 0], 8.22, 15.2],
  ['water-pump', [0.3, -0.02, 1.55], 9.05, 15.3],
  ['water-sensors', [-0.15, 0.42, 0.45], 9.12, 15.3],
  ['assembly', [0, 0.78, 0], 10.05, 15.0],
  ['base-plate', [0, 0.3, 0], 10.1, 15.0],
  ['base-slab', [0, 0.13, 0], 10.1, 15.0],
].map(([k, o, a, b]) => ({ k, off: new THREE.Vector3(...o), a, b, w: 0 }));
const moveW = {};
function moveWeight(m, t) { return ramp(t, m.a, m.a + 0.5) * (1 - ramp(t, m.b, m.b + 0.28)); }

/* ============ SCENES, FOCUS SETS ============ */
const SCN = ['The object', 'Exploded view', 'Wind', 'Solar', 'Chassis', 'Power & control', 'Catchment', 'Storage', 'Treatment', 'Delivery', 'Foundation', 'Full system', 'Energy path', 'Water path', 'Connection', 'Reassembly', 'welos'];
const S = (...a) => new Set(a);
const WIND = ['vawt-rotor', 'wind-brake', 'wind-generator', 'wind-mast'];
const SOLAR = ['pv-array', 'pv-racking', 'soiling-sensor', 'cleaning-manifold', 'rain-gutter'];
const POWER = ['controller-pcb', 'energy-meter', 'protection', 'communications', 'terminal-blocks', 'thermal-management', 'lifepo4-battery', 'hybrid-inverter', 'mppt', 'wind-rectifier', 'dc-bus', 'load-panel'];
const WATER = ['rain-gutter', 'first-flush', 'water-tank', 'filter-train', 'filter-stage-1', 'filter-cap-1', 'filter-stage-2', 'filter-cap-2', 'filter-stage-3', 'filter-cap-3', 'filter-header', 'water-pump', 'water-sensors', 'cleaning-manifold', 'pipe-0', 'pipe-1', 'pipe-2', 'pipe-3', 'pipe-4'];
const FILTER = WATER.filter(k => k.startsWith('filter'));
const FOCUS = {
  2: S(...WIND),
  3: S(...SOLAR, 'pv-cable'),
  4: S('enclosure', 'enclosure-door', 'backplate', 'power-cabinet', 'post'),
  5: S(...POWER, 'pv-cable', 'wind-cable'),
  6: S('rain-gutter', 'first-flush', 'pipe-0', 'pipe-1'),
  7: S('water-tank', 'water-sensors', 'pipe-1'),
  8: S(...FILTER, 'pipe-2', 'pipe-3'),
  9: S('water-pump', 'water-sensors', 'pipe-4', 'cleaning-manifold'),
  10: S('base-slab', 'base-plate', 'foot', 'post', 'wind-mast'),
  12: S(...WIND, 'pv-array', ...POWER, 'pv-cable', 'wind-cable'),
  13: S(...WATER, 'pv-array'),
  14: S('water-pump', 'cleaning-manifold', 'pv-array', 'dc-bus', 'terminal-blocks', 'water-tank', ...FILTER),
};
function sceneAlpha(t, k) {
  const a = k === 0 ? 1 : ramp(t, k - 0.02, k + 0.16);
  const b = k === 16 ? 0 : ramp(t, k + 0.8, k + 0.96);
  return a * (1 - b);
}

/* ============ CAMERA ============ */
const CAM = [
  [0.0, [9.8, 4.5, 12.6], [0.2, 0.35, 0.0]],
  [1.0, [8.5, 3.9, 11.0], [0.2, 0.5, 0.1]],
  [2.45, [8.6, 3.0, 11.2], [1.7, 2.35, -0.4]],
  [3.45, [6.6, 8.0, 11.4], [0.0, 1.9, -0.3]],
  [4.45, [5.6, 2.7, 9.8], [0.7, -0.2, 1.3]],
  [5.45, [4.8, 2.0, 9.4], [1.1, -0.15, 2.0]],
  [6.45, [-5.4, 2.8, 10.6], [-2.6, 0.1, 1.2]],
  [7.45, [-3.0, 1.8, 10.4], [-2.7, -0.5, 1.4]],
  [8.45, [0.9, 1.3, 10.2], [-1.4, -0.55, 2.5]],
  [9.45, [1.8, 1.4, 10.8], [-1.3, -0.8, 2.7]],
  [10.45, [8.2, 2.6, 11.8], [0.0, -1.0, 0.6]],
  [11.45, [11.8, 6.6, 17.0], [0.0, 1.0, 0.7]],
  [12.45, [10.4, 5.2, 14.8], [1.4, 1.1, 0.8]],
  [13.45, [4.4, 3.9, 15.2], [-1.8, 0.2, 1.2]],
  [14.45, [11.8, 6.6, 17.0], [0.0, 1.0, 0.7]],
  [16.0, [9.8, 4.5, 12.6], [0.2, 0.35, 0.0]],
].map(([t, p, g]) => ({ t, p: new THREE.Vector3(...p), g: new THREE.Vector3(...g) }));
const camPos = new THREE.Vector3(), camTgt = new THREE.Vector3(), _d = new THREE.Vector3();
function camAt(t) {
  let i = 0; while (i < CAM.length - 2 && t > CAM[i + 1].t) i++;
  const A = CAM[i], B = CAM[i + 1];
  const u = ease((t - A.t) / (B.t - A.t));
  camPos.lerpVectors(A.p, B.p, u); camTgt.lerpVectors(A.g, B.g, u);
  camPos.sub(camTgt).multiplyScalar(camDist).add(camTgt);
}
let camDist = 1.2;

/* ============ ANCHORS ============ */
const _w = new THREE.Vector3();
function anchor(k, p, out) {
  const o = KEY[k][0]; o.getWorldPosition(_w);
  return out.set(p[0], p[1], p[2]).add(_w).sub(o.userData.homeWorld);
}

/* ============ FLOWS (energy / water / air), routed through the model's own conduits ============ */
const flowVS = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`;
const flowFS = `uniform vec3 uColor; uniform float uOpacity,uReveal,uTime,uRep,uDash; varying vec2 vUv;
  void main(){
    float x = vUv.x; if (x > uReveal) discard;
    float ph = fract(x*uRep - uTime); float a;
    if (uDash > .5) { a = step(.5, ph); if (a < .5) discard; a = .8; }
    else { float p = smoothstep(0.,.12,ph)*smoothstep(.5,.12,ph); a = .5 + .5*p; }
    float head = smoothstep(uReveal-.035, uReveal, x);
    gl_FragColor = vec4(mix(uColor, vec3(1.), head*.35*(1.-uDash)), a*uOpacity);
    #include <colorspace_fragment>
  }`;
const COL = { solar: new THREE.Color(), water: new THREE.Color(), orange: new THREE.Color(), ink: new THREE.Color() };
class Flow {
  constructor(pts, col, { r = 0.022, dash = 0, win = [] } = {}) {
    this.pts = pts; this.col = col; this.r = r; this.win = win; this.v = pts.map(() => new THREE.Vector3());
    this.mat = new THREE.ShaderMaterial({
      vertexShader: flowVS, fragmentShader: flowFS, transparent: true, depthTest: false, depthWrite: false,
      uniforms: { uColor: { value: new THREE.Color() }, uOpacity: { value: 0 }, uReveal: { value: 0 }, uTime: { value: 0 }, uRep: { value: 8 }, uDash: { value: dash } }
    });
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.mat); this.mesh.renderOrder = 20; this.mesh.frustumCulled = false; this.mesh.visible = false;
    scene.add(this.mesh); this.sig = '';
  }
  update(t, time) {
    let al = 0, rv = 1;
    for (const [a, b, ra, rb] of this.win) {
      const x = ramp(t, a, a + 0.1) * (1 - ramp(t, b - 0.1, b));
      if (x > al) { al = x; rv = ra == null ? 1 : ramp(t, ra, rb); }
    }
    if (al < 0.004) { this.mesh.visible = false; return; }
    this.mesh.visible = true;
    let sig = '';
    this.pts.forEach(([k, p], i) => { anchor(k, p, this.v[i]); sig += this.v[i].x.toFixed(3) + this.v[i].y.toFixed(3) + this.v[i].z.toFixed(3); });
    if (sig !== this.sig) {
      this.sig = sig;
      const curve = new THREE.CatmullRomCurve3(this.v.map(v => v.clone()), false, 'centripetal', 0.5);
      this.mesh.geometry.dispose();
      this.mesh.geometry = new THREE.TubeGeometry(curve, 110, this.r, 6, false);
      this.mat.uniforms.uRep.value = Math.max(2, curve.getLength() / 0.42);
    }
    this.mat.uniforms.uColor.value.copy(COL[this.col]);
    this.mat.uniforms.uOpacity.value = al * (this.mat.uniforms.uDash.value > .5 ? .55 : .95);
    this.mat.uniforms.uReveal.value = rv;
    this.mat.uniforms.uTime.value = reduce ? 0 : time * 0.55;
  }
}
const WIN_E = (ra, rb) => [[12.05, 13.0, ra, rb], [14.05, 15.05, 14.08, 14.3]];
const WIN_W = (ra, rb) => [[13.05, 14.0, ra, rb], [14.05, 15.05, 14.08, 14.3]];
const flows = [
  // energy
  new Flow([['pv-array', [-0.95, 1.74, -0.28]], ['pv-racking', [-0.95, 1.4, -0.3]], ['pv-cable', [-0.95, 0.85, -0.3]], ['pv-cable', [1.3, 0.85, -0.3]], ['mppt', [1.36, 0.2, 1.66]]], 'solar',
    { win: [[3.3, 4.0, 3.38, 3.85], [5.05, 6.0, 5.1, 5.32], ...WIN_E(12.1, 12.4)] }),
  new Flow([['vawt-rotor', [3.25, 2.25, -0.9]], ['wind-brake', [3.25, 0.86, -0.9]], ['wind-generator', [3.25, 0.5, -0.9]], ['wind-mast', [3.25, -0.65, -0.9]], ['wind-cable', [2.2, -0.65, -0.9]], ['wind-rectifier', [2.13, 0.08, 1.66]]], 'orange',
    { win: [[5.05, 6.0, 5.1, 5.32], ...WIN_E(12.1, 12.4)] }),
  new Flow([['mppt', [1.36, 0.08, 1.8]], ['dc-bus', [1.55, -0.13, 1.95]]], 'solar', { win: [[5.05, 6.0, 5.28, 5.42], ...WIN_E(12.38, 12.5)] }),
  new Flow([['wind-rectifier', [2.13, 0.08, 1.8]], ['dc-bus', [1.95, -0.13, 1.95]]], 'orange', { win: [[5.05, 6.0, 5.28, 5.42], ...WIN_E(12.38, 12.5)] }),
  new Flow([['dc-bus', [1.4, -0.13, 1.97]], ['lifepo4-battery', [1.3, -1.25, 1.99]]], 'solar', { win: [[5.05, 6.0, 5.4, 5.56], ...WIN_E(12.48, 12.66)] }),
  new Flow([['dc-bus', [2.1, -0.13, 1.97]], ['hybrid-inverter', [2.1, -0.55, 1.98]], ['hybrid-inverter', [2.3, -0.55, 1.98]], ['load-panel', [3.05, -0.87, 1.9]]], 'solar', { win: [[5.05, 6.0, 5.46, 5.66], ...WIN_E(12.58, 12.82)] }),
  new Flow([['controller-pcb', [-0.37, -0.37, 1.72]], ['terminal-blocks', [0.19, -0.81, 1.66]], ['dc-bus', [1.2, -0.13, 1.97]]], 'ink', { r: 0.012, dash: 1, win: [[5.05, 6.0, 5.5, 5.7]] }),
  new Flow([['dc-bus', [1.75, -0.13, 1.97]], ['terminal-blocks', [0.6, -0.81, 1.66]], ['terminal-blocks', [-0.2, -0.81, 1.66]], ['water-pump', [-1.35, -1.6, 1.75]]], 'solar', { win: [[14.05, 15.05, 14.2, 14.45]] }),
  // water
  new Flow([['pv-array', [-0.95, 1.75, 0.4]], ['rain-gutter', [-0.95, 1.76, 1.54]], ['rain-gutter', [-3.95, 1.76, 1.54]], ['pipe-0', [-3.95, 1.35, 1.56]], ['pipe-0', [-3.95, -0.5, 1.55]], ['first-flush', [-3.94, -0.9, 1]], ['first-flush', [-3.94, -1.62, 1]], ['pipe-1', [-3.5, -1.62, 1]], ['water-tank', [-3.5, -0.95, 1]]], 'water',
    { win: [[6.08, 8.0, 6.12, 6.6], [13.05, 14.0, 13.1, 13.38], [14.05, 15.05, 14.08, 14.3]] }),
  new Flow([['water-tank', [-2.8, -1.0, 1.0]], ['water-tank', [-2.1, -1, 1]], ['pipe-2', [-1.7, -1, 1.4]], ['filter-header', [-1.71, -0.5, 1.9]], ['filter-stage-1', [-1.71, -0.66, 1.9]], ['filter-stage-1', [-1.71, -1.45, 1.9]], ['filter-stage-2', [-1.3, -1.45, 1.9]], ['filter-stage-2', [-1.3, -0.66, 1.9]], ['filter-stage-3', [-0.89, -0.66, 1.9]], ['filter-stage-3', [-0.89, -1.45, 1.9]], ['water-pump', [-1.15, -1.6, 1.75]]], 'water',
    { win: [[8.05, 9.0, 8.12, 8.6], ...WIN_W(13.34, 13.62)] }),
  new Flow([['water-pump', [-1.55, -1.6, 1.75]], ['water-pump', [-1.95, -1.62, 1.75]], ['pipe-4', [-3.75, -1.62, 1.75]], ['pipe-4', [-3.75, 1.42, 1.62]], ['cleaning-manifold', [-3.55, 1.52, -2.11]], ['cleaning-manifold', [1.7, 1.52, -2.11]]], 'water',
    { win: [[9.05, 10.0, 9.1, 9.55], ...WIN_W(13.58, 13.9)] }),
];
// airflow streamlines around the rotor (wind scene)
const air = [1.55, 2.25, 2.95].map((y, j) => {
  const pts = []; const r = 1.08 + j * 0.06;
  for (let i = 0; i <= 10; i++) { const a = -2.6 + i * 0.44 + j * 0.3; pts.push(['vawt-rotor', [3.25 + Math.cos(a) * r, y + (i - 5) * 0.025, -0.9 + Math.sin(a) * r]]); }
  return new Flow(pts, 'ink', { r: 0.008, dash: 1, win: [[2.12, 3.0, 2.2 + j * 0.05, 2.55 + j * 0.05]] });
});
flows.push(...air);

/* ============ ALIGNMENT GUIDES (dotted travel lines + axes) ============ */
const guideMat = () => new THREE.LineDashedMaterial({ color: 0x000000, dashSize: 0.07, gapSize: 0.07, transparent: true, opacity: 0, depthTest: false, depthWrite: false });
const GUIDE_KEYS = ['vawt-rotor', 'wind-brake', 'canopy', 'pv-array', 'enclosure', 'power-cabinet', 'controller-pcb', 'lifepo4-battery', 'hybrid-inverter', 'load-panel', 'first-flush', 'water-tank', 'filter-train', 'water-pump'];
const guides = GUIDE_KEYS.map(k => {
  const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6), 3));
  const l = new THREE.Line(g, guideMat()); l.renderOrder = 15; l.frustumCulled = false; scene.add(l);
  return { k, l };
});
const axes = [[3.25, -0.9, -2.1, 5.2, 'wind-mast'], [-2.8, 1.0, -2.1, 0.4, 'water-tank'], [-3.94, 1.0, -2.1, -0.3, 'first-flush']].map(([x, z, y0, y1, k]) => {
  const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, y0, z), new THREE.Vector3(x, y1, z)]);
  const l = new THREE.Line(g, guideMat()); l.computeLineDistances(); l.renderOrder = 15; scene.add(l);
  return { l, k, home: new THREE.Vector3(x, 0, z) };
});

/* ============ CALLOUTS ============ */
const CALLOUTS = [
  // wind
  { s: 2, k: 'vawt-rotor', p: [3.25, 2.7, -0.18], c: 'W01', t: 'Helical rotor', d: 'Omnidirectional capture. No yaw mechanism.', side: 'r', dy: -30, a: 'w' },
  { s: 2, k: 'wind-brake', p: [3.72, 0.86, -0.9], c: 'W03', t: 'Brake + overspeed', d: 'Fail-safe stop for faults and service.', side: 'r', dy: 10, a: 'w' },
  { s: 2, k: 'wind-generator', p: [3.6, 0.45, -0.5], c: 'W02', t: 'Integrated generation', d: 'Direct-drive permanent-magnet generator.', side: 'r', dy: 44, a: 'w' },
  { s: 2, k: 'wind-mast', p: [3.25, -0.6, -0.78], c: 'AXIS', t: 'Vertical architecture', d: 'Compact footprint on the shared base.', side: 'l', dy: 30 },
  // solar
  { s: 3, k: 'pv-array', p: [0.9, 1.72, 0.6], c: 'S01', t: 'Photovoltaic canopy', d: 'Six modules. Also the rain catchment.', side: 'r', dy: -40, a: 's' },
  { s: 3, k: 'soiling-sensor', p: [-3.69, 1.6, -1.82], c: 'S04', t: 'Soiling reference', d: 'Clean reference cell detects dust losses.', side: 'l', dy: -30, a: 's' },
  { s: 3, k: 'cleaning-manifold', p: [0.9, 1.52, -2.11], c: 'S05', t: 'Cleaning manifold', d: 'Low-flow spray rail for panel rinsing.', side: 'r', dy: -20, a: 's' },
  { s: 3, k: 'pv-racking', p: [1.9, 1.47, -0.26], c: 'S02', t: 'Structural racking', d: 'Carries loads, keeps drainage fall.', side: 'r', dy: 36, a: 's' },
  // chassis
  { s: 4, k: 'enclosure', p: [-0.84, -0.15, 1.45], c: 'C01', t: 'IP-rated enclosure', d: 'Keeps dust and water off control hardware.', side: 'l', dy: -36 },
  { s: 4, k: 'enclosure-door', p: [1.15, -0.45, 2.6], c: 'C01', t: 'Service door', d: 'Hinged access for maintenance.', side: 'r', dy: -50 },
  { s: 4, mh: 1, k: 'backplate', p: [-0.5, -0.2, 1.15], c: 'C02', t: 'Grounded backplate', d: 'Bonded mounting plane, segregated cabling.', side: 'l', dy: 34 },
  { s: 4, k: 'power-cabinet', p: [2.45, -0.3, 1.6], c: 'CAB', t: 'Power cabinet', d: 'Houses battery, inverter and converters.', side: 'r', dy: 20 },
  { s: 4, mh: 1, k: 'post', p: [1.85, 0.7, 1.6], c: 'FRM', t: 'Canopy posts', d: 'Transfer canopy loads to the base.', side: 'r', dy: -20 },
  // power
  { s: 5, k: 'mppt', p: [1.36, 0.1, 1.92], c: 'E01', t: 'Solar MPPT', side: 'l', dy: -40, a: 's' },
  { s: 5, k: 'wind-rectifier', p: [2.13, 0.1, 1.92], c: 'E02', t: 'Wind rectifier', side: 'r', dy: -40, a: 'w' },
  { s: 5, mh: 1, k: 'dc-bus', p: [1.75, -0.13, 1.98], c: 'E04', t: '48 V DC bus', side: 'r', dy: -6 },
  { s: 5, k: 'hybrid-inverter', p: [2.3, -0.55, 1.97], c: 'E05', t: 'Hybrid inverter', side: 'r', dy: 22 },
  { s: 5, k: 'lifepo4-battery', p: [1.2, -1.36, 1.97], c: 'E03', t: 'LiFePO4 battery', d: '3.5 kWh usable, smart BMS.', side: 'l', dy: 30 },
  { s: 5, mh: 1, k: 'controller-pcb', p: [-0.37, -0.3, 1.63], c: 'C03', t: 'Edge controller', d: 'Runs locally, no cloud needed.', side: 'l', dy: -30 },
  { s: 5, k: 'load-panel', p: [3.05, -0.87, 1.88], c: 'E06', t: 'Critical loads', side: 'r', dy: 40 },
  // catchment
  { s: 6, k: 'rain-gutter', p: [-2.4, 1.76, 1.54], c: 'S03', t: 'Perimeter gutter', d: 'Collects canopy runoff.', side: 'r', dy: -34, a: 'b' },
  { s: 6, k: 'pipe-0', p: [-3.95, 0.4, 1.55], c: 'DWN', t: 'Downpipe', side: 'l', dy: -10, a: 'b' },
  { s: 6, k: 'first-flush', p: [-4.11, -1.05, 1.0], c: 'R01', t: 'First-flush diverter', d: 'Rejects the dirtiest first runoff.', side: 'l', dy: 30, a: 'b' },
  // storage
  { s: 7, k: 'water-tank', p: [-2.8, -0.55, 1.67], c: 'R03', t: 'Storage tank', d: 'Opaque, vented, overflow + drain.', side: 'l', dy: -20, a: 'b' },
  { s: 7, k: 'water-sensors', p: [-2.45, -0.18, 1.86], c: 'R05', t: 'Level + quality sensors', d: 'Level, flow, turbidity, leaks.', side: 'r', dy: -36, a: 'b' },
  // treatment
  { s: 8, k: 'filter-stage-1', p: [-1.71, -1.0, 2.07], c: 'STAGE 01', t: 'First stage', side: 'l', dy: 30, a: 'b' },
  { s: 8, k: 'filter-stage-2', p: [-1.3, -1.2, 2.07], c: 'STAGE 02', t: 'Second stage', side: 'l', dy: 66, a: 'b' },
  { s: 8, k: 'filter-stage-3', p: [-0.89, -1.0, 2.07], c: 'STAGE 03', t: 'Third stage', side: 'r', dy: 30, a: 'b' },
  { s: 8, k: 'filter-header', p: [-1.0, -0.5, 2.14], c: 'R02', t: 'Filter + UV train', d: 'Sediment, carbon, then UV.', side: 'r', dy: -40, a: 'b' },
  // delivery
  { s: 9, k: 'water-pump', p: [-1.3, -1.45, 1.98], c: 'R04', t: 'Variable-speed pump', d: 'Pressure-controlled, on demand.', side: 'r', dy: -20, a: 'b' },
  { s: 9, k: 'pipe-4', p: [-3.75, 0.4, 1.65], c: 'RTN', t: 'Cleaning line', d: 'Feeds the canopy spray rail.', side: 'l', dy: -10, a: 'b' },
  { s: 9, k: 'water-sensors', p: [-2.45, -0.18, 1.86], c: 'R05', t: 'Pressure + flow', side: 'r', dy: -40, a: 'b' },
  // foundation
  { s: 10, k: 'base-slab', p: [2.6, -2.07, 3.1], c: 'BAS', t: 'Base frame', side: 'r', dy: 10 },
  { s: 10, k: 'base-plate', p: [-2.6, -1.88, 2.95], c: 'PLT', t: 'Base plate', side: 'l', dy: 20 },
  { s: 10, k: 'foot', p: [3.75, -2.3, 2.3], c: 'FT ×4', t: 'Mounting feet', side: 'r', dy: 40 },
  { s: 10, k: 'post', p: [-3.7, 0.2, 1.6], c: 'FRM', t: 'Canopy posts', side: 'l', dy: -20 },
  // full system
  { s: 11, k: 'vawt-rotor', p: [3.25, 3.3, -0.9], c: 'W', t: 'Wind system', side: 'r', dy: -10, a: 'w' },
  { s: 11, k: 'pv-array', p: [-2.9, 1.75, 0.5], c: 'S', t: 'Solar array', side: 'l', dy: -20, a: 's' },
  { s: 11, k: 'controller-pcb', p: [-0.37, -0.37, 1.63], c: 'C', t: 'Control', side: 'l', dy: -10 },
  { s: 11, k: 'hybrid-inverter', p: [2.3, -0.55, 1.97], c: 'E', t: 'Power system', side: 'r', dy: 10 },
  { s: 11, k: 'water-tank', p: [-3.4, -0.4, 1.3], c: 'R', t: 'Water system', side: 'l', dy: 20, a: 'b' },
  { s: 11, k: 'base-slab', p: [-3.2, -2.07, 3.1], c: 'B', t: 'Structural base', side: 'l', dy: 20 },
  // energy path
  { s: 12, k: 'pv-array', p: [-0.95, 1.75, -0.28], c: 'SUN', t: 'Solar', side: 'l', dy: -40, a: 's' },
  { s: 12, k: 'vawt-rotor', p: [3.25, 2.9, -0.9], c: 'WIND', t: 'Turbine', side: 'r', dy: -20, a: 'w' },
  { s: 12, k: 'dc-bus', p: [1.75, -0.13, 1.98], c: 'MGMT', t: 'Power management', side: 'r', dy: -30 },
  { s: 12, k: 'lifepo4-battery', p: [1.2, -1.36, 1.97], c: 'STORE', t: 'Storage', side: 'l', dy: 30 },
  { s: 12, k: 'load-panel', p: [3.05, -0.87, 1.88], c: 'OUT', t: 'Output', side: 'r', dy: 30 },
  // water path
  { s: 13, k: 'rain-gutter', p: [-2.4, 1.76, 1.54], c: 'IN', t: 'Catchment', side: 'l', dy: -40, a: 'b' },
  { s: 13, k: 'first-flush', p: [-4.11, -1.05, 1.0], c: 'R01', t: 'First flush', side: 'l', dy: 20, a: 'b' },
  { s: 13, k: 'water-tank', p: [-2.8, -0.2, 1.67], c: 'R03', t: 'Storage', side: 'r', dy: -50, a: 'b' },
  { s: 13, k: 'filter-header', p: [-1.0, -0.5, 2.14], c: 'R02', t: 'Treatment', side: 'r', dy: -20, a: 'b' },
  { s: 13, k: 'water-pump', p: [-1.3, -1.45, 1.98], c: 'R04', t: 'Pump', side: 'r', dy: 30, a: 'b' },
  { s: 13, k: 'cleaning-manifold', p: [0.9, 1.52, -2.11], c: 'OUT', t: 'Panel cleaning', side: 'r', dy: -20, a: 'b' },
  // connection
  { s: 14, k: 'cleaning-manifold', p: [0.9, 1.52, -2.11], c: 'LOOP', t: 'Water cleans the panels', side: 'r', dy: -30, a: 'b' },
  { s: 14, k: 'water-pump', p: [-1.3, -1.45, 1.98], c: 'LOOP', t: 'Energy runs the pump', side: 'r', dy: 30, a: 's' },
];
const SVGNS = 'http://www.w3.org/2000/svg';
const svg = $('#lines'), labelsEl = $('#labels');
CALLOUTS.forEach(c => {
  const el = document.createElement('div'); el.className = 'co' + (c.a ? ' accent-' + c.a : '');
  el.innerHTML = `<span class="code">${c.c}</span><span class="t">${c.t}</span>${c.d ? `<span class="s">${c.d}</span>` : ''}`;
  labelsEl.appendChild(el); c.el = el;
  const g = document.createElementNS(SVGNS, 'g'); g.style.opacity = 0;
  const path = document.createElementNS(SVGNS, 'path'); path.setAttribute('fill', 'none'); path.setAttribute('stroke-width', '1');
  const dot = document.createElementNS(SVGNS, 'circle'); dot.setAttribute('r', '2.6');
  const ring = document.createElementNS(SVGNS, 'circle'); ring.setAttribute('r', '7'); ring.setAttribute('fill', 'none'); ring.setAttribute('stroke-width', '1');
  g.append(path, ring, dot); svg.appendChild(g);
  Object.assign(c, { g, path, dot, ring, v: new THREE.Vector3() });
});

/* ============ UI: rail, panels ============ */
const panels = [...document.querySelectorAll('.panel')];
const rail = $('#rail');
SCN.forEach((name, i) => {
  const b = document.createElement('button'); b.type = 'button';
  b.innerHTML = `<span class="lbl">${String(i).padStart(2, '0')} ${name}</span><span class="tick"></span>`;
  b.setAttribute('aria-label', `Scene ${i}: ${name}`);
  b.addEventListener('click', () => goTo(i + (i === 0 ? 0 : 0.5)));
  rail.appendChild(b);
});
const railBtns = [...rail.children];
function scrollable() { return document.documentElement.scrollHeight - innerHeight; }
function goTo(t) { window.scrollTo({ top: (t / T_MAX) * scrollable(), behavior: reduce ? 'auto' : 'smooth' }); }
$('#ctaExplore').addEventListener('click', () => { location.href = '/model.html'; });
$('#ctaTech').addEventListener('click', () => { location.href = '/control.html'; });
$('#home').addEventListener('click', e => { e.preventDefault(); goTo(0); });
const stepEls = [...document.querySelectorAll('#steps li')];
const STEP_T = [15.0, 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.72];


/* ============ REFERENCE PLATES: supplied visuals, each tied to its part in the model ============ */
// Supplied product reference visuals, cropped per subsystem (public/explore/).
const REF_IMG = {
 "full": {
  "src": "/explore/ref-full.jpg",
  "w": 900,
  "h": 644
 },
 "wind": {
  "src": "/explore/ref-wind.jpg",
  "w": 225,
  "h": 700
 },
 "canopy": {
  "src": "/explore/ref-canopy.jpg",
  "w": 900,
  "h": 496
 },
 "chassis": {
  "src": "/explore/ref-chassis.jpg",
  "w": 535,
  "h": 370
 },
 "power": {
  "src": "/explore/ref-power.jpg",
  "w": 420,
  "h": 350
 },
 "catch": {
  "src": "/explore/ref-catch.jpg",
  "w": 250,
  "h": 570
 },
 "tank": {
  "src": "/explore/ref-tank.jpg",
  "w": 250,
  "h": 320
 },
 "filter": {
  "src": "/explore/ref-filter.jpg",
  "w": 240,
  "h": 290
 },
 "base": {
  "src": "/explore/ref-base.jpg",
  "w": 900,
  "h": 227
 }
};
const REFS = {
  1: { img: 'full', code: 'REF 00', t: 'Assembled unit' },
  2: { img: 'wind', code: 'REF 01', t: 'Wind turbine', k: 'vawt-rotor' },
  3: { img: 'canopy', code: 'REF 02', t: 'PV canopy', k: 'pv-array' },
  4: { img: 'chassis', code: 'REF 03', t: 'Enclosures', k: 'power-cabinet' },
  5: { img: 'power', code: 'REF 04', t: 'Control + power', k: 'hybrid-inverter' },
  6: { img: 'catch', code: 'REF 05', t: 'Downpipe', k: 'pipe-0' },
  7: { img: 'tank', code: 'REF 06', t: 'Storage tank', k: 'water-tank' },
  8: { img: 'filter', code: 'REF 07', t: 'Filter train', k: 'filter-header' },
  10: { img: 'base', code: 'REF 08', t: 'Base frame', k: 'foot' },
};
for (const s in REFS) {
  const r = REFS[s]; if (!r.k) continue;
  const c = CALLOUTS.find(c => c.s === +s && c.k === r.k); r.p = c ? c.p : [0, 0, 0]; r.v = new THREE.Vector3();
}
const refEl = $('#ref'), refImg = $('#refImg'), lb = $('#lb');
const refG = document.createElementNS(SVGNS, 'g'); refG.style.opacity = 0;
const refPath = document.createElementNS(SVGNS, 'path'); refPath.setAttribute('fill', 'none'); refPath.setAttribute('stroke-width', '1'); refPath.setAttribute('stroke-dasharray', '2 4');
const refSq = document.createElementNS(SVGNS, 'rect'); refSq.setAttribute('width', 5); refSq.setAttribute('height', 5);
const refDot = document.createElementNS(SVGNS, 'circle'); refDot.setAttribute('r', '3.2'); refDot.setAttribute('fill', 'none'); refDot.setAttribute('stroke-width', '1');
[refPath, refSq, refDot].forEach(e => { e.style.stroke = 'var(--ink-2)'; refG.appendChild(e); }); refSq.style.fill = 'var(--ink-2)';
svg.appendChild(refG);
let refScene = -1, refBox = null, lastLive = [];
const _bx = new THREE.Box3(), _bc = new THREE.Vector3();
function rectOf(objs) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const o of objs) {
    _bx.setFromObject(o); if (_bx.isEmpty()) continue;
    for (let i = 0; i < 8; i++) {
      _bc.set(i & 1 ? _bx.max.x : _bx.min.x, i & 2 ? _bx.max.y : _bx.min.y, i & 4 ? _bx.max.z : _bx.min.z).project(camera);
      const x = (_bc.x * .5 + .5) * W, y = (-_bc.y * .5 + .5) * H;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
  }
  return x1 > x0 ? { x0, y0, x1, y1 } : null;
}
const ovl = (a, b) => { if (!a || !b) return 0; const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0); return w > 0 && h > 0 ? w * h : 0; };
function placeRef(s, pw, ph) {
  const hdr = mobile ? 66 : 80, lm = mobile ? 14 : 36, rm = mobile ? 38 : 100;
  const bottom = mobile ? H * 0.52 - 8 : H - 58;
  const pr = panels[s].getBoundingClientRect();
  let pb = pr.top; for (const ch of panels[s].children) pb = Math.max(pb, ch.getBoundingClientRect().bottom);
  const panelR = mobile ? { x0: 0, y0: H * 0.52, x1: W, y1: H } : { x0: pr.left - 12, y0: pr.top - 12, x1: pr.right + 20, y1: pb + 28 };
  const mid = (Math.max(panelR.x1, 0) + W - rm) / 2 - pw / 2;
  const C = mobile ? [[lm, hdr], [W - rm - pw, hdr]]
    : [[lm, bottom - ph], [W - rm - pw, bottom - ph], [W - rm - pw, hdr], [mid, hdr], [mid, bottom - ph],
       [W - rm - pw, (hdr + bottom - ph) / 2], [panelR.x1 + 8, hdr], [panelR.x1 + 8, bottom - ph],
       [(mid + W - rm - pw) / 2, hdr], [(mid + W - rm - pw) / 2, bottom - ph]];
  const F = FOCUS[s] || new Set(), occ = [];
  for (const k in KEY) {
    const pipe = /^pipe|cable/.test(k);
    if (pipe && !F.has(k)) continue;
    occ.push([rectOf(KEY[k]), F.has(k) ? 2.5 : (s === 1 ? 1 : 0.5)]);
  }
  for (const c of lastLive) {
    occ.push([{ x0: c.x0 - 8, x1: c.x1 + 8, y0: c.ly - c.hh / 2 - 8, y1: c.ly + c.hh / 2 + 8 }, 14]);
    occ.push([{ x0: c.x - 14, x1: c.x + 14, y0: c.y - 14, y1: c.y + 14 }, 30]);
    occ.push([{ x0: Math.min(c.x, c.x0), x1: Math.max(c.x, c.x1), y0: Math.min(c.y, c.ly) - 3, y1: Math.max(c.y, c.ly) + 3 }, 2]);
  }
  if (!mobile) occ.push([panelR, 40]);
  let best = null, bs = 1e18;
  C.forEach(([x, y], i) => {
    const r = { x0: x - 10, y0: y - 10, x1: x + pw + 10, y1: y + ph + 10 };
    if (r.x0 < 0 || r.x1 > W || r.y0 < hdr - 20) return;
    let sc = i * 40; for (const [o, w] of occ) sc += w * ovl(r, o);
    if (sc < bs) { bs = sc; best = { x, y, w: pw, h: ph }; }
  });
  return best || { x: C[0][0], y: C[0][1], w: pw, h: ph };
}
function setRef(s) {
  const r = REFS[s], im = REF_IMG[r.img];
  refImg.src = im.src; refImg.alt = `${r.t}, reference visual`;
  $('#refCode').textContent = r.code; $('#refT').textContent = r.t;
  const asp = im.h / im.w;
  let pw = mobile ? (asp > 1.3 ? 70 : 116) : (asp > 1.3 ? 150 : 228);
  if (!mobile && pw * asp > 250) pw = 250 / asp;
  if (mobile && pw * asp > 112) pw = 112 / asp;
  const ih = Math.round(pw * asp);
  refEl.querySelector('.ref-img').style.cssText = `width:${pw}px;height:${ih}px`;
  const fw = Math.max(pw, mobile ? 104 : 200) + (mobile ? 16 : 24);
  refEl.style.width = fw + 'px';
  refBox = placeRef(s, fw, ih + (mobile ? 34 : 44) + 22);
  refBox.iw = pw; refBox.ih = ih;
  refEl.style.transform = `translate(${refBox.x.toFixed(1)}px, ${refBox.y.toFixed(1)}px)`;
  refScene = s;
}
function openLB() {
  if (refScene < 0) return; const r = REFS[refScene];
  $('#lbImg').src = REF_IMG[r.img].src; $('#lbImg').alt = `${r.t}, reference visual`;
  $('#lbCode').textContent = r.code; $('#lbT').textContent = r.t;
  lb.classList.add('on'); lb.focus?.();
}
$('#refBtn').addEventListener('click', openLB);
lb.tabIndex = -1;
lb.addEventListener('click', () => lb.classList.remove('on'));
addEventListener('keydown', e => { if (e.key === 'Escape') lb.classList.remove('on'); });
addEventListener('resize', () => { refScene = -1; });
function updateRef(t) {
  const s = Math.floor(t + 0.04), r = REFS[s];
  const a = r ? ramp(t, s + 0.3, s + 0.5) * (1 - ramp(t, s + 0.8, s + 0.94)) : 0;
  if (a < 0.01) {
    refEl.style.opacity = 0; refEl.style.visibility = 'hidden'; refEl.classList.remove('live'); refG.style.opacity = 0;
    if (!r || t < s + 0.3) refScene = -1;
    return;
  }
  if (refScene !== s) setRef(s);
  refEl.style.visibility = 'visible'; refEl.style.opacity = a.toFixed(3); refEl.classList.toggle('live', a > 0.6);
  if (!r.k || mobile) { refG.style.opacity = 0; return; }
  anchor(r.k, r.p, r.v).project(camera);
  const ax = (r.v.x * .5 + .5) * W, ay = (-r.v.y * .5 + .5) * H;
  const bx0 = refBox.x + 4, by0 = refBox.y + 4, bx1 = refBox.x + refBox.iw + 20, by1 = refBox.y + refBox.ih + 20;
  const px = clamp(ax, bx0, bx1), py = clamp(ay, by0, by1);
  if (Math.hypot(ax - px, ay - py) < 30) { refG.style.opacity = 0; return; }
  // leave the plate horizontally or vertically, then run straight to the part
  const ex = px === bx0 || px === bx1 ? px + (px === bx1 ? 18 : -18) : px, ey = ex === px ? py + (py === by1 ? 18 : -18) : py;
  refPath.setAttribute('d', `M${px.toFixed(1)} ${py.toFixed(1)}L${ex.toFixed(1)} ${ey.toFixed(1)}L${ax.toFixed(1)} ${ay.toFixed(1)}`);
  refSq.setAttribute('x', (px - 2.5).toFixed(1)); refSq.setAttribute('y', (py - 2.5).toFixed(1));
  refDot.setAttribute('cx', ax.toFixed(1)); refDot.setAttribute('cy', ay.toFixed(1));
  refG.style.opacity = (a * (mobile ? 0.6 : 0.9)).toFixed(3);
}

/* ============ THEME ============ */
let dimColor = new THREE.Color(), paperColor = new THREE.Color(), inkCss = '#000', isDark = false;
function readTheme() {
  const cs = getComputedStyle(document.documentElement);
  const g = n => cs.getPropertyValue(n).trim();
  paperColor.set(g('--paper')); dimColor.set(g('--dim'));
  scene.background = paperColor;
  COL.solar.set(g('--solar')); COL.water.set(g('--water')); COL.orange.set(g('--orange')); COL.ink.set(g('--ink'));
  inkCss = g('--ink');
  isDark = paperColor.getHSL({ h: 0, s: 0, l: 0 }).l < 0.5;
  shadowMat.opacity = parseFloat(g('--shadow')) || .17;
  gridMat.uniforms.uColor.value.set(inkCss); gridMat.uniforms.uAlpha.value = isDark ? .12 : .09;
  hemi.groundColor.copy(paperColor);
  guides.forEach(({ l }) => l.material.color.set(inkCss)); axes.forEach(({ l }) => l.material.color.set(inkCss));
  svg.querySelectorAll('path').forEach(p => p.setAttribute('stroke', inkCss));
  svg.querySelectorAll('circle').forEach((c, i) => c.getAttribute('fill') === 'none' ? c.setAttribute('stroke', inkCss) : c.setAttribute('fill', inkCss));
  meshes.forEach(m => m.userData.dim = -1); // force recolour
}
readTheme();
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', readTheme);
new MutationObserver(readTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

/* ============ LAYOUT ============ */
let W = 1, H = 1, mobile = false, panelRight = 0;
function resize() {
  W = innerWidth; H = innerHeight; mobile = W < 760;
  renderer.setSize(W, H, false);
  camera.aspect = W / H;
  if (mobile) camera.setViewOffset(W, H, 0, H * 0.2, W, H);
  else camera.setViewOffset(W, H, -W * (W > 1100 ? 0.13 : 0.16), 0, W, H);
  camera.updateProjectionMatrix();
  const asp = W / H; camDist = mobile ? 1.78 * Math.max(1, 0.6 / asp) : 1.2 * Math.max(1, 1.55 / asp);
  const r = $('#panels').getBoundingClientRect(); panelRight = mobile ? 0 : r.right;
}
addEventListener('resize', resize); resize();

/* ============ FRAME ============ */
let tTarget = 0, tNow = 0, last = performance.now(), start = last, first = true;
const onScroll = () => { tTarget = clamp(window.scrollY / Math.max(1, scrollable())) * T_MAX; };
addEventListener('scroll', onScroll, { passive: true }); onScroll(); tNow = tTarget;
const dimTarget = {};
const _p = new THREE.Vector3(), _q = new THREE.Vector3(), _c = new THREE.Color();

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const time = (now - start) / 1000;
  tNow = reduce ? tTarget : tNow + (tTarget - tNow) * (1 - Math.exp(-dt * 7));
  if (Math.abs(tTarget - tNow) < 1e-4) tNow = tTarget;
  const t = tNow;

  // explode transforms (all relative to stored original coordinates)
  for (const m of MOVES) {
    m.w = moveWeight(m, t); moveW[m.k] = m.w;
    for (const o of KEY[m.k]) o.position.copy(o.userData.home).addScaledVector(m.off, m.w);
  }
  if (!reduce) ROTOR.rotation.y = rotorY0 + time * (0.35 + 0.9 * sceneAlpha(t, 2));
  modelRoot.updateMatrixWorld(true);

  // highlight / dim
  for (const k in dimTarget) dimTarget[k] = 0;
  for (const s in FOCUS) {
    const a = sceneAlpha(t, +s); if (a < 0.001) continue;
    const f = FOCUS[s];
    for (const m of meshes) { const k = m.userData.dimKey; if (!f.has(k)) dimTarget[k] = Math.max(dimTarget[k] || 0, a); }
  }
  const pipeFade = 1 - 0.8 * ramp(t, 1.6, 2.1) * (1 - ramp(t, 15.66, 15.98));
  for (const m of meshes) {
    const k = m.userData.dimKey; const d = (dimTarget[k] || 0) * 0.8;
    const isConduit = k.startsWith('pipe-') || k === 'pv-cable' || k === 'wind-cable';
    const op = isConduit ? pipeFade : 1;
    if (Math.abs(d - m.userData.dim) > 0.002 || (isConduit && m.userData.op !== op)) {
      m.userData.dim = d; m.userData.op = op;
      m.material.color.copy(m.userData.base).lerp(dimColor, d);
      m.material.envMapIntensity = 1 - d * 0.75;
      if (isConduit) { m.material.transparent = op < 0.999; m.material.opacity = op; m.material.depthWrite = op > 0.5; m.castShadow = op > 0.5; }
    }
  }

  // camera
  camAt(t);
  _d.subVectors(camPos, camTgt);
  const asp = W / H; let k = asp < 1 ? 1 + (1 - asp) * 1.25 : asp < 1.35 ? 1.08 : 1;
  if (!reduce) k *= 1 + 0.12 * (1 - ease(clamp((time - 0.2) / 2.6)));
  _d.multiplyScalar(k);
  if (!reduce) { const orbit = THREE.MathUtils.degToRad(3.5) * Math.sin(time * 0.22) * ramp(t, 15.95, 16.4); _d.applyAxisAngle(THREE.Object3D.DEFAULT_UP, orbit); }
  camera.position.copy(camTgt).add(_d); camera.lookAt(camTgt);
  camera.updateMatrixWorld();

  // lights
  sunLight.intensity = 1.5 * sceneAlpha(t, 3) + 0.6 * sceneAlpha(t, 12);
  sunLight.target = KEY['pv-array'][0];

  // flows + guides
  for (const f of flows) f.update(t, time);
  const guideGlobal = 1 - 0.45 * clamp(sceneAlpha(t, 12) + sceneAlpha(t, 13) + sceneAlpha(t, 14));
  for (const g of guides) {
    const w = moveW[g.k] || 0; const o = KEY[g.k][0];
    if (w < 0.01) { g.l.visible = false; continue; }
    g.l.visible = true; o.getWorldPosition(_p);
    _q.copy(o.userData.home); o.parent.localToWorld(_q); // where this part sits if only its parents had moved
    const arr = g.l.geometry.attributes.position.array; _q.toArray(arr, 0); _p.toArray(arr, 3);
    g.l.geometry.attributes.position.needsUpdate = true; g.l.computeLineDistances();
    g.l.material.opacity = 0.5 * w * guideGlobal;
  }
  const axisA = 0.4 * ramp(t, 1.1, 1.6) * (1 - ramp(t, 10.8, 11.2));
  for (const a of axes) {
    const o = KEY[a.k][0]; o.getWorldPosition(_p); a.l.position.copy(_p).sub(o.userData.homeWorld);
    a.l.material.opacity = a.k === 'wind-mast' ? Math.max(axisA, 0.5 * sceneAlpha(t, 2)) : axisA;
  }

  renderer.render(scene, camera);

  // ---- DOM overlays ----
  let cur = 0, best = -1;
  panels.forEach((p, i) => {
    const a = sceneAlpha(t, i);
    if (a > best) { best = a; cur = i; }
    p.style.opacity = a.toFixed(3);
    const vis = a > 0.02; p.style.visibility = vis ? 'visible' : 'hidden';
    p.classList.toggle('live', a > 0.6);
  });
  $('#oneSys').style.opacity = ramp(t, 14.35, 14.55).toFixed(3);
  stepEls.forEach((li, i) => li.classList.toggle('done', t >= STEP_T[i] + 0.2));
  railBtns.forEach((b, i) => b.classList.toggle('on', i === cur));
  $('#sc').textContent = String(cur).padStart(2, '0');
  $('#scn').textContent = SCN[cur];

  const live = [];
  for (const c of CALLOUTS) {
    const a = (mobile && c.mh) ? 0 : sceneAlpha(t, c.s) * ramp(t, c.s + 0.12, c.s + 0.4);
    if (a < 0.01) { if (c.on) { c.el.style.opacity = 0; c.g.style.opacity = 0; c.on = false; } continue; }
    if (!c.on || !c.hh) { c.hh = c.el.offsetHeight || 44; c.ww = c.el.offsetWidth || 160; }
    c.on = true; c.a = a;
    anchor(c.k, c.p, c.v).project(camera);
    c.x = (c.v.x * .5 + .5) * W; c.y = (-c.v.y * .5 + .5) * H;
    let side = c.side; const dx = mobile ? 44 : 78;
    const labW = c.ww + 12;
    if (!mobile && side === 'l' && c.x - dx - labW < panelRight + 16) side = 'r';
    if (side === 'l' && c.x - dx - labW < 8) side = 'r';
    if (side === 'r' && c.x + dx + labW > W - (mobile ? 24 : 64) && c.x - dx - labW > (mobile ? 8 : panelRight + 16)) side = 'l';
    c.sd = side; c.ly = c.y + c.dy * (mobile ? 0.6 : 1);
    live.push(c);
  }
  // keep labels from stacking on top of each other (either side)
  const top = mobile ? 64 : 70, bot = H - (mobile ? H * 0.42 : 40);
  const lw = mobile ? 150 : 200;
  for (const c of live) {
    const dx = mobile ? 44 : 78, sg = c.sd === 'r' ? 1 : -1, lx = c.x + sg * (dx * 0.6 + 40);
    c.x0 = c.sd === 'r' ? lx : lx - c.ww; c.x1 = c.x0 + c.ww;
  }
  live.sort((p, q) => p.ly - q.ly);
  for (let pass = 0; pass < 6; pass++) {
    for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
      const A = live[i], B = live[j];
      if (A.x1 < B.x0 - 6 || B.x1 < A.x0 - 6) continue;
      const need = (A.hh + B.hh) / 2 + 6, gap = B.ly - A.ly;
      if (Math.abs(gap) < need) { const d = (need - Math.abs(gap)) / 2 * (gap >= 0 ? 1 : -1); A.ly -= d; B.ly += d; }
    }
    live.forEach(c => c.ly = clamp(c.ly, top + c.hh / 2, Math.max(top + c.hh / 2, bot - c.hh / 2)));
  }
  for (const c of live) {
    const { x, y, ly, a } = c, side = c.sd, sg = side === 'r' ? 1 : -1, dx = mobile ? 44 : 78;
    const ex = x + sg * Math.min(Math.abs(ly - y), 40) * 0.8;
    const lx = ex + sg * dx * 0.6;
    c.path.setAttribute('d', `M${x.toFixed(1)} ${y.toFixed(1)}L${ex.toFixed(1)} ${ly.toFixed(1)}L${lx.toFixed(1)} ${ly.toFixed(1)}`);
    c.dot.setAttribute('cx', x); c.dot.setAttribute('cy', y); c.ring.setAttribute('cx', x); c.ring.setAttribute('cy', y);
    c.g.style.opacity = a.toFixed(3);
    c.el.classList.toggle('l', side === 'l');
    c.el.style.opacity = a.toFixed(3);
    c.el.style.transform = `translate(${(lx + sg * 8).toFixed(1)}px, ${ly.toFixed(1)}px) translate(${side === 'l' ? '-100%' : '0'}, -50%)`;
  }

  lastLive = live;
  updateRef(t);

  // readout
  const az = Math.atan2(_d.x, _d.z) * 180 / Math.PI, el = Math.asin(_d.y / _d.length()) * 180 / Math.PI;
  $('#ro').textContent = `AZ ${az.toFixed(1)}°  EL ${el.toFixed(1)}°  T ${t.toFixed(2)}`;

  if (first) { first = false; $('#veil').classList.add('gone'); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
