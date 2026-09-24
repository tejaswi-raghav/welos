import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const COLORS = {
  casing: 0xc8cbc5,
  dark: 0x151a18,
  plate: 0x343a36,
  green: 0x136d46,
  copper: 0xd47a28,
  amber: 0xffb62e,
  blue: 0x3c8bd2,
  cyan: 0x53b8b2,
  red: 0xc34b3c,
  white: 0xe8ece6,
};

const VIEW_PRESETS = {
  overview: { camera: [10.5, 8.2, 15], target: [0, 0, 0], zoom: 1 },
  controller: { camera: [5.6, 3.6, 8.5], target: [0, 0.1, 0], zoom: 1 },
  solar: { camera: [-8.5, 5.3, 8.4], target: [-5.8, 2.3, 0], zoom: 1 },
  wind: { camera: [8.8, 5.8, 8.4], target: [5.8, 2.4, 0], zoom: 1 },
  water: { camera: [-9.2, 1.1, 7.4], target: [-5.8, -2.6, 0], zoom: 1 },
  storage: { camera: [9.2, 1.4, 7.5], target: [5.5, -2.6, 0], zoom: 1 },
};
const CONTROLLER_EXPLODED_CAMERA = new THREE.Vector3(10.5, 6.8, 16.5);

function material(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    metalness: options.metalness ?? 0.25,
    roughness: options.roughness ?? 0.45,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
    side: options.side ?? THREE.FrontSide,
  });
}

function box(size, color, options = {}) {
  const geometry = new THREE.BoxGeometry(...size);
  const mesh = new THREE.Mesh(geometry, material(color, options));
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

function cylinder(radius, height, color, radialSegments = 32, options = {}) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, height, radialSegments),
    material(color, options),
  );
  return mesh;
}

function assignPart(object, id, registry, explode = [0, 0, 0]) {
  object.userData.partId = id;
  object.userData.home = object.position.clone();
  object.userData.explode = new THREE.Vector3(...explode);
  object.userData.targetPosition = new THREE.Vector3();
  registry.set(id, object);
  object.traverse((child) => {
    if (child.isMesh) child.userData.partId = id;
  });
  return object;
}

function createController(registry) {
  const cabinet = new THREE.Group();
  cabinet.name = "WELOS controller cabinet";

  const enclosure = new THREE.Group();
  const shellMat = material(COLORS.casing, { metalness: 0.72, roughness: 0.3 });
  const walls = [
    [[4.4, 0.16, 4.9], [0, 0, -0.82]],
    [[4.4, 0.22, 1.1], [0, 2.34, -0.28]],
    [[4.4, 0.22, 1.1], [0, -2.34, -0.28]],
    [[0.22, 4.48, 1.1], [-2.09, 0, -0.28]],
    [[0.22, 4.48, 1.1], [2.09, 0, -0.28]],
  ];
  walls.forEach(([size, pos]) => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(...size), shellMat);
    wall.position.set(...pos);
    enclosure.add(wall);
  });
  const door = box([4.18, 4.36, 0.14], COLORS.casing, { metalness: 0.72, roughness: 0.28 });
  door.position.z = 0.83;
  const window = box([2.8, 1.05, 0.035], COLORS.dark, { metalness: 0.1, roughness: 0.18 });
  window.position.set(0, 0.48, 0.91);
  door.add(window);
  const lock = cylinder(0.09, 0.05, COLORS.dark, 20, { metalness: 0.8, roughness: 0.25 });
  lock.rotation.x = Math.PI / 2;
  lock.position.set(1.7, 0, 0.92);
  const statusLight = cylinder(0.055, 0.035, COLORS.green, 16, { metalness: 0.1, roughness: 0.28 });
  statusLight.name = "controller-status-light";
  statusLight.rotation.x = Math.PI / 2;
  statusLight.position.set(1.7, -1.68, 0.93);
  statusLight.material.emissive.setHex(COLORS.green);
  enclosure.add(door, lock, statusLight);
  cabinet.add(assignPart(enclosure, "enclosure", registry, [5.2, 0, 1.8]));

  const backplate = box([3.72, 4.05, 0.12], COLORS.plate, { metalness: 0.78, roughness: 0.36 });
  backplate.position.set(0, 0, -0.48);
  cabinet.add(assignPart(backplate, "backplate", registry, [0, 0, -2.2]));

  const pcb = new THREE.Group();
  const board = box([2.25, 1.25, 0.12], COLORS.green, { metalness: 0.05, roughness: 0.56 });
  pcb.add(board);
  const chip = box([0.6, 0.54, 0.12], COLORS.dark, { roughness: 0.3 });
  chip.position.set(-0.22, 0.08, 0.12);
  pcb.add(chip);
  for (let i = 0; i < 10; i += 1) {
    const pin = box([0.05, 0.16, 0.04], COLORS.copper, { metalness: 0.8, roughness: 0.3 });
    pin.position.set(-0.65 + i * 0.145, -0.48, 0.12);
    pcb.add(pin);
  }
  const antenna = box([0.5, 0.24, 0.05], 0xc8a465, { metalness: 0.68, roughness: 0.32 });
  antenna.position.set(0.68, 0.34, 0.1);
  pcb.add(antenna);
  pcb.position.set(-0.52, 0.77, -0.24);
  cabinet.add(assignPart(pcb, "controller-pcb", registry, [-2.6, 1.4, 1.8]));

  const meter = new THREE.Group();
  const meterBody = box([0.84, 1.38, 0.48], COLORS.white, { roughness: 0.42 });
  const meterScreen = box([0.56, 0.34, 0.035], 0x16221d, { roughness: 0.15 });
  meterScreen.position.set(0, 0.25, 0.26);
  meter.add(meterBody, meterScreen);
  meter.position.set(1.2, 0.64, -0.18);
  cabinet.add(assignPart(meter, "energy-meter", registry, [2.8, 1.6, 1.5]));

  const protection = new THREE.Group();
  const rail = box([3.18, 0.16, 0.14], 0x8d9490, { metalness: 0.85, roughness: 0.28 });
  rail.position.z = -0.14;
  protection.add(rail);
  const deviceColors = [COLORS.white, COLORS.white, COLORS.red, COLORS.white, COLORS.amber];
  deviceColors.forEach((color, i) => {
    const unit = box([0.52, 0.98, 0.42], color, { roughness: 0.42 });
    unit.position.set(-1.22 + i * 0.61, 0, 0.06);
    const toggle = box([0.18, 0.3, 0.07], COLORS.dark, { roughness: 0.3 });
    toggle.position.set(-1.22 + i * 0.61, 0.16, 0.3);
    protection.add(unit, toggle);
  });
  protection.position.set(0, -0.52, -0.14);
  cabinet.add(assignPart(protection, "protection", registry, [0, -2.3, 1.7]));

  const comms = new THREE.Group();
  const commsBody = box([1.05, 0.76, 0.38], 0x222b27, { metalness: 0.25, roughness: 0.45 });
  comms.add(commsBody);
  for (let i = 0; i < 4; i += 1) {
    const led = cylinder(0.035, 0.025, i === 0 ? COLORS.amber : COLORS.green, 12, { roughness: 0.25 });
    led.rotation.x = Math.PI / 2;
    led.position.set(-0.33 + i * 0.22, 0.18, 0.21);
    comms.add(led);
  }
  comms.position.set(-1.18, -1.45, -0.18);
  cabinet.add(assignPart(comms, "communications", registry, [-2.8, -1.6, 1.6]));

  const terminals = new THREE.Group();
  const terminalColors = [COLORS.blue, COLORS.blue, COLORS.white, COLORS.white, COLORS.green, COLORS.green];
  terminalColors.forEach((color, i) => {
    const terminal = box([0.34, 0.62, 0.38], color, { roughness: 0.48 });
    terminal.position.x = -0.88 + i * 0.36;
    terminals.add(terminal);
  });
  terminals.position.set(0.78, -1.47, -0.19);
  cabinet.add(assignPart(terminals, "terminal-blocks", registry, [2.9, -1.5, 1.5]));

  const fan = new THREE.Group();
  const fanRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.45, 0.07, 12, 40),
    material(COLORS.dark, { metalness: 0.35, roughness: 0.45 }),
  );
  fan.add(fanRing);
  for (let i = 0; i < 5; i += 1) {
    const blade = box([0.12, 0.52, 0.04], 0x59615d, { roughness: 0.45 });
    blade.position.y = 0.22;
    blade.rotation.z = i * ((Math.PI * 2) / 5) + 0.35;
    fan.add(blade);
  }
  fan.position.set(1.35, 1.55, -0.2);
  cabinet.add(assignPart(fan, "thermal-management", registry, [2.8, 2.2, 1.7]));

  cabinet.scale.setScalar(0.82);
  cabinet.position.y = 0.1;
  return cabinet;
}

function createSolar(registry) {
  const group = new THREE.Group();
  const array = new THREE.Group();
  const frame = box([3.35, 1.9, 0.12], 0x485258, { metalness: 0.75, roughness: 0.3 });
  array.add(frame);
  const cellGeo = new THREE.BoxGeometry(0.48, 0.36, 0.035);
  const cells = new THREE.InstancedMesh(cellGeo, material(0x174d68, { metalness: 0.35, roughness: 0.3 }), 24);
  const matrix = new THREE.Matrix4();
  let index = 0;
  for (let y = 0; y < 4; y += 1) for (let x = 0; x < 6; x += 1) {
    matrix.makeTranslation(-1.3 + x * 0.52, -0.6 + y * 0.4, 0.08);
    cells.setMatrixAt(index++, matrix);
  }
  array.add(cells);
  group.add(assignPart(array, "pv-array", registry));

  const rack = new THREE.Group();
  [-1.25, 1.25].forEach((x) => {
    const leg = box([0.13, 2.2, 0.13], 0x69716d, { metalness: 0.8, roughness: 0.32 });
    leg.rotation.z = -0.42;
    leg.position.set(x, -1.08, -0.65);
    rack.add(leg);
  });
  group.add(assignPart(rack, "pv-racking", registry));

  const gutter = box([3.55, 0.18, 0.22], COLORS.cyan, { metalness: 0.45, roughness: 0.3 });
  gutter.position.set(0, -1.03, 0.03);
  group.add(assignPart(gutter, "rain-gutter", registry));
  group.rotation.x = -0.25;
  group.rotation.y = 0.28;
  group.position.set(-5.8, 2.35, 0);
  return group;
}

function createWind(registry) {
  const group = new THREE.Group();
  const mast = cylinder(0.11, 3.4, 0x9aa19d, 24, { metalness: 0.85, roughness: 0.27 });
  mast.position.y = -1.15;
  group.add(mast);

  const rotor = new THREE.Group();
  rotor.name = "wind-rotor";
  const shaft = cylinder(0.1, 2.7, COLORS.copper, 20, { metalness: 0.8, roughness: 0.24 });
  rotor.add(shaft);
  for (let i = 0; i < 3; i += 1) {
    const blade = box([0.18, 2.45, 0.62], COLORS.white, { metalness: 0.22, roughness: 0.34 });
    blade.position.x = 0.67;
    blade.rotation.y = i * ((Math.PI * 2) / 3);
    rotor.add(blade);
  }
  rotor.position.y = 1.15;
  group.add(assignPart(rotor, "vawt-rotor", registry));
  const generator = cylinder(0.47, 0.58, COLORS.dark, 28, { metalness: 0.58, roughness: 0.34 });
  generator.position.y = -0.55;
  group.add(assignPart(generator, "wind-generator", registry));
  const brake = cylinder(0.55, 0.18, COLORS.red, 28, { metalness: 0.65, roughness: 0.3 });
  brake.position.y = -0.18;
  group.add(assignPart(brake, "wind-brake", registry));
  group.position.set(5.8, 2.35, 0);
  group.scale.setScalar(0.86);
  return group;
}

function createWater(registry) {
  const group = new THREE.Group();
  const tank = cylinder(1.05, 2.05, 0x345f66, 40, { metalness: 0.2, roughness: 0.52 });
  tank.position.set(0, -0.15, 0);
  group.add(assignPart(tank, "water-tank", registry));
  const firstFlush = cylinder(0.2, 1.7, COLORS.cyan, 24, { metalness: 0.3, roughness: 0.4 });
  firstFlush.position.set(-1.42, 0.15, 0);
  group.add(assignPart(firstFlush, "first-flush", registry));

  const filters = new THREE.Group();
  [0xeeeeea, 0x78aebb, 0x222b27].forEach((color, i) => {
    const canister = cylinder(0.22, 1.05, color, 24, { metalness: 0.2, roughness: 0.38 });
    canister.position.x = -0.52 + i * 0.52;
    filters.add(canister);
  });
  filters.position.set(1.62, -0.15, 0);
  group.add(assignPart(filters, "filter-train", registry));
  const pump = cylinder(0.32, 0.72, COLORS.dark, 24, { metalness: 0.6, roughness: 0.34 });
  pump.rotation.z = Math.PI / 2;
  pump.position.set(1.25, -1.2, 0);
  group.add(assignPart(pump, "water-pump", registry));
  const sensors = new THREE.Group();
  for (let i = 0; i < 3; i += 1) {
    const probe = cylinder(0.07, 0.62, COLORS.amber, 16, { metalness: 0.7, roughness: 0.25 });
    probe.position.set(-0.28 + i * 0.28, 1.18, 0);
    sensors.add(probe);
  }
  group.add(assignPart(sensors, "water-sensors", registry));
  group.position.set(-5.8, -2.6, 0);
  group.scale.setScalar(0.9);
  return group;
}

function createEnergyCore(registry) {
  const group = new THREE.Group();
  const makeUnit = (id, pos, size, color) => {
    const unit = box(size, color, { metalness: 0.48, roughness: 0.38 });
    unit.position.set(...pos);
    group.add(assignPart(unit, id, registry));
  };
  makeUnit("lifepo4-battery", [-0.7, -0.55, 0], [1.35, 2.25, 1.15], 0x26312c);
  makeUnit("hybrid-inverter", [0.78, 0.55, 0], [1.25, 1.55, 0.75], COLORS.white);
  makeUnit("mppt", [0.4, -0.9, 0.05], [0.68, 0.72, 0.62], COLORS.green);
  makeUnit("wind-rectifier", [1.2, -0.9, 0.05], [0.68, 0.72, 0.62], COLORS.blue);
  makeUnit("dc-bus", [0.1, 1.62, 0], [2.7, 0.22, 0.35], COLORS.copper);
  makeUnit("load-panel", [1.75, 0.35, 0], [0.62, 1.95, 0.72], COLORS.dark);
  group.position.set(5.35, -2.6, 0);
  group.scale.setScalar(0.9);
  return group;
}

function createConnection(from, to, color) {
  const points = [
    new THREE.Vector3(...from),
    new THREE.Vector3(from[0] * 0.55, from[1] * 0.55, -0.55),
    new THREE.Vector3(...to),
  ];
  const curve = new THREE.CatmullRomCurve3(points);
  const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(64));
  const mat = new THREE.LineDashedMaterial({ color, dashSize: 0.22, gapSize: 0.14, transparent: true, opacity: 0.74 });
  const line = new THREE.Line(geometry, mat);
  line.computeLineDistances();
  line.userData.flowLine = true;
  return line;
}

export function createWelosScene(container, { onSelect, onReady, onError }) {
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const registry = new Map();
  let disposed = false;
  let exploded = 0;
  let currentView = "overview";
  let selectedId = null;
  const targetCamera = new THREE.Vector3(...VIEW_PRESETS.overview.camera);
  const targetLook = new THREE.Vector3(...VIEW_PRESETS.overview.target);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch (error) {
    onError?.(error);
    return null;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 760 ? 1.35 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.transmissionResolutionScale = 0.5;
  renderer.domElement.setAttribute("aria-label", "Interactive 3D model of the WELOS solar, wind, water, storage and control hardware");
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x101312, 0.028);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.copy(targetCamera);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = !prefersReduced;
  controls.dampingFactor = 0.075;
  controls.minDistance = 4.2;
  controls.maxDistance = 25;
  controls.maxPolarAngle = Math.PI * 0.82;
  controls.target.copy(targetLook);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.05).texture;
  pmrem.dispose();

  const key = new THREE.DirectionalLight(0xffe2a8, 3.4);
  key.position.set(-7, 9, 8);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x79aee7, 2.1);
  rim.position.set(8, 2, -5);
  scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xc9d7cf, 0x171c19, 1.4));

  const root = new THREE.Group();
  scene.add(root);
  root.add(createController(registry), createSolar(registry), createWind(registry), createWater(registry), createEnergyCore(registry));
  root.add(
    createConnection([-4.4, 1.8, -0.1], [-1.6, 0.9, -0.2], COLORS.amber),
    createConnection([4.4, 1.8, -0.1], [1.6, 0.9, -0.2], COLORS.blue),
    createConnection([-4.4, -2.3, -0.1], [-1.6, -0.9, -0.2], COLORS.cyan),
    createConnection([4.1, -2.3, -0.1], [1.6, -0.9, -0.2], COLORS.copper),
  );

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(12, 72),
    new THREE.MeshBasicMaterial({ color: 0x171b19, transparent: true, opacity: 0.58 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -4.1;
  scene.add(floor);

  const grid = new THREE.GridHelper(24, 24, 0x56615b, 0x28302c);
  grid.position.y = -4.05;
  grid.material.transparent = true;
  grid.material.opacity = 0.34;
  scene.add(grid);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const interactiveMeshes = [];
  root.traverse((object) => {
    if (object.isMesh && object.userData.partId) interactiveMeshes.push(object);
  });

  function selectPart(id, notify = false) {
    if (selectedId && registry.has(selectedId)) {
      registry.get(selectedId).traverse((child) => {
        if (child.isMesh && child.material?.emissive) {
          child.material.emissive.setHex(0x000000);
          child.material.emissiveIntensity = 0;
        }
      });
    }
    selectedId = id;
    if (id && registry.has(id)) {
      registry.get(id).traverse((child) => {
        if (child.isMesh && child.material?.emissive) {
          child.material.emissive.setHex(COLORS.amber);
          child.material.emissiveIntensity = 0.18;
        }
      });
      if (notify) onSelect?.(id);
    }
    requestRender();
  }

  function onPointerDown(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(interactiveMeshes, false)[0];
    if (hit?.object?.userData?.partId) selectPart(hit.object.userData.partId, true);
  }
  renderer.domElement.addEventListener("pointerdown", onPointerDown);

  function setExploded(value) {
    exploded = THREE.MathUtils.clamp(value, 0, 1);
    if (currentView === "controller") {
      targetCamera
        .set(...VIEW_PRESETS.controller.camera)
        .lerp(CONTROLLER_EXPLODED_CAMERA, exploded);
    }
    requestRender();
  }

  function setView(id) {
    const preset = VIEW_PRESETS[id] || VIEW_PRESETS.overview;
    currentView = id;
    targetCamera.set(...preset.camera);
    targetLook.set(...preset.target);
    if (id !== "controller") setExploded(0);
    requestRender();
  }

  function reset() {
    setView("overview");
    setExploded(0);
    selectPart(null);
  }

  function resizeToDisplay() {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    const dpr = renderer.getPixelRatio();
    if (renderer.domElement.width === Math.round(width * dpr) && renderer.domElement.height === Math.round(height * dpr)) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  let last = performance.now();
  let framePending = false;
  function render(now = performance.now()) {
    if (disposed) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    resizeToDisplay();

    const blend = prefersReduced ? 1 : 1 - Math.pow(1 - 0.085, dt * 60);
    camera.position.lerp(targetCamera, blend);
    controls.target.lerp(targetLook, blend);

    registry.forEach((object) => {
      if (!object.userData.home || !object.userData.explode) return;
      const targetPosition = object.userData.targetPosition
        .copy(object.userData.home)
        .addScaledVector(object.userData.explode, exploded);
      object.position.lerp(targetPosition, prefersReduced ? 1 : 1 - Math.pow(1 - 0.12, dt * 60));
    });

    if (!prefersReduced) {
      const windRotor = root.getObjectByName("wind-rotor");
      const statusLight = root.getObjectByName("controller-status-light");
      if (windRotor) windRotor.rotation.y = now * 0.00035;
      if (statusLight) statusLight.material.emissiveIntensity = 0.45 + Math.sin(now * 0.003) * 0.32;
      root.children.forEach((child) => {
        if (child.userData.flowLine && child.material) child.material.dashOffset = -(now * 0.00022);
      });
    }
    controls.update();
    renderer.render(scene, camera);
  }

  function requestRender() {
    if (!prefersReduced || framePending || disposed) return;
    framePending = true;
    requestAnimationFrame((now) => {
      framePending = false;
      render(now);
    });
  }

  if (prefersReduced) {
    controls.addEventListener("change", requestRender);
    requestRender();
  } else {
    renderer.setAnimationLoop(render);
  }
  requestAnimationFrame(() => {
    if (!prefersReduced) render(performance.now());
    onReady?.();
  });

  return {
    setExploded,
    setView,
    selectPart,
    reset,
    get view() { return currentView; },
    dispose() {
      disposed = true;
      renderer.setAnimationLoop(null);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      controls.removeEventListener("change", requestRender);
      controls.dispose();
      root.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          const mats = Array.isArray(object.material) ? object.material : [object.material];
          mats.forEach((mat) => mat.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
