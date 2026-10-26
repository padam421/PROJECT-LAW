/* Indian court practice environments. Dimensions are metres; +Z faces the gallery.
 * Representative layouts, not replicas of a particular courtroom. See docs/courtrooms.md.
 * Kept separate from dialogue/auth so both portals use the same room and controls. */
const IndianCourtroom = {
  types: {
    SUPREME: {
      title: 'Supreme Court', subtitle: 'A formal appellate bench', label: 'Three-judge practice bench',
      description: 'Walnut panelling, a three-member bench, burgundy upholstery and a broad public gallery.',
      width: 17, back: -8.6, front: 11, height: 6.2, benchZ: -6.8, benchWidth: 9.6,
      judges: [0, -2.65, 2.65], galleryRows: 4, wood: '#74513c', darkWood: '#412b22',
      fabric: '#703a41', carpet: '#78504b', plaster: '#eee7d8', accent: '#d2b887',
      features: ['Three-member bench', 'Court master & stenographer', 'Counsel tables', 'Public gallery'],
      voiceRate: 0.95
    },
    HIGH: {
      title: 'High Court', subtitle: 'Heritage, light and proportion', label: 'Division bench practice',
      description: 'A two-member bench, tall arched windows, carved teak details and green leather seating.',
      width: 15, back: -7.8, front: 10, height: 5.8, benchZ: -6.1, benchWidth: 7.8,
      judges: [-1.5, 1.5], galleryRows: 3, wood: '#926340', darkWood: '#543620',
      fabric: '#324e45', carpet: '#67766b', plaster: '#efe5d1', accent: '#ccb483',
      features: ['Two-member bench', 'Arched daylight windows', 'Court staff & records', 'Public gallery'],
      voiceRate: 0.98
    },
    DISTRICT: {
      title: 'District Court', subtitle: 'Inside a trial courtroom', label: 'Single-judge practice court',
      description: 'A single judge, witness enclosure, separate dock, case files and a bright, practical trial-court layout.',
      width: 13.2, back: -6.9, front: 10, height: 4.9, benchZ: -5.3, benchWidth: 5.8,
      judges: [0], galleryRows: 3, wood: '#a37851', darkWood: '#65462e',
      fabric: '#6a4748', carpet: '#868e80', plaster: '#f1eddf', accent: '#c8ac7e',
      features: ['Single-judge dais', 'Witness enclosure', 'Separate accused dock', 'Court staff & public benches'],
      voiceRate: 1
    }
  },

  layout(type) {
    const c = this.types[type] || this.types.SUPREME;
    const actors = {
      JUDGE: { x: c.judges[0], y: 0.42, z: c.benchZ - 0.55 },
      DEFENSE: { x: -2.45, y: 0, z: 0.4 },
      PROSECUTION: { x: 2.45, y: 0, z: 0.4 },
      WITNESS_DEFENSE: { x: -0.75, y: 0, z: 5.4 },
      WITNESS_PROSECUTION: { x: 0.75, y: 0, z: 5.4 }
    };
    const witnesses = { DEFENSE: { x: -c.width / 2 + 1.75, z: -2.65 }, PROSECUTION: { x: c.width / 2 - 1.75, z: -2.65 } };
    c.judges.slice(1).forEach((x, i) => { actors['JUDGE_' + i] = { x, y: 0.42, z: c.benchZ - 0.55 }; });
    const cameras = {
      WIDE: { label: 'Whole room', pos: [0, type === 'DISTRICT' ? 3.25 : 3.8, c.front - 1], target: [0, 1.8, c.benchZ + 1.1] },
      JUDGE: { label: 'Judge bench', pos: [0.35, 2.75, c.benchZ + 6.6], target: [0, 1.95, c.benchZ - 0.25] },
      DEFENSE: { label: 'Your counsel', pos: [-0.4, 2.25, -3.3], target: [-2.45, 1.15, 0.4] },
      PROSECUTION: { label: 'Opposing counsel', pos: [0.4, 2.25, -3.3], target: [2.45, 1.15, 0.4] },
      GALLERY: { label: 'Public gallery', pos: [-c.width / 2 + 1.6, 3.25, 0], target: [0.8, 1.1, 6] },
      STAFF: { label: 'Court staff', pos: [3.7, 2.6, -0.8], target: [0, 1.05, c.benchZ + 2.4] }
    };
    cameras.WITNESS = { label: 'Your witness', pos: [witnesses.DEFENSE.x + 3.2, 2.5, 1.6], target: [witnesses.DEFENSE.x + 0.65, 1.2, witnesses.DEFENSE.z + 0.55] };
    cameras.WITNESS_OTHER = { label: 'Other witness', pos: [witnesses.PROSECUTION.x - 3.2, 2.5, 1.6], target: [witnesses.PROSECUTION.x - 0.65, 1.2, witnesses.PROSECUTION.z + 0.55] };
    return { ...c, type, actors, cameras, witnesses };
  },

  build(scene, type, caseTitle) {
    this._peopleMaterials = new Map(); this._peopleGeometry = {};
    const c = this.layout(type);
    const root = new THREE.Group();
    root.name = 'Indian courtroom: ' + type;
    scene.add(root);
    const fans = [], participants = [];
    const unitBox = new THREE.BoxGeometry(1, 1, 1);
    const unitCylinder = new THREE.CylinderGeometry(1, 1, 1, 16);
    const sphere = new THREE.SphereGeometry(1, 16, 12);
    const color = value => new THREE.Color(value).convertSRGBToLinear();
    const material = (value, roughness = 0.74, metalness = 0) => new THREE.MeshStandardMaterial({ color: color(value), roughness, metalness });
    const woodTexture = this.woodTexture(c.wood);
    const wood = new THREE.MeshStandardMaterial({ map: woodTexture, roughness: 0.55 });
    const dark = material(c.darkWood, 0.6);
    const plaster = material(c.plaster);
    const trim = material('#e1d7c2');
    const brass = material(c.accent, 0.36, 0.65);
    const fabric = material(c.fabric, 0.98);
    const black = material('#24292b');
    const cream = material('#faf6eb');
    const paper = material('#eee5cd');
    const steel = material('#8a9695', 0.35, 0.65);
    const green = material('#3c6154');
    const red = material('#764139');
    const floorMat = material('#c5bdae', 0.83);
    const grout = material('#aba89e');
    const carpet = material(c.carpet, 1);
    const darkBlue = material('#3f4d61');
    const screen = new THREE.MeshStandardMaterial({ color: color('#aec5c2'), emissive: color('#a6c5c8'), emissiveIntensity: 0.16, roughness: 0.4 });
    function mesh(geometry, mat, pos, scale, parent = root) {
      const m = new THREE.Mesh(geometry, mat);
      m.position.set(...pos); m.scale.set(...scale);
      m.castShadow = true; m.receiveShadow = true;
      parent.add(m); return m;
    }
    const box = (w, h, d, x, y, z, mat = wood, parent = root) => mesh(unitBox, mat, [x, y, z], [w, h, d], parent);
    const cylinder = (r, h, x, y, z, mat = brass, parent = root) => mesh(unitCylinder, mat, [x, y, z], [r, h, r], parent);
    function label(text, w, h, x, y, z, options = {}) {
      const tex = IndianCourtroom.textTexture(text, options);
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: false, toneMapped: false });
      return box(w, h, 0.014, x, y, z, mat, options.parent || root);
    }
    function panel(x, y, z, w, h, parent = root) {
      box(w, h, 0.08, x, y, z, dark, parent);
      box(w - 0.12, h - 0.12, 0.1, x, y, z + 0.035, wood, parent);
      box(w - 0.24, h - 0.24, 0.035, x, y, z + 0.085, dark, parent);
    }
    function chair(x, z, rotation = 0, elevated = 0, grand = false) {
      const g = new THREE.Group(); root.add(g); g.position.set(x, elevated, z); g.rotation.y = rotation;
      const w = grand ? 0.88 : 0.61;
      box(w, 0.13, 0.65, 0, 0.48, 0, dark, g);
      box(w - 0.06, 0.12, 0.59, 0, 0.56, 0, fabric, g);
      box(w, grand ? 1.48 : 0.65, 0.12, 0, grand ? 1.28 : 0.99, -0.29, wood, g);
      box(w - 0.13, grand ? 1.3 : 0.51, 0.07, 0, grand ? 1.29 : 0.99, -0.2, fabric, g);
      for (const side of [-1, 1]) {
        box(0.075, 0.83, 0.075, side * (w / 2 - 0.06), 0.42, -0.27, dark, g);
        box(0.075, 0.77, 0.075, side * (w / 2 - 0.06), 0.39, 0.25, dark, g);
        box(0.09, 0.07, 0.66, side * (w / 2 - 0.05), 0.82, 0, wood, g);
      }
      if (grand) {
        box(w + 0.1, 0.08, 0.16, 0, 2.05, -0.28, dark, g);
        for (const side of [-1, 1]) cylinder(0.048, 0.09, side * w / 2, 2.12, -0.27, brass, g);
      }
      return g;
    }
    function files(x, y, z, count = 3, parent = root) {
      for (let i = 0; i < count; i++) {
        const dx = (i % 2) * 0.035;
        box(0.39, 0.065, 0.29, x + dx, y + i * 0.075, z, i % 2 ? green : red, parent);
        box(0.36, 0.042, 0.275, x + dx, y + 0.002 + i * 0.075, z + 0.01, paper, parent);
        box(0.022, 0.069, 0.3, x + dx, y + i * 0.075, z, cream, parent);
      }
    }
    function mic(x, y, z, parent = root) {
      cylinder(0.075, 0.018, x, y, z, black, parent);
      const stem = cylinder(0.011, 0.34, x, y + 0.17, z, black, parent); stem.rotation.x = -0.22;
      const tip = cylinder(0.026, 0.09, x, y + 0.34, z - 0.04, black, parent); tip.rotation.x = Math.PI / 2 - 0.22;
    }
    function monitor(x, y, z, rotation = 0) {
      const g = new THREE.Group(); root.add(g); g.position.set(x, y, z); g.rotation.y = rotation;
      box(0.23, 0.025, 0.19, 0, 0, 0, black, g);
      box(0.04, 0.18, 0.04, 0, 0.09, 0, steel, g);
      box(0.49, 0.32, 0.04, 0, 0.3, 0, black, g);
      box(0.45, 0.275, 0.015, 0, 0.3, 0.025, screen, g);
      for (let i = 0; i < 4; i++) box(0.27 - i * 0.04, 0.009, 0.005, -0.045, 0.37 - i * 0.04, 0.035, cream, g);
      box(0.34, 0.025, 0.14, 0, 0.025, 0.22, black, g);
    }
    function person(x, y, z, rotation, index, courtDress = false) {
      const g = IndianCourtroom.person(index, courtDress);
      g.position.set(x, y, z); g.rotation.y = rotation; g.userData.dynamic = true;
      root.add(g); participants.push(g); return g;
    }
    function desk(x, z, width = 2.1, h = 0.8, mat = wood) {
      box(width, 0.1, 0.85, x, h, z, mat);
      box(width - 0.2, h - 0.17, 0.1, x, h / 2, z + 0.27, wood);
      for (const side of [-1, 1]) box(0.1, h, 0.68, x + side * (width / 2 - 0.13), h / 2, z, dark);
    }
    function rail(x, z, width, stainless = false) {
      const mat = stainless ? steel : wood;
      box(width, 0.085, 0.11, x, 1.02, z, mat);
      box(width, 0.06, 0.08, x, 0.19, z, mat);
      for (let a = -width / 2; a <= width / 2 + 0.01; a += width / Math.ceil(width / 0.3)) {
        box(stainless ? 0.025 : 0.055, 0.85, 0.055, x + a, 0.58, z, mat);
      }
    }

    // Diffuse daylight and warm ceiling fill. A single shadow source keeps mobile GPU cost bounded.
    scene.background = color(c.plaster);
    scene.add(new THREE.HemisphereLight(0xe7f1ff, 0xb6a18a, 0.75));
    scene.add(new THREE.AmbientLight(0xffead6, 0.32));
    const daylight = new THREE.DirectionalLight(0xfff2df, 1.15);
    daylight.position.set(-5, 8, 3); daylight.target.position.set(0, 0, -3);
    daylight.castShadow = true; daylight.shadow.mapSize.set(2048, 2048);
    Object.assign(daylight.shadow.camera, { left: -12, right: 12, top: 13, bottom: -13, near: 0.5, far: 35 });
    daylight.shadow.normalBias = 0.035; daylight.shadow.bias = -0.00015;
    scene.add(daylight, daylight.target);
    const fill = new THREE.DirectionalLight(0xd6e5ef, 0.35); fill.position.set(6, 5, -4); scene.add(fill);

    const depth = c.front - c.back, centre = (c.front + c.back) / 2;
    box(c.width, 0.16, depth, 0, -0.1, centre, floorMat);
    for (let x = -c.width / 2; x < c.width / 2; x += 1.2) box(0.012, 0.008, depth, x, -0.012, centre, grout);
    for (let z = c.back; z < c.front; z += 1.2) box(c.width, 0.008, 0.012, 0, -0.012, z, grout);
    if (type !== 'DISTRICT') {
      box(c.width - 3.5, 0.018, depth - 1, 0, 0.005, centre, carpet);
      for (const side of [-1, 1]) box(0.025, 0.023, depth - 1, side * (c.width - 3.8) / 2, 0.01, centre, brass);
    } else box(1.6, 0.015, depth - 1, 0, 0.005, centre, carpet);
    box(c.width, c.height, 0.25, 0, c.height / 2, c.back, plaster);
    box(c.width, 1.7, 0.15, 0, 0.85, c.back + 0.2, wood);
    box(c.width, 0.12, 0.22, 0, 1.72, c.back + 0.23, dark);
    for (let x = -c.width / 2 + 0.5; x < c.width / 2; x += 1.15) panel(x, 0.85, c.back + 0.3, 0.99, 1.4);

    // A central architectural surround frames the bench instead of a theatrical black backdrop.
    box(c.benchWidth + 1, 3.2, 0.18, 0, 2.7, c.back + 0.23, dark);
    for (let x = -(c.benchWidth + 0.5) / 2; x <= (c.benchWidth + 0.5) / 2; x += 0.28) {
      box(0.08, 3, 0.1, x, 2.72, c.back + 0.38, wood);
    }
    box(c.benchWidth + 1.25, 0.14, 0.42, 0, 4.3, c.back + 0.35, wood);
    label(c.title.toUpperCase(), 3.8, 0.36, 0, 3.24, c.back + 0.5, { background: c.darkWood, color: c.accent });
    label('VIRTUAL HEARING  /  NYAY SETU', 3.3, 0.19, 0, 2.91, c.back + 0.51, { background: c.darkWood, color: '#ded3bb' });
    // A custom scales motif, not an official seal or insignia.
    const scales = new THREE.Group(); root.add(scales); scales.position.set(0, 3.84, c.back + 0.52);
    cylinder(0.025, 0.55, 0, 0, 0, brass, scales);
    box(0.8, 0.035, 0.045, 0, 0.16, 0, brass, scales);
    box(0.3, 0.045, 0.09, 0, -0.3, 0, brass, scales);
    for (const side of [-1, 1]) {
      box(0.018, 0.28, 0.018, side * 0.34, 0, 0, brass, scales);
      const pan = mesh(new THREE.SphereGeometry(0.19, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), brass, [side * 0.34, -0.13, 0], [1, 0.4, 0.7], scales);
      pan.material.side = THREE.DoubleSide;
    }

    for (const side of [-1, 1]) {
      const wall = new THREE.Group(); root.add(wall);
      wall.position.x = side * c.width / 2; wall.rotation.y = side === -1 ? Math.PI / 2 : -Math.PI / 2;
      box(depth, c.height, 0.2, -side * centre, c.height / 2, -0.08, plaster, wall);
      box(depth, 1.45, 0.14, -side * centre, 0.72, 0.08, wood, wall);
      box(depth, 0.09, 0.23, -side * centre, 1.47, 0.09, dark, wall);
      for (let z = c.back + 1; z < c.front; z += 1.25) panel(-side * z, 0.75, 0.15, 1.08, 1.24, wall);
      for (let z = c.back + 3.1; z < c.front - 1; z += 4.1) {
        const wx = -side * z, wy = type === 'HIGH' ? 3.25 : 3.1;
        box(2.2, 2.35, 0.13, wx, wy, 0.14, dark, wall);
        const glass = new THREE.MeshStandardMaterial({ color: color('#dce5dd'), emissive: color('#edf2df'), emissiveIntensity: 0.55, roughness: 0.8 });
        box(2.03, 2.16, 0.1, wx, wy, 0.22, glass, wall);
        for (let i = -1; i <= 1; i++) box(0.055, 2.18, 0.1, wx + i * 0.51, wy, 0.3, cream, wall);
        for (let i = -1; i <= 1; i++) box(2.04, 0.045, 0.1, wx, wy + i * 0.56, 0.3, cream, wall);
        box(2.35, 0.11, 0.35, wx, wy - 1.2, 0.3, trim, wall);
        if (type === 'HIGH') {
          const arch = mesh(new THREE.TorusGeometry(1.11, 0.085, 8, 32, Math.PI), trim, [wx, wy + 1.19, 0.2], [1, 0.72, 1], wall);
          arch.name = 'Heritage window arch';
        }
        for (const edge of [-1, 1]) {
          for (let fold = 0; fold < 4; fold++) cylinder(0.075, 2.45, wx + edge * (1.12 + fold * 0.09), wy, 0.37, fabric, wall);
        }
        box(2.92, 0.12, 0.3, wx, wy + 1.3, 0.25, wood, wall);
      }
    }

    // Ceiling coffers, recessed fittings, and fans. Camera positions stay below the ceiling.
    const ceiling = box(c.width, 0.18, depth, 0, c.height, centre, plaster);
    ceiling.castShadow = false;
    const lamp = new THREE.MeshBasicMaterial({ color: 0xfff4ce });
    for (let z = c.back + 2; z < c.front; z += 3.7) {
      box(c.width, 0.17, 0.18, 0, c.height - 0.12, z, trim);
      for (const x of [-c.width / 3, 0, c.width / 3]) {
        cylinder(0.18, 0.05, x, c.height - 0.13, z - 1, lamp);
      }
      if (type !== 'SUPREME') {
        cylinder(0.025, 0.48, 0, c.height - 0.4, z, steel);
        const fan = new THREE.Group(); fan.position.set(0, c.height - 0.7, z); root.add(fan); fan.userData.dynamic = true;
        cylinder(0.16, 0.14, 0, 0, 0, cream, fan);
        for (let i = 0; i < 3; i++) {
          const blade = new THREE.Group(); fan.add(blade); blade.rotation.y = i * Math.PI * 2 / 3;
          box(0.22, 0.025, 0.8, 0, 0, 0.48, cream, blade);
        }
        fans.push(fan);
      }
    }
    for (const x of [-c.width / 3, c.width / 3]) box(0.16, 0.17, depth, x, c.height - 0.12, centre, trim);

    // Raised dais with side steps and a clear central court-staff zone.
    box(c.benchWidth + 1.1, 0.42, 2.9, 0, 0.21, c.benchZ - 0.15, wood);
    box(c.benchWidth + 1.12, 0.035, 2.91, 0, 0.44, c.benchZ - 0.15, carpet);
    for (let i = 0; i < 3; i++) box(1.12, 0.14 * (i + 1), 0.34, c.benchWidth / 2 + 0.15, 0.07 * (i + 1), c.benchZ + 2.15 - i * 0.34, wood);
    const benchFront = c.benchZ + 0.65;
    box(c.benchWidth, 1.16, 0.37, 0, 1.02, benchFront, wood);
    box(c.benchWidth + 0.17, 0.13, 1.2, 0, 1.64, benchFront - 0.3, dark);
    box(c.benchWidth + 0.17, 0.045, 0.08, 0, 1.51, benchFront + 0.21, brass);
    const panels = type === 'DISTRICT' ? 3 : 5;
    for (let i = 0; i < panels; i++) panel(-c.benchWidth / 2 + (i + 0.5) * c.benchWidth / panels, 1.02, benchFront + 0.21, c.benchWidth / panels - 0.16, 0.91);
    c.judges.forEach((x, i) => {
      chair(x, c.benchZ - 0.93, 0, 0.44, true);
      box(0.9, 0.018, 0.54, x, 1.72, benchFront - 0.29, green);
      files(x + 0.58, 1.74, benchFront - 0.25, 2);
      mic(x - 0.42, 1.72, benchFront - 0.35);
      label(i === 0 ? 'PRESIDING JUDGE' : 'JUDGE', 0.87, 0.12, x, 1.59, benchFront + 0.32, { background: c.darkWood, color: c.accent });
    });
    const staffZ = c.benchZ + 2.65;
    for (const [i, x] of [-1.18, 1.18].entries()) {
      desk(x, staffZ, 2.1);
      chair(x, staffZ - 0.52);
      const clerk = person(x, 0, staffZ - 0.53, 0, i, false);
      clerk.userData.typist = true;
      monitor(x - 0.25, 0.86, staffZ, Math.PI);
      files(x + 0.55, 0.88, staffZ + 0.05, 3);
      label(i ? 'STENOGRAPHER' : 'COURT MASTER', 0.95, 0.13, x, 0.72, staffZ + 0.335, { background: c.darkWood, color: '#e1d5bf' });
    }
    for (const [i, x] of [-2.45, 2.45].entries()) {
      desk(x, -0.28, 2.15, 1.02);
      box(0.85, 0.016, 0.5, x, 1.08, -0.28, green);
      files(x + 0.63, 1.11, -0.25, 3);
      box(0.32, 0.012, 0.42, x - 0.15, 1.1, -0.25, paper);
      mic(x - 0.64, 1.08, -0.5);
      chair(x + (i ? 0.7 : -0.7), 1.45, Math.PI);
      label(i ? 'OPPOSING COUNSEL' : 'YOUR COUNSEL', 1.25, 0.14, x, 0.87, 0.165, { background: c.darkWood, color: c.accent });
    }

    // Two practice stations allow either party to rehearse. The inner side is open for entry.
    for (const [side, station] of Object.entries(c.witnesses)) {
      const sign = side === 'DEFENSE' ? -1 : 1, { x, z } = station;
      rail(x, z + 0.52, 1.2);
      const outer = new THREE.Group(); root.add(outer); outer.position.set(x + sign * 0.6, 0, z);
      box(0.075, 1.02, 1.1, 0, 0.52, 0, wood, outer);
      box(0.12, 0.08, 1.15, 0, 1.06, 0, dark, outer);
      chair(x, z - 0.5, sign * -Math.PI / 3);
      label(side === 'DEFENSE' ? 'WITNESS A' : 'WITNESS B', 0.9, 0.13, x, 0.85, z + 0.58, { background: c.darkWood, color: '#fff4dd' });
      mic(x + sign * 0.42, 1.08, z + 0.45);
    }
    if (type === 'DISTRICT') {
      rail(5.55, 1.65, 1.1, true);
      const dock = box(1.1, 0.12, 0.45, 5.55, 0.48, 1.1); dock.name = 'Separate dock';
      label('DOCK', 0.7, 0.14, 5.55, 0.85, 1.71, { background: '#555b59', color: '#ffffff' });
    }

    // Bar separates the working area from the public gallery, with a clear central aisle.
    for (const side of [-1, 1]) rail(side * (c.width / 4 + 0.35), 3.2, c.width / 2 - 1.75);
    label('PUBLIC GALLERY', 1.6, 0.16, -c.width / 3, 0.84, 3.27, { background: c.darkWood, color: '#e1d4bc' });
    for (let row = 0; row < c.galleryRows; row++) {
      const z = 4.9 + row * 1.35;
      for (const side of [-1, 1]) {
        const x = side * 3.05, w = type === 'SUPREME' ? 4.05 : 3.35;
        box(w, 0.13, 0.61, x, 0.5, z);
        box(w - 0.07, 0.09, 0.56, x, 0.6, z, fabric);
        box(w, 0.62, 0.11, x, 0.97, z + 0.29, wood);
        box(w - 0.14, 0.45, 0.06, x, 0.97, z + 0.21, fabric);
        for (const end of [-1, 1]) box(0.11, 0.55, 0.57, x + end * (w / 2 - 0.13), 0.27, z, dark);
        if (row < 2) {
          person(x - 0.6, 0, z, Math.PI, row * 2 + (side + 1) / 2, row === 0);
          if (type === 'SUPREME' || row === 0) person(x + 0.65, 0, z, Math.PI, row + 4, false);
        }
      }
    }

    // Chamber door, record cupboard, hearing display, wall clock, water and Indian flag.
    const doorX = -c.width / 2 + 1.05;
    box(1.55, 2.65, 0.16, doorX, 1.34, c.back + 0.28, dark);
    panel(doorX, 1.3, c.back + 0.42, 1.3, 2.35);
    box(0.035, 0.23, 0.07, doorX + 0.44, 1.23, c.back + 0.56, brass);
    label('CHAMBERS', 1.13, 0.17, doorX, 2.83, c.back + 0.33, { background: c.plaster, color: '#5c5142' });
    const cupboardX = c.width / 2 - 0.95;
    box(1.4, 2.2, 0.55, cupboardX, 1.1, c.back + 0.62, dark);
    for (let row = 0; row < 4; row++) {
      box(1.4, 0.055, 0.61, cupboardX, 0.2 + row * 0.51, c.back + 0.7, wood);
      for (let n = 0; n < 7; n++) {
        box(0.13, 0.34 + (n % 2) * 0.08, 0.32, cupboardX - 0.52 + n * 0.17, 0.42 + row * 0.51, c.back + 0.75, [green, red, darkBlue][n % 3]);
        box(0.11, 0.04, 0.01, cupboardX - 0.52 + n * 0.17, 0.4 + row * 0.51, c.back + 0.92, paper);
      }
    }
    label('CAUSE LIST\nPRACTICE HEARING\n' + String(caseTitle || 'Demonstration').slice(0, 42), 1.9, 0.95, c.width / 2 - 1.45, 3.3, c.back + 0.29, { background: '#203c3b', color: '#e3e9de', fontSize: 34 });
    const clock = cylinder(0.3, 0.06, -c.width / 2 + 1.35, 3.6, c.back + 0.3, dark); clock.rotation.x = Math.PI / 2;
    label('10 : 30', 0.44, 0.17, -c.width / 2 + 1.35, 3.6, c.back + 0.35, { background: c.darkWood, color: '#f1e8d6' });
    const flagX = c.benchWidth / 2 + 0.3;
    cylinder(0.2, 0.08, flagX, 0.49, c.benchZ - 0.65, dark);
    cylinder(0.018, 2.6, flagX, 1.82, c.benchZ - 0.65, brass);
    const flagMat = new THREE.MeshStandardMaterial({ map: this.flagTexture(), side: THREE.DoubleSide, roughness: 0.9 });
    box(0.82, 0.55, 0.012, flagX + 0.42, 2.7, c.benchZ - 0.65, flagMat);
    for (const x of [-0.65, 0.65]) {
      cylinder(0.047, 0.13, x, 0.94, staffZ + 0.13, cream);
    }

    this.batchStatic(root);
    const participantBatches = this.batchParticipants(root, participants);
    return { config: c, root, fans, participants, participantBatches, chair, person };
  },

  woodTexture(base) {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = base; ctx.fillRect(0, 0, 512, 512);
    // Deterministic fine grain, so switching rooms does not change the texture randomly.
    for (let i = 0; i < 400; i++) {
      ctx.beginPath(); ctx.strokeStyle = i % 3 ? 'rgba(35,19,9,.075)' : 'rgba(255,220,166,.09)';
      ctx.lineWidth = i % 7 === 0 ? 1.5 : 0.7;
      for (let y = 0; y <= 512; y += 16) {
        const x = i * 1.31 + Math.sin(y * 0.013 + i * 0.19) * 2.8;
        if (!y) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(canvas); tex.encoding = THREE.sRGBEncoding;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = 4; return tex;
  },

  textTexture(text, options = {}) {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = options.background || '#3b2b22'; ctx.fillRect(0, 0, 1024, 256);
    ctx.fillStyle = options.color || '#e0c596'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const lines = String(text).split('\n'); ctx.font = `600 ${options.fontSize || 136}px Arial, sans-serif`;
    lines.forEach((line, i) => ctx.fillText(line, 512, 128 + (i - (lines.length - 1) / 2) * 65, 950));
    const tex = new THREE.CanvasTexture(canvas); tex.encoding = THREE.sRGBEncoding; return tex;
  },

  flagTexture() {
    const canvas = document.createElement('canvas'); canvas.width = 600; canvas.height = 400;
    const ctx = canvas.getContext('2d');
    ['#ff9933', '#ffffff', '#138808'].forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(0, i * 400 / 3, 600, 400 / 3 + 1); });
    ctx.strokeStyle = '#000080'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(300, 200, 58, 0, 2 * Math.PI); ctx.stroke();
    for (let i = 0; i < 24; i++) { const a = i * Math.PI / 12; ctx.beginPath(); ctx.moveTo(300, 200); ctx.lineTo(300 + 56 * Math.cos(a), 200 + 56 * Math.sin(a)); ctx.stroke(); }
    const tex = new THREE.CanvasTexture(canvas); tex.encoding = THREE.sRGBEncoding; return tex;
  },

  // Seated supporting figures; principal speaking roles use the project's animated GLB assets.
  person(index = 0, courtDress = false, standing = false) {
    const group = new THREE.Group(); group.name = 'Court participant';
    this._peopleMaterials ||= new Map(); this._peopleGeometry ||= {};
    const mat = value => {
      if (!this._peopleMaterials.has(value)) this._peopleMaterials.set(value, new THREE.MeshStandardMaterial({ color: new THREE.Color(value).convertSRGBToLinear(), roughness: 0.88 }));
      return this._peopleMaterials.get(value);
    };
    const skin = mat(['#a87552', '#b88461', '#885b41', '#c0906d'][index % 4]);
    const cloth = mat(courtDress ? '#25272b' : ['#d6c9ad', '#88989a', '#a27e70', '#67858f', '#b5b29a'][index % 5]);
    const dark = mat('#35383b'), hair = mat(index % 3 ? '#302720' : '#898179'), white = mat('#e9e2d6');
    const ball = this._peopleGeometry.ball ||= new THREE.SphereGeometry(1, 20, 14);
    const add = (parent, geometry, material, pos, scale) => {
      const m = new THREE.Mesh(geometry, material); m.position.set(...pos); m.scale.set(...scale); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
    };
    const ellipsoid = (parent, material, pos, scale) => add(parent, ball, material, pos, scale);
    const hip = standing ? 0.9 : 0.56;
    const torso = new THREE.Group(); torso.position.y = hip; group.add(torso);
    const outline = [[.14,0],[.155,.09],[.17,.2],[.215,.39],[.2,.43],[.075,.48]].map(([x,y])=>new THREE.Vector2(x,y));
    const body = add(torso, this._peopleGeometry.body ||= new THREE.LatheGeometry(outline,24), cloth, [0,0,0], [1,1,.62]);
    ellipsoid(torso, skin, [0,.51,0], [.055,.085,.055]);
    const head = new THREE.Group(); head.position.set(0,.66,0); torso.add(head);
    ellipsoid(head, skin, [0,0,0], [.105,.145,.112]);
    ellipsoid(head, skin, [0,-.065,.035], [.075,.07,.08]);
    const scalp = add(head,this._peopleGeometry.hair ||= new THREE.SphereGeometry(1,24,14,0,Math.PI*2,0,Math.PI*.48),hair,[0,.025,-.006],[.108,.13,.115]);
    if(index % 2) ellipsoid(head,hair,[0,-.01,-.115],[.077,.09,.07]);
    ellipsoid(head,skin,[0,.006,.109],[.023,.035,.033]);
    const eyes=[];
    for(const sign of [-1,1]) {
      ellipsoid(head,skin,[sign*.102,-.005,0],[.018,.036,.025]);
      const eye = new THREE.Group(); eye.position.set(sign*.039,.027,.103); head.add(eye);
      ellipsoid(eye,white,[0,0,0],[.022,.012,.01]); ellipsoid(eye,dark,[0,0,.008],[.009,.01,.005]); eyes.push(eye);
      ellipsoid(head,hair,[sign*.039,.05,.103],[.025,.004,.005]);
    }
    ellipsoid(head,mat('#825549'),[0,-.054,.104],[.031,.006,.007]);
    const arms=[];
    for(const sign of [-1,1]) {
      const shoulder=new THREE.Group(); shoulder.position.set(sign*.195,.39,0); torso.add(shoulder);
      ellipsoid(shoulder,cloth,[sign*.018,-.12,0],[.062,.17,.063]);
      const elbow=new THREE.Group(); elbow.position.set(sign*.03,-.255,0); shoulder.add(elbow);
      ellipsoid(elbow,cloth,[0,-.105,0],[.045,.13,.046]);
      ellipsoid(elbow,skin,[0,-.24,0],[.038,.069,.024]);
      // A subtle thumb and four narrow fingers read as hands at staff-camera distance.
      ellipsoid(elbow,skin,[-sign*.032,-.23,.008],[.012,.03,.013]);
      for(let finger=0;finger<4;finger++) ellipsoid(elbow,skin,[(finger-1.5)*.014,-.285,0],[.009,.027,.011]);
      shoulder.rotation.z=sign*.08; elbow.rotation.x=-.25;
      arms.push({shoulder,elbow});
      const thigh=new THREE.Group(); thigh.position.set(sign*.095,hip+.02,0); group.add(thigh);
      ellipsoid(thigh,dark,[0,-.2,0],[.085,.25,.09]);
      const knee=new THREE.Group(); knee.position.y=-.42; thigh.add(knee);
      ellipsoid(knee,dark,[0,-.19,0],[.065,.23,.07]);
      ellipsoid(knee,dark,[0,-.39,.055],[.077,.06,.14]);
      if(!standing){thigh.rotation.x=-Math.PI/2;knee.rotation.x=Math.PI/2;}
    }
    if(courtDress) for(const sign of [-1,1]) add(torso,new THREE.BoxGeometry(1,1,1),white,[sign*.03,.38,.126],[.045,.14,.012]);
    group.userData.rig={head,torso,arms,eyes,index};
    return group;
  },

  animateParticipants(participants, time, activePosition, recording, moving) {
    participants.forEach((person,i)=>{
      const rig=person.userData.rig; if(!rig)return;
      const blink = Math.sin(time * 1.1 + i * 2.3) > .997 ? .12 : 1;
      rig.eyes.forEach(eye=>{eye.scale.y=blink;});
      const angle = activePosition ? Math.atan2(activePosition.x-person.position.x,activePosition.z-person.position.z)-person.rotation.y : 0;
      rig.head.rotation.y=THREE.MathUtils.clamp(Math.atan2(Math.sin(angle),Math.cos(angle)),-.32,.32);
      rig.head.rotation.x=Math.sin(time*.65+i)*.025;
      rig.torso.rotation.z=Math.sin(time*.55+i*1.8)*.009;
      if(person.userData.typist) rig.arms.forEach(({shoulder,elbow},side)=>{
        shoulder.rotation.x=-.62; elbow.rotation.x=-.7+(recording?Math.sin(time*15+side*2.2)*.09:0);
      });
      else rig.arms.forEach(({elbow},side)=>{elbow.rotation.x=-.25+Math.sin(time*.4+i+side)*.015;});
    });
  },

  batchParticipants(root, participants) {
    const groups = new Map(); root.updateMatrixWorld(true);
    participants.forEach(person => person.traverse(mesh => {
      if (!mesh.isMesh) return;
      const key=mesh.geometry.uuid+'/'+mesh.material.uuid;
      if(!groups.has(key))groups.set(key,[]);groups.get(key).push(mesh);
    }));
    const batches=[];
    groups.forEach(meshes=>{
      const batch=new THREE.InstancedMesh(meshes[0].geometry,meshes[0].material,meshes.length);
      batch.userData.dynamic=true;batch.castShadow=true;batch.receiveShadow=true;batch.frustumCulled=false;
      meshes.forEach((mesh,i)=>{batch.setMatrixAt(i,mesh.matrixWorld);mesh.visible=false;});
      root.add(batch);batches.push({batch,meshes});
    });
    return batches;
  },

  updateParticipantBatches(room) {
    room.participants.forEach(person=>person.updateMatrixWorld(true));
    room.participantBatches.forEach(({batch,meshes})=>{
      meshes.forEach((mesh,i)=>batch.setMatrixAt(i,mesh.matrixWorld));batch.instanceMatrix.needsUpdate=true;
    });
  },

  batchStatic(root) {
    // Identical geometry/material pairs become one draw call. Dynamic fans and avatars are excluded.
    root.updateMatrixWorld(true);
    const buckets = new Map();
    root.traverse(m => {
      if (!m.isMesh || m.isSkinnedMesh || Array.isArray(m.material)) return;
      for (let p = m; p && p !== root; p = p.parent) if (p.userData.dynamic) return;
      const key = m.geometry.uuid + '/' + m.material.uuid + '/' + m.castShadow;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(m);
    });
    buckets.forEach(objects => {
      if (objects.length < 3) return;
      const first = objects[0], batch = new THREE.InstancedMesh(first.geometry, first.material, objects.length);
      batch.name = 'Batched room detail'; batch.castShadow = first.castShadow; batch.receiveShadow = true;
      objects.forEach((m, i) => { batch.setMatrixAt(i, m.matrixWorld); m.parent.remove(m); });
      batch.instanceMatrix.needsUpdate = true; root.add(batch);
    });
  },

  dispose(root) {
    if (!root) return;
    const geometries = new Set(), materials = new Set(), textures = new Set();
    root.traverse(o => {
      if (o.geometry) geometries.add(o.geometry);
      if (o.skeleton && o.skeleton.boneTexture) textures.add(o.skeleton.boneTexture);
      if (o.shadow) o.shadow.dispose();
      for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
        if (!m) continue; materials.add(m);
        Object.values(m).forEach(value => { if (value && value.isTexture) textures.add(value); });
      }
    });
    geometries.forEach(g => g.dispose()); textures.forEach(t => t.dispose()); materials.forEach(m => m.dispose());
  }
};
