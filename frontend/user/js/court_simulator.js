/* ============================================================
   Nyay Setu USER — VIRTUAL COURT SIMULATOR (V5 — Enhanced)
   court_simulator.js — Three.js Scene, 3D Avatars, Camera Director
   Pause/Play, Dynamic Facing, Manual Camera, Wood Bench, Black Hair
   ============================================================ */

const VirtualCourtSimulator = {
  _isPlaying: false,
  _isPaused: false,
  _currentStep: 0,

  // Three.js Core
  _scene: null,
  _camera: null,
  _renderer: null,
  _animationFrameId: null,
  _clock: null,

  // Multi-Avatar System
  _mixers: {},   // { JUDGE: AnimationMixer, DEFENSE: AnimationMixer, PROSECUTION: AnimationMixer }
  _actions: {},  // { JUDGE: AnimationAction, ... }
  _models: {},   // Store model references for dynamic rotation
  _targetRotations: {},  // Target rotation.y for each actor (lerped in animate loop)

  // Audio
  _audioContext: null,
  _activeSpeakerId: null,

  // Cinematic Camera
  _cameraTarget: null,
  _cameraPos: null,
  _currentLookAt: null,
  _cameraDriftTime: 0,

  // 3D Scene Objects
  _spotLight: null,
  _spotLightTarget: null,
  _speakerRings: {},
  _namePlates: {},

  // Pause/Play
  _pendingStepTimeout: null,

  // Avatar Model Files
  AVATAR_FILES: {
    DEFENSE: 'assets/Talking.fbx.glb',
    PROSECUTION: 'assets/female_talking.glb',
    JUDGE: 'assets/judge_talking.glb'
  },

  // Court Hearing Script — Extended ~1 Minute Debate
  _script: [
    {
      actor: 'JUDGE',
      name: 'Hon\'ble Justice R.K. Desai (Presiding)',
      text: 'Order, order! The Court is now in session. We will hear final arguments in the matter of Sharma versus Sharma, Civil Suit Number 247 of 2024. Counsel for the Defense, you may proceed with your opening submission.',
      pitch: 0.75, rate: 0.9, gavel: true
    },
    {
      actor: 'DEFENSE',
      name: 'Adv. Rajesh V. Rao (Defense Counsel)',
      text: 'Much obliged, Milord. The core of our argument rests on Exhibit B, the original registered will dated 14th October 2012, which unequivocally partitions the disputed ancestral property in favour of my client, Shri Ramesh Sharma.',
      pitch: 1.0, rate: 1.0, gavel: false
    },
    {
      actor: 'PROSECUTION',
      name: 'Adv. Smita Patel (State Counsel)',
      text: 'Objection, Milord! Exhibit B has been conclusively proven to be a forged instrument by the lower civil court. The forensic handwriting report in Exhibit D leaves absolutely no ambiguity. The signatures do not match the testator\'s known specimens.',
      pitch: 1.15, rate: 1.0, gavel: false
    },
    {
      actor: 'JUDGE',
      name: 'Hon\'ble Justice R.K. Desai (Presiding)',
      text: 'Objection sustained. Defense counsel, you are instructed to restrict your arguments strictly to verified documentary records. Let Exhibit D, the forensic report, be formally placed on record.',
      pitch: 0.75, rate: 0.9, gavel: true
    },
    {
      actor: 'DEFENSE',
      name: 'Adv. Rajesh V. Rao (Defense Counsel)',
      text: 'Milord, with due respect, we challenge the authenticity of the forensic report itself. Our expert witness, Dr. Suresh Kapoor, a graphologist with 25 years of experience, has submitted an independent analysis in Exhibit F which directly contradicts the findings of Exhibit D.',
      pitch: 1.0, rate: 1.0, gavel: false
    },
    {
      actor: 'PROSECUTION',
      name: 'Adv. Smita Patel (State Counsel)',
      text: 'Milord, the defense is attempting to introduce a privately commissioned report to override the court-appointed forensic laboratory\'s findings. This is a clear attempt to mislead this Hon\'ble Court. We request that Exhibit F be struck from the record.',
      pitch: 1.15, rate: 1.0, gavel: false
    },
    {
      actor: 'JUDGE',
      name: 'Hon\'ble Justice R.K. Desai (Presiding)',
      text: 'The Court will examine both reports. Defense counsel, your expert witness shall be cross-examined in the next hearing. Both parties are directed to file their written submissions within two weeks. Is there anything further?',
      pitch: 0.75, rate: 0.9, gavel: false
    },
    {
      actor: 'DEFENSE',
      name: 'Adv. Rajesh V. Rao (Defense Counsel)',
      text: 'Yes, Milord. We also place reliance on the Supreme Court judgment in Balwant Singh versus Daulat Singh, 2019, where the Hon\'ble Apex Court held that a registered will carries a presumption of due execution unless rebutted by cogent and compelling evidence.',
      pitch: 1.0, rate: 1.0, gavel: false
    },
    {
      actor: 'PROSECUTION',
      name: 'Adv. Smita Patel (State Counsel)',
      text: 'Milord, the cited precedent is clearly distinguishable. In Balwant Singh, the will was not contested on grounds of forgery but on grounds of undue influence. Here, we have direct forensic evidence of fabrication. The facts are entirely different.',
      pitch: 1.15, rate: 1.0, gavel: false
    },
    {
      actor: 'JUDGE',
      name: 'Hon\'ble Justice R.K. Desai (Presiding)',
      text: 'Both counsels have raised important legal points. The Court takes note of the Supreme Court citation and the forensic evidence. I am inclined to allow the cross-examination of both expert witnesses before arriving at any conclusion.',
      pitch: 0.75, rate: 0.9, gavel: false
    },
    {
      actor: 'DEFENSE',
      name: 'Adv. Rajesh V. Rao (Defense Counsel)',
      text: 'We are grateful, Milord. We also request that the original will be sent for fresh forensic examination to an independent government laboratory, preferably the Central Forensic Science Laboratory in Hyderabad.',
      pitch: 1.0, rate: 1.0, gavel: false
    },
    {
      actor: 'PROSECUTION',
      name: 'Adv. Smita Patel (State Counsel)',
      text: 'We have no objection to a fresh forensic examination, provided it is conducted under the supervision of this Hon\'ble Court and both parties are given an opportunity to be present during the analysis.',
      pitch: 1.15, rate: 1.0, gavel: false
    },
    {
      actor: 'JUDGE',
      name: 'Hon\'ble Justice R.K. Desai (Presiding)',
      text: 'So ordered. The original will, Exhibit B, shall be sent to the Central Forensic Science Laboratory, Hyderabad, for fresh examination. The next date of hearing is fixed for 15th November, 2024. The Court is adjourned.',
      pitch: 0.75, rate: 0.9, gavel: true
    }
  ],

  // Camera Presets — adjusted for correct facing directions
  CAMERAS: {
    WIDE:        { pos: [0, 5, 14],     target: [0, 1.5, 0] },
    JUDGE:       { pos: [0, 3.5, 3],    target: [0, 2.5, -1.8] },
    DEFENSE:     { pos: [-2, 2.8, -1],  target: [-4, 1.5, 1] },
    PROSECUTION: { pos: [2, 2.8, -1],   target: [4, 1.5, 1] }
  },

  // Avatar Placement (world coordinates)
  SPEAKER_COORDS: {
    JUDGE:       { x: 0,  y: -1.5, z: -1.8 },  // Very low Y — only head+shoulders visible above bench = SEATED
    DEFENSE:     { x: -4, y: 0,    z: 1 },       // Standing behind podium
    PROSECUTION: { x: 4,  y: 0,    z: 1 }        // Standing behind podium
  },

  /* ==================== 1. UI RENDERING ==================== */
  renderLanding() {
    return `
      <div class="vc-hub-container">
        <div class="vc-hero-banner">
          <div class="vc-status-badge">
            <span class="material-symbols-rounded">view_in_ar</span>
            V5 WebGL Engine — 3-Avatar Debate
          </div>
          <h1>3D Virtual Courtroom Simulator</h1>
          <p>Experience an immersive 3D courtroom debate with Judge, Defense & Prosecution avatars, cinematic cameras, and AI speech.</p>
          <button class="u-btn u-btn-primary u-btn-lg u-btn-pill" onclick="Router.navigate('/court/simulate')">
            <span class="material-symbols-rounded">play_arrow</span> Enter 3D Simulation
          </button>
        </div>
      </div>
    `;
  },

  render() {
    return `
      <div class="v3-simulation-wrapper" id="v3-wrapper">
        <div class="v3-loading-overlay" id="v3-loader">
          <div class="v3-spinner"></div>
          <div style="font-size:0.85rem;color:var(--u-text-tertiary);letter-spacing:1px;text-transform:uppercase;">Initializing 3D Courtroom...</div>
        </div>

        <!-- Gavel Strike Alert -->
        <div class="v3-gavel-alert" id="v3-gavel-alert">
          <span class="material-symbols-rounded">gavel</span>
          <span>Order in the Court</span>
        </div>

        <!-- Three.js mounts here -->
        <canvas class="v3-webgl-canvas" id="v3-canvas"></canvas>

        <div class="v3-hud-overlay">
          <div class="v3-hud-top">
            <div class="v3-camera-controls" id="v3-cams">
              <button class="v3-cam-btn active" onclick="VirtualCourtSimulator.setCamera('WIDE')">WIDE</button>
              <button class="v3-cam-btn" onclick="VirtualCourtSimulator.setCamera('JUDGE')">JUDGE</button>
              <button class="v3-cam-btn" onclick="VirtualCourtSimulator.setCamera('DEFENSE')">DEFENSE</button>
              <button class="v3-cam-btn" onclick="VirtualCourtSimulator.setCamera('PROSECUTION')">PROS</button>
            </div>
            <div class="v3-playback-controls">
              <button class="v3-play-btn" id="v3-pause-btn" onclick="VirtualCourtSimulator.togglePause()" title="Pause / Play">
                <span class="material-symbols-rounded" id="v3-pause-icon">pause</span>
              </button>
            </div>
            <div class="v3-hud-status recording" id="v3-status">
              <span class="material-symbols-rounded">fiber_manual_record</span> IN SESSION
            </div>
          </div>

          <div class="v3-hud-bottom">
            <div class="v3-subtitle-container" id="v3-subtitle">
              <span class="v3-speaker-name" id="v3-speaker">
                <span id="v3-speaker-text"></span>
                <span class="v3-audio-wave">
                  <span class="v3-audio-bar"></span>
                  <span class="v3-audio-bar"></span>
                  <span class="v3-audio-bar"></span>
                  <span class="v3-audio-bar"></span>
                </span>
              </span>
              <p class="v3-subtitle-text" id="v3-subtitle-text"></p>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  /* ==================== 2. WEBGL INITIALIZATION ==================== */
  startSimulation() {
    if (this._isPlaying) return;
    this._isPlaying = true;
    this._isPaused = false;
    this._currentStep = 0;
    this._mixers = {};
    this._actions = {};
    this._models = {};
    this._targetRotations = {};
    this._speakerRings = {};

    // Preload speech synthesis voices (required in Chrome)
    if (window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }

    setTimeout(() => {
      this._initThreeJS();
      this._buildEnvironment();
      this._initAudio();

      const loader = document.getElementById('v3-loader');
      if (loader) loader.classList.add('hidden');

      // Start render loop
      this._animate();

      // Start script after short delay for models to load
      setTimeout(() => this._playNextStep(), 2500);
    }, 400);
  },

  _initThreeJS() {
    const canvas = document.getElementById('v3-canvas');
    const wrapper = document.getElementById('v3-wrapper');
    if (!canvas || !wrapper) return;

    this._scene = new THREE.Scene();

    const aspect = wrapper.clientWidth / wrapper.clientHeight;
    this._camera = new THREE.PerspectiveCamera(40, aspect, 0.1, 500);

    this._cameraPos = new THREE.Vector3(...this.CAMERAS.WIDE.pos);
    this._cameraTarget = new THREE.Vector3(...this.CAMERAS.WIDE.target);
    this._currentLookAt = this._cameraTarget.clone();
    this._camera.position.copy(this._cameraPos);
    this._camera.lookAt(this._currentLookAt);

    this._renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this._renderer.setSize(wrapper.clientWidth, wrapper.clientHeight);
    this._renderer.shadowMap.enabled = true;
    this._renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this._renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this._renderer.toneMappingExposure = 1.1;
    this._renderer.outputEncoding = THREE.sRGBEncoding;

    this._clock = new THREE.Clock();

    // Window resize handler
    this._resizeHandler = this._onWindowResize.bind(this);
    window.addEventListener('resize', this._resizeHandler);
  },

  _onWindowResize() {
    const wrapper = document.getElementById('v3-wrapper');
    if (!wrapper || !this._camera || !this._renderer) return;
    this._camera.aspect = wrapper.clientWidth / wrapper.clientHeight;
    this._camera.updateProjectionMatrix();
    this._renderer.setSize(wrapper.clientWidth, wrapper.clientHeight);
  },

  /* ==================== 3. SCENE CONSTRUCTION ==================== */
  _buildEnvironment() {
    // === DARK COURTROOM ATMOSPHERE ===
    this._scene.background = new THREE.Color(0x060809);
    this._scene.fog = new THREE.FogExp2(0x060809, 0.008);

    // === LIGHTING (Realistic Courtroom) ===

    // 1. Warm ambient fill light (simulating indirect bounced light from wood paneling)
    const ambient = new THREE.AmbientLight(0xffeedd, 0.35);
    this._scene.add(ambient);

    // 2. Hemisphere light (cool sky from above, warm floor reflections)
    const hemi = new THREE.HemisphereLight(0x8faab4, 0x3d2b1f, 0.5);
    hemi.position.set(0, 20, 0);
    this._scene.add(hemi);

    // 3. Main overhead courtroom chandelier (warm directional)
    const mainLight = new THREE.DirectionalLight(0xffeedd, 1.2);
    mainLight.position.set(0, 15, 5);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 50;
    mainLight.shadow.camera.left = -15;
    mainLight.shadow.camera.right = 15;
    mainLight.shadow.camera.top = 15;
    mainLight.shadow.camera.bottom = -15;
    this._scene.add(mainLight);

    // 4. Active-speaker tracking spotlight
    this._spotLightTarget = new THREE.Object3D();
    this._spotLightTarget.position.set(0, 0, 0);
    this._scene.add(this._spotLightTarget);

    this._spotLight = new THREE.SpotLight(0xfff0c0, 2.5, 40, Math.PI / 7, 0.6, 1.2);
    this._spotLight.position.set(0, 12, 10);
    this._spotLight.target = this._spotLightTarget;
    this._spotLight.castShadow = true;
    this._scene.add(this._spotLight);

    // 5. Window accent light (subtle blue side-fill simulating daylight from court windows)
    const windowLight = new THREE.DirectionalLight(0x6699cc, 0.3);
    windowLight.position.set(-10, 8, 0);
    this._scene.add(windowLight);

    // === COURTROOM FLOOR ===
    const floorGeo = new THREE.PlaneGeometry(40, 30);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x2a1a0e,
      roughness: 0.7,
      metalness: 0.1
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.05;
    floor.receiveShadow = true;
    this._scene.add(floor);

    // === JUDGE'S BENCH (Elevated Platform — Rich Wood) ===
    const benchGeo = new THREE.BoxGeometry(8, 2.0, 3);
    const benchMat = new THREE.MeshStandardMaterial({
      color: 0x8B5A2B,
      roughness: 0.55,
      metalness: 0.08
    });
    const bench = new THREE.Mesh(benchGeo, benchMat);
    bench.position.set(0, 1.0, -2);
    bench.castShadow = true;
    bench.receiveShadow = true;
    this._scene.add(bench);

    // Bench front panel accent (warm polished wood)
    const panelGeo = new THREE.BoxGeometry(8.2, 1.6, 0.1);
    const panelMat = new THREE.MeshStandardMaterial({
      color: 0xA0522D,
      roughness: 0.45,
      metalness: 0.12
    });
    const panel = new THREE.Mesh(panelGeo, panelMat);
    panel.position.set(0, 1.2, -0.45);
    this._scene.add(panel);

    // Ashoka Emblem placeholder (gold circle behind judge)
    const emblemGeo = new THREE.CircleGeometry(1.0, 32);
    const emblemMat = new THREE.MeshStandardMaterial({
      color: 0xd4a847,
      roughness: 0.3,
      metalness: 0.7,
      emissive: 0xd4a847,
      emissiveIntensity: 0.2
    });
    const emblem = new THREE.Mesh(emblemGeo, emblemMat);
    emblem.position.set(0, 5.5, -3.4);
    this._scene.add(emblem);

    // === ADVOCATE PODIUMS (Left = Defense, Right = Prosecution) ===
    const podiumGeo = new THREE.BoxGeometry(2.5, 1.2, 1.5);
    const podiumMat = new THREE.MeshStandardMaterial({
      color: 0x6B3A20,
      roughness: 0.6,
      metalness: 0.06
    });

    const leftPodium = new THREE.Mesh(podiumGeo, podiumMat);
    leftPodium.position.set(-4, 0.6, 1);
    leftPodium.castShadow = true;
    leftPodium.receiveShadow = true;
    this._scene.add(leftPodium);

    const rightPodium = new THREE.Mesh(podiumGeo, podiumMat.clone());
    rightPodium.position.set(4, 0.6, 1);
    rightPodium.castShadow = true;
    rightPodium.receiveShadow = true;
    this._scene.add(rightPodium);

    // === COURTROOM RAILING (Wooden Bar) ===
    const railGeo = new THREE.BoxGeometry(20, 0.1, 0.15);
    const railMat = new THREE.MeshStandardMaterial({
      color: 0x5a3520,
      roughness: 0.5,
      metalness: 0.1
    });
    const rail = new THREE.Mesh(railGeo, railMat);
    rail.position.set(0, 1.1, 4);
    this._scene.add(rail);

    // Rail Posts
    for (let x = -10; x <= 10; x += 2.5) {
      const postGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.1, 8);
      const post = new THREE.Mesh(postGeo, railMat.clone());
      post.position.set(x, 0.55, 4);
      this._scene.add(post);
    }

    // === BACK WALL ===
    const wallGeo = new THREE.PlaneGeometry(40, 15);
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x0f0a07,
      roughness: 0.9,
      metalness: 0
    });
    const backWall = new THREE.Mesh(wallGeo, wallMat);
    backWall.position.set(0, 7, -3.5);
    this._scene.add(backWall);

    // === SIDE WALLS ===
    const sideWallGeo = new THREE.PlaneGeometry(30, 15);
    const leftWall = new THREE.Mesh(sideWallGeo, wallMat.clone());
    leftWall.position.set(-20, 7, 0);
    leftWall.rotation.y = Math.PI / 2;
    this._scene.add(leftWall);

    const rightWall = new THREE.Mesh(sideWallGeo, wallMat.clone());
    rightWall.position.set(20, 7, 0);
    rightWall.rotation.y = -Math.PI / 2;
    this._scene.add(rightWall);

    // === 3D NAMEPLATE LABELS (glowing ring indicators for active speaker) ===
    Object.keys(this.SPEAKER_COORDS).forEach(key => {
      const coord = this.SPEAKER_COORDS[key];

      // Glowing base ring for active speaker
      const ringGeo = new THREE.RingGeometry(0.8, 0.95, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: key === 'JUDGE' ? 0xd4a847 : 0x0d9488,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.set(coord.x, 0.02, coord.z);
      ring.rotation.x = -Math.PI / 2;
      this._scene.add(ring);
      this._speakerRings[key] = ring;
    });

    // === LOAD 3 AVATARS ===
    // Judge faces +Z (toward lawyers and audience — front-facing)
    this._loadAvatar(this.AVATAR_FILES.JUDGE, 'JUDGE', 2.5, 0, 0);
    // Defense and Prosecution face toward judge (dynamically adjusted during simulation)
    const defRot = Math.atan2(0 - (-4), -1.8 - 1); // Direction from defense to judge
    this._loadAvatar(this.AVATAR_FILES.DEFENSE, 'DEFENSE', 2.5, defRot, 0);
    const prosRot = Math.atan2(0 - 4, -1.8 - 1);   // Direction from prosecution to judge
    this._loadAvatar(this.AVATAR_FILES.PROSECUTION, 'PROSECUTION', 2.5, prosRot, 0);
  },

  _loadAvatar(url, actorKey, scale, rotY, adjustY) {
    if (!window.THREE || !window.THREE.GLTFLoader) {
      console.error('GLTFLoader not available');
      return;
    }
    const gltfLoader = new THREE.GLTFLoader();
    gltfLoader.load(url, (gltf) => {
      const model = gltf.scene;
      const coord = this.SPEAKER_COORDS[actorKey];
      model.position.set(coord.x, coord.y + adjustY, coord.z);
      model.scale.set(scale, scale, scale);
      model.rotation.y = rotY;

      // Store model reference for dynamic rotation
      this._models[actorKey] = model;
      this._targetRotations[actorKey] = rotY;

      // Enable shadows, apply BLACK SUIT dress, and force BLACK HAIR
      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;

          if (child.material) {
            const mat = child.material.clone();
            const meshName = (child.name || '').toLowerCase();
            const matName = (mat.name || '').toLowerCase();
            const combined = meshName + ' ' + matName;

            // Hair detection (by mesh/material name keywords)
            const isHair = combined.includes('hair') || combined.includes('bangs') ||
                           combined.includes('ponytail') || combined.includes('scalp');
            // Skin detection (head, face, hands — but NOT hair parts)
            const isSkin = !isHair && (combined.includes('head') || combined.includes('face') ||
                           combined.includes('hand') || combined.includes('skin'));

            if (isHair) {
              // Force JET BLACK hair
              mat.color = new THREE.Color(0x080808);
              mat.roughness = 0.85;
              mat.metalness = 0.05;
            } else if (isSkin) {
              // Keep skin tone — fix overly white/default mesh colors
              const c = mat.color;
              if (c && (c.r + c.g + c.b) > 2.5) {
                mat.color = new THREE.Color(0xc8956c);
                mat.roughness = 0.7;
                mat.metalness = 0.02;
              }
            } else {
              // Everything else = BLACK SUIT (professional courtroom attire)
              mat.color = new THREE.Color(0x0a0a0a);
              mat.roughness = 0.7;
              mat.metalness = 0.08;
            }
            child.material = mat;
          }
        }
      });

      // Per-avatar spotlight for premium look
      const avatarLight = new THREE.PointLight(
        actorKey === 'JUDGE' ? 0xffeedd : 0xffffff,
        0.8, 12
      );
      avatarLight.position.set(coord.x, coord.y + 5, coord.z + 3);
      this._scene.add(avatarLight);

      this._scene.add(model);

      // Set up animation
      if (gltf.animations && gltf.animations.length > 0) {
        const mixer = new THREE.AnimationMixer(model);
        this._mixers[actorKey] = mixer;
        const action = mixer.clipAction(gltf.animations[0]);
        action.play();
        action.paused = true; // Start paused until it's their turn to speak
        this._actions[actorKey] = action;
      }

      console.log(`Avatar loaded: ${actorKey}`);
    }, undefined, (error) => {
      console.error(`Failed to load avatar ${actorKey}:`, error);
    });
  },

  /* ==================== 4. AUDIO ==================== */
  _initAudio() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this._audioContext = new AudioCtx();
    } catch (e) {
      console.warn('AudioContext not supported', e);
    }
  },

  _playGavelSound() {
    if (!this._audioContext) return;
    if (this._audioContext.state === 'suspended') {
      this._audioContext.resume();
    }

    const now = this._audioContext.currentTime;

    // Show visual gavel alert badge
    const gavelAlert = document.getElementById('v3-gavel-alert');
    if (gavelAlert) {
      gavelAlert.classList.add('active');
      setTimeout(() => gavelAlert.classList.remove('active'), 1800);
    }

    // Double strike: Strike 1 at t=0, Strike 2 at t=0.22s
    [0, 0.22].forEach(delay => {
      const osc = this._audioContext.createOscillator();
      const gain = this._audioContext.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(160, now + delay);
      osc.frequency.exponentialRampToValueAtTime(35, now + delay + 0.12);

      gain.gain.setValueAtTime(0.65, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.14);

      osc.connect(gain);
      gain.connect(this._audioContext.destination);

      osc.start(now + delay);
      osc.stop(now + delay + 0.15);
    });
  },

  /* ==================== 5. ANIMATION LOOP ==================== */
  _animate() {
    this._animationFrameId = requestAnimationFrame(this._animate.bind(this));
    this._cameraDriftTime += 0.008;

    // Update all avatar animation mixers (skip when paused)
    if (this._clock) {
      const delta = this._clock.getDelta();
      if (!this._isPaused) {
        Object.values(this._mixers).forEach(mixer => mixer.update(delta));
      }
    }

    // Smooth rotation lerping for character facing directions
    Object.keys(this._models).forEach(key => {
      const model = this._models[key];
      const target = this._targetRotations[key];
      if (model && target !== undefined) {
        let diff = target - model.rotation.y;
        // Normalize angle difference to [-PI, PI] for shortest path
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        model.rotation.y += diff * 0.04;
      }
    });

    // 1. Cinematic Camera Lerping
    if (this._camera && this._cameraPos && this._cameraTarget) {
      this._camera.position.lerp(this._cameraPos, 0.04);

      // Subtle handheld broadcast camera drift
      const driftX = Math.sin(this._cameraDriftTime * 0.7) * 0.08;
      const driftY = Math.cos(this._cameraDriftTime * 0.9) * 0.05;

      this._currentLookAt.lerp(this._cameraTarget, 0.05);
      const lookTarget = this._currentLookAt.clone().add(new THREE.Vector3(driftX, driftY, 0));
      this._camera.lookAt(lookTarget);
    }

    // 2. Spotlight tracks active speaker
    if (this._spotLightTarget && this._activeSpeakerId && this.SPEAKER_COORDS[this._activeSpeakerId]) {
      const targetCoord = this.SPEAKER_COORDS[this._activeSpeakerId];
      this._spotLightTarget.position.lerp(
        new THREE.Vector3(targetCoord.x, targetCoord.y + 1, targetCoord.z), 0.06
      );
    }

    // 3. Pulsing floor rings for active speaker
    Object.keys(this._speakerRings).forEach(id => {
      const ring = this._speakerRings[id];
      if (id === this._activeSpeakerId) {
        ring.material.opacity = 0.5 + Math.sin(this._cameraDriftTime * 6) * 0.3;
        const s = 1.0 + Math.sin(this._cameraDriftTime * 4) * 0.15;
        ring.scale.set(s, s, 1);
      } else {
        ring.material.opacity = Math.max(0, ring.material.opacity - 0.03);
      }
    });

    // Render
    if (this._renderer && this._scene && this._camera) {
      this._renderer.render(this._scene, this._camera);
    }
  },

  /* ==================== 6. ORCHESTRATION ==================== */
  setCamera(presetId) {
    const preset = this.CAMERAS[presetId];
    if (!preset) return;

    this._cameraPos.set(...preset.pos);
    this._cameraTarget.set(...preset.target);

    // Update UI active buttons
    document.querySelectorAll('.v3-cam-btn').forEach(b => b.classList.remove('active'));
    const btns = document.querySelectorAll('.v3-cam-btn');
    const order = ['WIDE', 'JUDGE', 'DEFENSE', 'PROSECUTION'];
    const idx = order.indexOf(presetId);
    if (idx !== -1 && btns[idx]) {
      btns[idx].classList.add('active');
    }
  },

  _playNextStep() {
    // If paused, wait and re-check every 300ms
    if (this._isPaused) {
      this._pendingStepTimeout = setTimeout(() => this._playNextStep(), 300);
      return;
    }

    if (this._currentStep >= this._script.length) {
      this._endSimulation();
      return;
    }

    const step = this._script[this._currentStep];
    this._activeSpeakerId = step.actor;

    // 1. Update character facing directions (camera stays on user's manual choice — NO auto-switch)
    this._updateCharacterFacing(step.actor);

    // 2. Play Gavel Strike if indicated
    if (step.gavel) {
      this._playGavelSound();
    }

    // 3. Show Subtitles & Audio Wave
    const subContainer = document.getElementById('v3-subtitle');
    const speakerTextEl = document.getElementById('v3-speaker-text');
    const textEl = document.getElementById('v3-subtitle-text');

    if (speakerTextEl) speakerTextEl.innerText = step.name;
    if (textEl) textEl.innerText = step.text;
    if (subContainer) subContainer.classList.add('active');

    // 4. Sync Avatar Animation — only active speaker animates
    Object.keys(this._actions).forEach(actor => {
      const action = this._actions[actor];
      if (actor === step.actor) {
        action.paused = false;
      } else {
        action.paused = true;
      }
    });

    // 5. Speak text via Web Speech API
    this._speakText(step.text, step.pitch, step.rate, () => {
      if (subContainer) subContainer.classList.remove('active');
      this._activeSpeakerId = null;

      // Pause all avatars
      Object.values(this._actions).forEach(action => { action.paused = true; });

      this._currentStep++;
      this._pendingStepTimeout = setTimeout(() => this._playNextStep(), 1200);
    });
  },

  // Voice preference per actor for distinct speech
  _voicePrefs: {
    JUDGE: { gender: 'male', keywords: ['david', 'james', 'daniel', 'male', 'man'], fallbackPitch: 0.7 },
    DEFENSE: { gender: 'male', keywords: ['mark', 'richard', 'george', 'english', 'uk'], fallbackPitch: 1.0 },
    PROSECUTION: { gender: 'female', keywords: ['zira', 'sarah', 'female', 'woman', 'hazel', 'fiona'], fallbackPitch: 1.3 }
  },

  _findVoice(actorKey) {
    if (!window.speechSynthesis) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;

    const pref = this._voicePrefs[actorKey];
    if (!pref) return null;

    // Try to find a matching voice by keyword
    for (const kw of pref.keywords) {
      const found = voices.find(v => v.name.toLowerCase().includes(kw));
      if (found) return found;
    }

    // Fallback: pick any English voice
    const enVoices = voices.filter(v => v.lang && v.lang.startsWith('en'));
    if (enVoices.length > 0) {
      // Try to pick different indices for different actors
      const actorIdx = { JUDGE: 0, DEFENSE: 1, PROSECUTION: 2 };
      const idx = actorIdx[actorKey] || 0;
      return enVoices[idx % enVoices.length];
    }

    return null;
  },

  _speakText(text, pitch, rate, onEnd) {
    if (!window.speechSynthesis) {
      setTimeout(onEnd, 3500);
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.pitch = pitch;
    utterance.rate = rate;

    // Assign a distinct voice per actor
    const actorKey = this._activeSpeakerId;
    const voice = this._findVoice(actorKey);
    if (voice) {
      utterance.voice = voice;
    } else {
      // Apply fallback pitch difference if no distinct voice found
      const pref = this._voicePrefs[actorKey];
      if (pref) utterance.pitch = pref.fallbackPitch;
    }

    utterance.onend = () => { onEnd(); };
    utterance.onerror = () => { onEnd(); };

    window.speechSynthesis.speak(utterance);
  },

  /* ==================== 7. PAUSE / PLAY CONTROL ==================== */
  togglePause() {
    this._isPaused = !this._isPaused;

    const icon = document.getElementById('v3-pause-icon');
    const btn = document.getElementById('v3-pause-btn');

    if (this._isPaused) {
      // PAUSE — freeze speech and animations
      if (window.speechSynthesis) window.speechSynthesis.pause();
      Object.values(this._actions).forEach(action => { action.paused = true; });
      if (icon) icon.textContent = 'play_arrow';
      if (btn) btn.classList.add('paused');

      // Update status badge
      const statusEl = document.getElementById('v3-status');
      if (statusEl) {
        statusEl.innerHTML = '<span class="material-symbols-rounded">pause_circle</span> PAUSED';
        statusEl.classList.remove('recording');
        statusEl.style.color = '#fbbf24';
        statusEl.style.borderColor = 'rgba(251, 191, 36, 0.3)';
      }
    } else {
      // RESUME — continue speech and active speaker's animation from where we left off
      if (window.speechSynthesis) window.speechSynthesis.resume();
      // Resume ONLY the active speaker's animation
      if (this._activeSpeakerId && this._actions[this._activeSpeakerId]) {
        this._actions[this._activeSpeakerId].paused = false;
      }
      if (icon) icon.textContent = 'pause';
      if (btn) btn.classList.remove('paused');

      // Restore status badge
      const statusEl = document.getElementById('v3-status');
      if (statusEl) {
        statusEl.innerHTML = '<span class="material-symbols-rounded">fiber_manual_record</span> IN SESSION';
        statusEl.classList.add('recording');
        statusEl.style.color = '';
        statusEl.style.borderColor = '';
      }
    }
  },

  /* ==================== 8. DYNAMIC CHARACTER FACING ==================== */
  _updateCharacterFacing(speakerKey) {
    const c = this.SPEAKER_COORDS;

    // Judge ALWAYS faces forward (+Z direction, toward both lawyers and audience)
    this._targetRotations['JUDGE'] = 0;

    if (speakerKey === 'JUDGE') {
      // When judge speaks → both lawyers face the judge
      this._targetRotations['DEFENSE'] = Math.atan2(
        c.JUDGE.x - c.DEFENSE.x, c.JUDGE.z - c.DEFENSE.z
      );
      this._targetRotations['PROSECUTION'] = Math.atan2(
        c.JUDGE.x - c.PROSECUTION.x, c.JUDGE.z - c.PROSECUTION.z
      );
    } else if (speakerKey === 'DEFENSE') {
      // Defense faces judge while arguing; Prosecution looks toward Defense (opponent)
      this._targetRotations['DEFENSE'] = Math.atan2(
        c.JUDGE.x - c.DEFENSE.x, c.JUDGE.z - c.DEFENSE.z
      );
      this._targetRotations['PROSECUTION'] = Math.atan2(
        c.DEFENSE.x - c.PROSECUTION.x, c.DEFENSE.z - c.PROSECUTION.z
      );
    } else if (speakerKey === 'PROSECUTION') {
      // Prosecution faces judge while arguing; Defense looks toward Prosecution (opponent)
      this._targetRotations['PROSECUTION'] = Math.atan2(
        c.JUDGE.x - c.PROSECUTION.x, c.JUDGE.z - c.PROSECUTION.z
      );
      this._targetRotations['DEFENSE'] = Math.atan2(
        c.PROSECUTION.x - c.DEFENSE.x, c.PROSECUTION.z - c.DEFENSE.z
      );
    }
  },

  _endSimulation() {
    this.setCamera('WIDE');
    this._playGavelSound();

    const statusEl = document.getElementById('v3-status');
    if (statusEl) {
      statusEl.innerHTML = '<span class="material-symbols-rounded">gavel</span> COURT ADJOURNED';
      statusEl.classList.remove('recording');
      statusEl.style.color = '#38bdf8';
      statusEl.style.borderColor = 'rgba(56, 189, 248, 0.3)';
    }

    // Pause all avatars
    Object.values(this._actions).forEach(action => { action.paused = true; });

    setTimeout(() => {
      Router.navigate('/hearing/day');
    }, 4500);
  },

  stopSimulation() {
    this._isPlaying = false;
    this._isPaused = false;
    if (this._pendingStepTimeout) {
      clearTimeout(this._pendingStepTimeout);
      this._pendingStepTimeout = null;
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (this._animationFrameId) {
      cancelAnimationFrame(this._animationFrameId);
      this._animationFrameId = null;
    }
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
      this._resizeHandler = null;
    }
    if (this._renderer) {
      this._renderer.dispose();
      this._renderer = null;
    }
    this._mixers = {};
    this._actions = {};
    this._models = {};
    this._targetRotations = {};
    this._speakerRings = {};
  }
};
