import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

// Dimensions are visual proportions for an integrated rooftop concept, not fabrication CAD.
const C = {
  shell: 0xdbe3dd, frame: 0x687d79, dark: 0x172622, black: 0x101a1b,
  glass: 0x143b52, cell: 0x1b5574, solar: 0xf7ba4e, water: 0x48bdd1,
  wind: 0x94d7dd, energy: 0xf38c5c, green: 0x42be92, safety: 0xe76250,
};
const VIEWS = {
  overview: { eye: [9.5, 6.8, 11.5], look: [0, 0.65, 0] },
  controller: { eye: [3.7, 1.9, 6.2], look: [-0.05, -0.75, 1.65] },
  solar: { eye: [3.4, 6.7, 7.4], look: [-1.05, 1.65, -0.45] },
  wind: { eye: [7.6, 5.6, 5.6], look: [3.2, 2.05, -0.75] },
  water: { eye: [-5.6, 1.25, 5.2], look: [-2.4, -0.68, 1.25] },
  storage: { eye: [5.6, 1.6, 5.7], look: [1.45, -0.72, 1.5] },
};

function mat(color, metalness = 0.25, roughness = 0.43, extras = {}) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness, ...extras });
}
function block(size, color, radius = 0.055, metalness = 0.3) {
  const [x, y, z] = size;
  return new THREE.Mesh(new RoundedBoxGeometry(x, y, z, 3, Math.min(radius, x / 5, y / 5, z / 5)), mat(color, metalness));
}
function cyl(radius, height, color, metalness = 0.3, segments = 32) {
  return new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, segments), mat(color, metalness));
}
function place(parent, object, x, y, z) {
  object.position.set(x, y, z);
  parent.add(object);
  return object;
}
function beam(parent, a, b, radius, color, metalness = 0.45) {
  const start = new THREE.Vector3(...a);
  const end = new THREE.Vector3(...b);
  const mesh = cyl(radius, start.distanceTo(end), color, metalness, 12);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.sub(start).normalize());
  parent.add(mesh);
  return mesh;
}
function pipe(parent, points, radius, color, opacity = 1) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const mesh = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 48, radius, 8, false),
    mat(color, 0.36, 0.3, { transparent: opacity < 1, opacity }),
  );
  parent.add(mesh);
  return mesh;
}
function register(parent, registry, id, object, at, separated = [0, 0, 0]) {
  object.position.set(...at);
  object.userData.partId = id;
  object.userData.home = object.position.clone();
  object.userData.separated = new THREE.Vector3(...separated);
  object.userData.destination = new THREE.Vector3();
  object.traverse((child) => {
    if (child.isMesh) child.userData.partId = id;
  });
  registry.set(id, object);
  parent.add(object);
  return object;
}

function addPlatform(root) {
  place(root, block([8.9, 0.24, 6.2], 0x53645f, 0.12, 0.65), 0, -2.07, 0);
  place(root, block([8.6, 0.07, 5.9], 0x273b37, 0.04, 0.4), 0, -1.91, 0);
  [-3.75, 3.75].forEach((x) => [-2.3, 2.3].forEach((z) => {
    place(root, block([0.52, 0.2, 0.52], 0x879891, 0.04, 0.7), x, -2.28, z);
    place(root, cyl(0.085, 0.045, C.black, 0.8, 16), x, -2.16, z);
  }));
  place(root, block([7.6, 0.05, 0.08], C.green, 0.015, 0.3), 0, -1.95, 3.1);
}

function addSolar(root, registry) {
  [-3.7, 1.85].forEach((x) => [-2, 1.6].forEach((z) => {
    beam(root, [x, -1.89, z], [x, 1.35, z], 0.065, C.frame, 0.72);
    place(root, block([0.25, 0.11, 0.25], 0x9cad9f, 0.02, 0.72), x, 1.34, z);
  }));
  const canopy = new THREE.Group();
  place(canopy, block([6.05, 0.045, 3.7], 0x879b94, 0.025, 0.65), 0, -0.21, 0);
  const rack = new THREE.Group();
  [-1.65, 1.65].forEach((z) => {
    place(rack, block([5.95, 0.13, 0.1], C.frame, 0.025, 0.72), 0, -0.13, z);
  });
  [-2.85, 0, 2.85].forEach((x) => {
    place(rack, block([0.12, 0.1, 3.72], C.frame, 0.025, 0.72), x, -0.15, 0);
  });
  register(canopy, registry, "pv-racking", rack, [0, 0, 0], [0, -0.55, -0.15]);

  const panels = new THREE.Group();
  for (let row = 0; row < 2; row += 1) for (let col = 0; col < 3; col += 1) {
    const panel = new THREE.Group();
    place(panel, block([1.84, 0.09, 1.7], C.black, 0.025, 0.62), 0, 0, 0);
    place(panel, block([1.75, 0.014, 1.61], C.glass, 0.012, 0.3), 0, 0.054, 0);
    const geometry = new THREE.BoxGeometry(0.21, 0.007, 0.34);
    const cells = new THREE.InstancedMesh(geometry, mat(C.cell, 0.4, 0.23), 40);
    const transform = new THREE.Matrix4();
    let i = 0;
    for (let rz = 0; rz < 5; rz += 1) for (let cx = 0; cx < 8; cx += 1) {
      transform.makeTranslation(-0.77 + cx * 0.22, 0.065, -0.66 + rz * 0.33);
      cells.setMatrixAt(i++, transform);
    }
    panel.add(cells);
    place(panels, panel, -1.92 + col * 1.92, 0, -0.88 + row * 1.76);
  }
  register(canopy, registry, "pv-array", panels, [0, 0.05, 0], [0, 0.85, 0]);

  const gutter = new THREE.Group();
  place(gutter, block([6.1, 0.16, 0.23], 0x5da9ae, 0.06, 0.6), 0, -0.08, 1.82);
  place(gutter, block([0.2, 0.15, 3.78], 0x5da9ae, 0.045, 0.6), -3, -0.08, 0);
  place(gutter, block([0.2, 0.15, 3.78], 0x5da9ae, 0.045, 0.6), 3, -0.08, 0);
  register(canopy, registry, "rain-gutter", gutter, [0, 0, 0], [-0.3, 0.12, 0.75]);

  const soiling = new THREE.Group();
  place(soiling, block([0.25, 0.08, 0.2], C.black, 0.015, 0.35), 0, 0, 0);
  place(soiling, block([0.17, 0.009, 0.12], C.cell, 0.006, 0.2), 0, 0.05, 0);
  register(canopy, registry, "soiling-sensor", soiling, [-2.74, 0.13, -1.53], [-0.5, 0.5, -0.15]);

  const cleaning = new THREE.Group();
  place(cleaning, block([5.75, 0.07, 0.09], C.water, 0.023, 0.5), 0, 0, 0);
  for (let i = 0; i < 10; i += 1) {
    const nozzle = cyl(0.035, 0.11, C.shell, 0.55, 12);
    nozzle.rotation.x = Math.PI / 2;
    place(cleaning, nozzle, -2.6 + i * 0.58, 0, 0.09);
  }
  register(canopy, registry, "cleaning-manifold", cleaning, [0, 0.12, -1.83], [0, 0.55, -0.42]);
  canopy.rotation.x = -0.12;
  canopy.position.set(-0.95, 1.62, -0.28);
  root.add(canopy);
  const solarCable = pipe(root, [[-0.95, 1.5, -0.3], [-0.95, 0.85, -0.3], [1.3, 0.85, -0.3], [1.3, 0.08, 1.45]], 0.025, C.solar);
  solarCable.name = "solar-cable";
}

function helixBlade(phase) {
  const vertices = [];
  const indices = [];
  const bands = 24;
  for (let i = 0; i <= bands; i += 1) {
    const t = i / bands;
    const theta = phase + t * 0.78;
    const center = new THREE.Vector3(Math.cos(theta) * 0.7, -1.08 + t * 2.16, Math.sin(theta) * 0.7);
    const tangent = new THREE.Vector3(-Math.sin(theta), 0, Math.cos(theta));
    for (const edge of [-1, 1]) {
      const p = center.clone().addScaledVector(tangent, edge * 0.22);
      vertices.push(p.x, p.y, p.z);
    }
    if (i < bands) {
      const n = i * 2;
      indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat(C.shell, 0.56, 0.3, { side: THREE.DoubleSide }));
}

function addWind(root, registry) {
  const support = new THREE.Group();
  beam(support, [0, -2.05, 0], [0, 0.33, 0], 0.13, C.frame, 0.8);
  place(support, cyl(0.4, 0.12, 0x7f9692, 0.68), 0, -2.04, 0);
  place(support, cyl(0.1, 2.25, 0x8b9d98, 0.7), 0, 1.44, 0);
  support.position.set(3.25, 0, -0.9);
  root.add(support);

  const generator = new THREE.Group();
  place(generator, cyl(0.45, 0.5, C.black, 0.65), 0, 0, 0);
  for (let i = 0; i < 16; i += 1) {
    const fin = block([0.08, 0.32, 0.03], C.frame, 0.008, 0.55);
    fin.rotation.y = i * Math.PI / 8;
    place(generator, fin, Math.cos(i * Math.PI / 8) * 0.44, 0, Math.sin(i * Math.PI / 8) * 0.44);
  }
  register(root, registry, "wind-generator", generator, [3.25, 0.5, -0.9], [0.9, 0, -0.2]);
  const brake = new THREE.Group();
  place(brake, cyl(0.47, 0.13, C.safety, 0.65), 0, 0, 0);
  place(brake, block([0.28, 0.2, 0.26], C.dark, 0.02, 0.6), 0.47, 0, 0);
  register(root, registry, "wind-brake", brake, [3.25, 0.86, -0.9], [0.8, 0.18, -0.1]);

  const rotor = new THREE.Group();
  place(rotor, cyl(0.085, 2.42, C.frame, 0.8, 20), 0, 0, 0);
  for (let i = 0; i < 3; i += 1) rotor.add(helixBlade(i * Math.PI * 2 / 3));
  for (const y of [-1.05, 1.05]) {
    place(rotor, cyl(0.74, 0.055, C.frame, 0.75), 0, y, 0);
  }
  rotor.name = "wind-rotor";
  register(root, registry, "vawt-rotor", rotor, [3.25, 2.25, -0.9], [0.65, 0.55, -0.2]);
  pipe(root, [[3.25, 0.3, -0.9], [3.25, -0.65, -0.9], [2.2, -0.65, -0.9], [2.2, 0.05, 1.44]], 0.025, C.wind);
}

function addWater(root, registry) {
  const tank = new THREE.Group();
  place(tank, cyl(0.67, 1.55, 0x357983, 0.22), 0, 0, 0);
  place(tank, cyl(0.69, 0.13, 0x4aa7b1, 0.4), 0, 0.79, 0);
  place(tank, cyl(0.17, 0.13, C.dark, 0.4), 0, 0.9, 0);
  for (const y of [-0.52, 0.5]) place(tank, new THREE.Mesh(new THREE.TorusGeometry(0.675, 0.024, 8, 40), mat(0xa7cac8, 0.64)), 0, y, 0).rotation.x = Math.PI / 2;
  register(root, registry, "water-tank", tank, [-2.8, -1.03, 1.0], [-0.6, 0, 0.4]);

  const flush = new THREE.Group();
  place(flush, cyl(0.17, 0.93, C.water, 0.32), 0, 0, 0);
  place(flush, cyl(0.22, 0.12, C.shell, 0.4), 0, 0.5, 0);
  register(root, registry, "first-flush", flush, [-3.94, -1.25, 1.0], [-0.7, -0.15, 0.2]);

  const filters = new THREE.Group();
  [C.shell, 0xa8c9c9, C.dark].forEach((color, i) => {
    place(filters, cyl(0.17, 0.78, color, 0.32), (i - 1) * 0.41, 0, 0);
    place(filters, cyl(0.19, 0.08, C.frame, 0.7), (i - 1) * 0.41, 0.43, 0);
  });
  place(filters, block([1.25, 0.08, 0.48], C.frame, 0.015, 0.65), 0, 0.58, 0);
  register(root, registry, "filter-train", filters, [-1.3, -1.08, 1.9], [0.2, 0.2, 0.85]);

  const pump = new THREE.Group();
  const motor = place(pump, cyl(0.23, 0.72, C.dark, 0.65), 0, 0, 0);
  motor.rotation.z = Math.PI / 2;
  place(pump, cyl(0.26, 0.12, C.water, 0.48), 0.4, 0, 0).rotation.z = Math.PI / 2;
  register(root, registry, "water-pump", pump, [-1.55, -1.6, 1.75], [0, -0.26, 0.8]);

  const sensors = new THREE.Group();
  for (let i = 0; i < 3; i += 1) {
    place(sensors, cyl(0.065, 0.26, C.solar, 0.7, 16), (i - 1) * 0.24, 0, 0);
  }
  place(sensors, block([0.75, 0.11, 0.3], C.black, 0.02, 0.65), 0, -0.19, 0);
  register(root, registry, "water-sensors", sensors, [-2.45, -0.18, 1.75], [-0.18, 0.38, 0.42]);

  pipe(root, [[-3.95, 1.35, 1.56], [-3.95, -0.5, 1.55], [-3.94, -0.9, 1.0]], 0.052, C.water);
  pipe(root, [[-3.94, -1.62, 1.0], [-3.5, -1.62, 1.0], [-3.5, -0.95, 1.0]], 0.046, C.water);
  pipe(root, [[-2.1, -1.0, 1.0], [-1.7, -1.0, 1.4], [-1.7, -0.55, 1.9]], 0.04, C.water);
  pipe(root, [[-1.3, -1.5, 1.9], [-1.55, -1.55, 1.9]], 0.038, C.water);
  pipe(root, [[-1.55, -1.62, 1.75], [-3.75, -1.62, 1.75], [-3.75, 1.42, 1.62], [-3.75, 1.78, -1.85]], 0.023, C.water);
}

function addController(root, registry) {
  const enclosure = new THREE.Group();
  const walls = [
    [[1.64, 1.72, 0.1], [0, 0, -0.39]], [[1.7, 0.1, 0.85], [0, 0.86, 0]],
    [[1.7, 0.1, 0.85], [0, -0.86, 0]], [[0.1, 1.7, 0.85], [-0.82, 0, 0]],
    [[0.1, 1.7, 0.85], [0.82, 0, 0]],
  ];
  walls.forEach(([size, pos]) => place(enclosure, block(size, C.shell, 0.025, 0.67), ...pos));
  // Hinged service door is open so the modeled electronics remain visible.
  const door = new THREE.Group();
  place(door, block([1.62, 1.66, 0.08], C.shell, 0.035, 0.62), 0.81, 0, 0);
  place(door, block([0.75, 0.26, 0.025], C.black, 0.015, 0.25), 0.81, 0.31, 0.055);
  door.rotation.y = -1.05;
  door.position.set(0.77, 0, 0.46);
  enclosure.add(door);
  place(enclosure, cyl(0.055, 0.025, C.green, 0.2, 16), -0.63, 0.73, 0.44).rotation.x = Math.PI / 2;
  register(root, registry, "enclosure", enclosure, [-0.02, -0.75, 1.45], [0, 0, 0.45]);

  register(root, registry, "backplate", block([1.48, 1.54, 0.08], 0x304c48, 0.02, 0.76), [-0.02, -0.75, 1.1], [0, 0, -0.45]);
  const pcb = new THREE.Group();
  place(pcb, block([0.88, 0.54, 0.1], 0x188060, 0.02, 0.12), 0, 0, 0);
  place(pcb, block([0.24, 0.21, 0.07], C.black, 0.015, 0.25), -0.14, 0.04, 0.08);
  for (let i = 0; i < 7; i += 1) place(pcb, block([0.045, 0.1, 0.025], C.solar, 0.004, 0.7), -0.3 + i * 0.1, -0.2, 0.08);
  register(root, registry, "controller-pcb", pcb, [-0.37, -0.37, 1.57], [-0.32, 0.4, 0.8]);

  const meter = new THREE.Group();
  place(meter, block([0.47, 0.7, 0.26], C.shell, 0.035, 0.2), 0, 0, 0);
  place(meter, block([0.35, 0.19, 0.015], C.black, 0.012, 0.15), 0, 0.14, 0.14);
  register(root, registry, "energy-meter", meter, [0.49, -0.38, 1.58], [0.4, 0.35, 0.75]);

  const protection = new THREE.Group();
  place(protection, block([1.34, 0.075, 0.12], C.frame, 0.01, 0.76), 0, 0.36, -0.08);
  [C.shell, C.shell, C.safety, C.shell].forEach((color, i) => {
    place(protection, block([0.25, 0.57, 0.26], color, 0.025, 0.22), -0.48 + i * 0.32, 0, 0);
    place(protection, block([0.07, 0.13, 0.03], C.dark, 0.004, 0.25), -0.48 + i * 0.32, 0.07, 0.15);
  });
  register(root, registry, "protection", protection, [-0.02, -1.13, 1.53], [0, -0.55, 0.95]);

  const gateway = new THREE.Group();
  place(gateway, block([0.47, 0.32, 0.22], C.dark, 0.025, 0.42), 0, 0, 0);
  for (let i = 0; i < 3; i += 1) place(gateway, cyl(0.025, 0.015, C.green, 0.2, 12), -0.13 + i * 0.13, 0.07, 0.12).rotation.x = Math.PI / 2;
  register(root, registry, "communications", gateway, [-0.48, -0.72, 1.56], [-0.45, -0.18, 0.75]);

  const terminals = new THREE.Group();
  for (let i = 0; i < 6; i += 1) place(terminals, block([0.13, 0.27, 0.22], i < 2 ? C.water : C.shell, 0.01, 0.16), (i - 2.5) * 0.17, 0, 0);
  register(root, registry, "terminal-blocks", terminals, [0.19, -0.81, 1.55], [0.35, -0.22, 0.85]);

  const fan = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.026, 8, 24), mat(C.black, 0.56));
  fan.add(ring);
  for (let i = 0; i < 4; i += 1) {
    const blade = place(fan, block([0.045, 0.14, 0.012], C.frame, 0.005), 0, 0.08, 0);
    blade.rotation.z = i * Math.PI / 2 + 0.32;
  }
  register(root, registry, "thermal-management", fan, [0.49, 0.0, 1.58], [0.38, 0.22, 0.65]);
}

function addStorage(root, registry) {
  const rack = new THREE.Group();
  place(rack, block([1.63, 1.88, 0.84], C.frame, 0.065, 0.55), 0, 0, -0.08);
  place(rack, block([1.48, 1.73, 0.045], C.black, 0.03, 0.25), 0, 0, 0.36);
  place(root, rack, 1.75, -0.84, 1.55);
  const unit = (id, size, pos, color, offset) => {
    const group = new THREE.Group();
    place(group, block(size, color, 0.04, 0.46), 0, 0, 0);
    register(root, registry, id, group, pos, offset);
    return group;
  };
  const battery = unit("lifepo4-battery", [1.2, 0.52, 0.63], [1.75, -1.36, 1.65], [0x233d39][0], [0.2, -0.65, 0.8]);
  for (let i = 0; i < 4; i += 1) place(battery, block([0.19, 0.04, 0.012], C.green, 0.004, 0.1), -0.38 + i * 0.22, 0.13, 0.33);
  const inverter = unit("hybrid-inverter", [1.18, 0.55, 0.62], [1.75, -0.55, 1.65], C.shell, [0.2, 0.45, 0.9]);
  place(inverter, block([0.44, 0.13, 0.013], C.black, 0.01, 0.1), 0, 0.09, 0.32);
  unit("mppt", [0.48, 0.3, 0.5], [1.36, 0.08, 1.66], C.green, [-0.45, 0.45, 0.72]);
  unit("wind-rectifier", [0.48, 0.3, 0.5], [2.13, 0.08, 1.66], C.wind, [0.45, 0.45, 0.72]);
  unit("dc-bus", [1.2, 0.09, 0.18], [1.75, -0.13, 1.88], C.energy, [0, 0.53, 0.72]);
  const panel = unit("load-panel", [0.63, 1.25, 0.52], [3.05, -0.87, 1.61], C.shell, [0.7, 0, 0.6]);
  for (let i = 0; i < 4; i += 1) place(panel, block([0.35, 0.1, 0.015], C.black, 0.008, 0.2), 0, -0.4 + i * 0.25, 0.27);
}

function addHydro(root) {
  const assembly = new THREE.Group();
  const inlet = cyl(0.29, 2.0, C.water, 0.4);
  inlet.rotation.z = Math.PI / 2;
  place(assembly, inlet, -0.12, 0, 0);
  const housing = cyl(0.52, 0.64, C.frame, 0.72);
  housing.rotation.z = Math.PI / 2;
  place(assembly, housing, 0, 0, 0);
  const cap = cyl(0.42, 0.04, C.energy, 0.65);
  cap.rotation.z = Math.PI / 2;
  place(assembly, cap, 0.35, 0, 0);
  place(assembly, block([0.7, 0.48, 0.6], C.dark, 0.07, 0.55), 0.2, 0.58, 0);
  pipe(assembly, [[-1.35, 0, 0], [-1.05, 0, 0], [-0.9, 0, 0]], 0.22, C.water);
  place(root, assembly, -3.1, -1.22, 2.2);
  return assembly;
}

export function createWelosScene(container, { onSelect, onReady, onError, modules: initialModules } = {}) {
  const registry = new Map();
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch (error) {
    onError?.(error);
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.6;
  renderer.domElement.setAttribute("aria-label", "Interactive 3D WELOS rooftop appliance with configurable solar, wind, water and hydro add-ons");
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x101714);
  scene.fog = new THREE.FogExp2(0x101714, 0.02);
  const camera = new THREE.PerspectiveCamera(37, 1, 0.1, 100);
  const targetEye = new THREE.Vector3(...VIEWS.overview.eye);
  const targetLook = new THREE.Vector3(...VIEWS.overview.look);
  camera.position.copy(targetEye);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = !reduced;
  controls.dampingFactor = 0.075;
  controls.minDistance = 3;
  controls.maxDistance = 27;
  controls.maxPolarAngle = Math.PI * 0.81;
  controls.target.copy(targetLook);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = environment.texture;
  pmrem.dispose();
  const key = new THREE.DirectionalLight(0xffe5b7, 4.1);
  key.position.set(-4, 9, 7);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x8ac8e9, 2.2);
  rim.position.set(6, 5, -5);
  scene.add(rim, new THREE.HemisphereLight(0xc4e7df, 0x273b34, 1.7));

  const root = new THREE.Group();
  scene.add(root);
  addPlatform(root);
  const assemblies = {};
  for (const [name, builder] of Object.entries({ solar: addSolar, wind: addWind, water: addWater, controller: addController, storage: addStorage })) {
    const group = new THREE.Group();
    builder(group, registry);
    root.add(group);
    assemblies[name] = group;
  }
  assemblies.hydro = addHydro(root);
  function setModules(next) {
    const selection = { solar: true, wind: true, water: true, hydro: false, ...next };
    assemblies.solar.visible = selection.solar || selection.water;
    assemblies.wind.visible = !!selection.wind;
    assemblies.water.visible = !!selection.water;
    assemblies.hydro.visible = !!selection.hydro;
    for (const id of ["pv-array", "pv-racking", "soiling-sensor", "cleaning-manifold"]) registry.get(id).visible = !!selection.solar;
    registry.get("rain-gutter").visible = !!selection.water;
    const cable = assemblies.solar.getObjectByName("solar-cable");
    if (cable) cable.visible = !!selection.solar;
    registry.get("mppt").visible = !!selection.solar;
    registry.get("wind-rectifier").visible = !!selection.wind;
    requestRender();
  }

  const floor = new THREE.Mesh(new THREE.CircleGeometry(9.7, 72), new THREE.MeshBasicMaterial({ color: 0x1b2a25, transparent: true, opacity: 0.55 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -2.43;
  scene.add(floor);
  const grid = new THREE.GridHelper(21, 21, 0x657970, 0x30463c);
  grid.position.y = -2.42;
  grid.material.transparent = true;
  grid.material.opacity = 0.22;
  scene.add(grid);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const interactive = [];
  root.traverse((object) => { if (object.isMesh && object.userData.partId) interactive.push(object); });
  let selected = null;
  let view = "overview";
  let separation = 0;
  let disposed = false;
  let last = performance.now();
  let pending = false;
  let pointerStart = null;
  let transitioning = false;
  setModules(initialModules);

  function selectPart(id, notify = false) {
    if (selected && registry.has(selected)) registry.get(selected).traverse((child) => {
      if (child.isMesh && child.material?.emissive) child.material.emissiveIntensity = 0;
    });
    selected = id;
    if (id && registry.has(id)) registry.get(id).traverse((child) => {
      if (child.isMesh && child.material?.emissive) {
        child.material.emissive.setHex(C.solar);
        child.material.emissiveIntensity = 0.075;
      }
    });
    if (notify) onSelect?.(id);
    requestRender();
  }
  function onPointerDown(event) {
    pointerStart = [event.clientX, event.clientY];
    transitioning = false;
  }
  function onPointerUp(event) {
    if (!pointerStart || Math.hypot(event.clientX - pointerStart[0], event.clientY - pointerStart[1]) > 5) return;
    pointerStart = null;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(interactive, false)[0];
    if (hit?.object?.userData?.partId) selectPart(hit.object.userData.partId, true);
  }
  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  renderer.domElement.addEventListener("pointerup", onPointerUp);
  function setExploded(value) {
    separation = THREE.MathUtils.clamp(value, 0, 1);
    requestRender();
  }
  function setView(id) {
    view = VIEWS[id] ? id : "overview";
    targetEye.set(...VIEWS[view].eye);
    targetLook.set(...VIEWS[view].look);
    transitioning = true;
    requestRender();
  }
  function reset() {
    setView("overview");
    setExploded(0);
    selectPart(null);
  }
  function resize() {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    if (renderer.domElement.width === Math.round(width * renderer.getPixelRatio()) && renderer.domElement.height === Math.round(height * renderer.getPixelRatio())) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  function render(now = performance.now()) {
    if (disposed) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    resize();
    const blend = reduced ? 1 : 1 - Math.pow(0.9, dt * 60);
    if (transitioning) {
      camera.position.lerp(targetEye, blend);
      controls.target.lerp(targetLook, blend);
      if (camera.position.distanceTo(targetEye) < 0.012 && controls.target.distanceTo(targetLook) < 0.012) transitioning = false;
    }
    registry.forEach((object) => {
      object.userData.destination.copy(object.userData.home).addScaledVector(object.userData.separated, separation);
      object.position.lerp(object.userData.destination, reduced ? 1 : 1 - Math.pow(0.86, dt * 60));
    });
    if (!reduced) {
      if (assemblies.wind.visible) registry.get("vawt-rotor").rotation.y += dt * 0.32;
    }
    controls.update();
    renderer.render(scene, camera);
  }
  function requestRender() {
    if (!reduced || pending || disposed) return;
    pending = true;
    requestAnimationFrame((now) => { pending = false; render(now); });
  }
  const observer = new ResizeObserver(requestRender);
  observer.observe(container);
  if (reduced) {
    controls.addEventListener("change", requestRender);
    requestRender();
  } else renderer.setAnimationLoop(render);
  requestAnimationFrame(() => { if (!disposed) onReady?.(); });

  return {
    setView, setExploded, setModules, selectPart, reset,
    get view() { return view; },
    dispose() {
      disposed = true;
      observer.disconnect();
      renderer.setAnimationLoop(null);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      controls.removeEventListener("change", requestRender);
      controls.dispose();
      scene.traverse((object) => {
        object.geometry?.dispose();
        if (object.material) (Array.isArray(object.material) ? object.material : [object.material]).forEach((m) => m.dispose());
      });
      environment.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
