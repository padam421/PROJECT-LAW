/* ============================================================
   Nyay Setu USER — VIRTUAL COURT SIMULATOR (V4 — 3-Avatar Debate)
   court_simulator.js — Three.js Scene, 3D Avatars, Camera Director
   ============================================================ */

const VirtualCourtSimulator = {
  _isPlaying: false,
  _isPaused: false,
  _currentStep: 0,
  _stepTimeout: null,

  // Camera Mode: 'WIDE' by default; stays on user's manual selection
  _cameraMode: 'WIDE',

  // Three.js Core
  _scene: null,
  _camera: null,
  _renderer: null,
  _animationFrameId: null,
  _clock: null,

  // Multi-Avatar System
  _mixers: {},   // { JUDGE: AnimationMixer, DEFENSE: AnimationMixer, PROSECUTION: AnimationMixer }
  _actions: {},  // { JUDGE: AnimationAction, DEFENSE: AnimationAction, PROSECUTION: AnimationAction }
  _avatarModels: {}, // 3D models for dynamic lawyer orientation
  _targetRotations: {
    JUDGE: 0,            // Faces straight forward toward both lawyers and court (+Z)
    DEFENSE: 0.35,       // Default angle facing courtroom/judge
    PROSECUTION: -0.35   // Default angle facing courtroom/judge
  },

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

  // Avatar Model Files
  AVATAR_FILES: {
    DEFENSE: 'assets/Talking.fbx.glb',
    PROSECUTION: 'assets/female_talking.glb',
    JUDGE: 'assets/judge_talking.glb'
  },

  // Court Hearing Script — Extended ~1 Minute Debate with Dynamic Lawyer Facing:
  // DEFENSE lawyer: 0.85 = facing Judge bench, 1.42 = facing Opponent across aisle
  // PROSECUTION lawyer: -0.85 = facing Judge bench, -1.42 = facing Opponent across aisle
  _script: [
    {
      actor: 'JUDGE',
      name: 'Hon\'ble Justice R.K. Desai (Presiding)',
      text: 'Order, order! The Court is now in session. We will hear final arguments in the matter of Sharma versus Sharma, Civil Suit Number 247 of 2024. Counsel for the Defense, you may proceed with your opening submission.',
      pitch: 0.75, rate: 0.9, gavel: true,
      facing: { DEFENSE: 0.85, PROSECUTION: -0.85 }
    },
    {
      actor: 'DEFENSE',
      name: 'Adv. Rajesh V. Rao (Defense Counsel)',
      text: 'Much obliged, Milord. The core of our argument rests on Exhibit B, the original registered will dated 14th October 2012, which unequivocally partitions the disputed ancestral property in favour of my client, Shri Ramesh Sharma.',
      pitch: 1.0, rate: 1.0, gavel: false,
      facing: { DEFENSE: 0.85, PROSECUTION: -1.4 }
    },
    {
      actor: 'PROSECUTION',
      name: 'Adv. Smita Patel (State Counsel)',
      text: 'Objection, Milord! Exhibit B has been conclusively proven to be a forged instrument by the lower civil court. The forensic handwriting report in Exhibit D leaves absolutely no ambiguity. The signatures do not match the testator\'s known specimens.',
      pitch: 1.15, rate: 1.0, gavel: false,
      facing: { DEFENSE: 1.4, PROSECUTION: -0.85 }
    },
    {
      actor: 'JUDGE',
      name: 'Hon\'ble Justice R.K. Desai (Presiding)',
      text: 'Objection sustained. Defense counsel, you are instructed to restrict your arguments strictly to verified documentary records. Let Exhibit D, the forensic report, be formally placed on record.',
      pitch: 0.75, rate: 0.9, gavel: true,
      facing: { DEFENSE: 0.85, PROSECUTION: -0.85 }
    },
    {
      actor: 'DEFENSE',
      name: 'Adv. Rajesh V. Rao (Defense Counsel)',
      text: 'Milord, with due respect, we challenge the authenticity of the forensic report itself. Our expert witness, Dr. Suresh Kapoor, a graphologist with 25 years of experience, has submitted an independent analysis in Exhibit F which directly contradicts the findings of Exhibit D.',
      pitch: 1.0, rate: 1.0, gavel: false,
      facing: { DEFENSE: 1.4, PROSECUTION: -1.4 }
    },
    {
      actor: 'PROSECUTION',
      name: 'Adv. Smita Patel (State Counsel)',
      text: 'Milord, the defense is attempting to introduce a privately commissioned report to override the court-appointed forensic laboratory\'s findings. This is a clear attempt to mislead this Hon\'ble Court. We request that Exhibit F be struck from the record.',
      pitch: 1.15, rate: 1.0, gavel: false,
      facing: { DEFENSE: 1.4, PROSECUTION: -1.4 }
    },
    {
      actor: 'JUDGE',
      name: 'Hon\'ble Justice R.K. Desai (Presiding)',
      text: 'The Court will examine both reports. Defense counsel, your expert witness shall be cross-examined in the next hearing. Both parties are directed to file their written submissions within two weeks. Is there anything further?',
      pitch: 0.75, rate: 0.9, gavel: false,
      facing: { DEFENSE: 0.85, PROSECUTION: -0.85 }
    },
    {
      actor: 'DEFENSE',
      name: 'Adv. Rajesh V. Rao (Defense Counsel)',
      text: 'Yes, Milord. We also place reliance on the Supreme Court judgment in Balwant Singh versus Daulat Singh, 2019, where the Hon\'ble Apex Court held that a registered will carries a presumption of due execution unless rebutted by cogent and compelling evidence.',
      pitch: 1.0, rate: 1.0, gavel: false,
      facing: { DEFENSE: 0.85, PROSECUTION: -0.85 }
    },
    {
      actor: 'PROSECUTION',
      name: 'Adv. Smita Patel (State Counsel)',
      text: 'Milord, the cited precedent is clearly distinguishable. In Balwant Singh, the will was not contested on grounds of forgery but on grounds of undue influence. Here, we have direct forensic evidence of fabrication. The facts are entirely different.',
      pitch: 1.15, rate: 1.0, gavel: false,
      facing: { DEFENSE: 1.35, PROSECUTION: -0.85 }
    },
    {
      actor: 'JUDGE',
      name: 'Hon\'ble Justice R.K. Desai (Presiding)',
      text: 'Both counsels have raised important legal points. The Court takes note of the Supreme Court citation and the forensic evidence. I am inclined to allow the cross-examination of both expert witnesses before arriving at any conclusion.',
      pitch: 0.75, rate: 0.9, gavel: false,
      facing: { DEFENSE: 0.85, PROSECUTION: -0.85 }
    },
    {
      actor: 'DEFENSE',
      name: 'Adv. Rajesh V. Rao (Defense Counsel)',
      text: 'We are grateful, Milord. We also request that the original will be sent for fresh forensic examination to an independent government laboratory, preferably the Central Forensic Science Laboratory in Hyderabad.',
      pitch: 1.0, rate: 1.0, gavel: false,
      facing: { DEFENSE: 0.85, PROSECUTION: -0.85 }
    },
    {
      actor: 'PROSECUTION',
      name: 'Adv. Smita Patel (State Counsel)',
      text: 'We have no objection to a fresh forensic examination, provided it is conducted under the supervision of this Hon\'ble Court and both parties are given an opportunity to be present during the analysis.',
      pitch: 1.15, rate: 1.0, gavel: false,
      facing: { DEFENSE: 1.35, PROSECUTION: -0.85 }
    },
    {
      actor: 'JUDGE',
      name: 'Hon\'ble Justice R.K. Desai (Presiding)',
      text: 'So ordered. The original will, Exhibit B, shall be sent to the Central Forensic Science Laboratory, Hyderabad, for fresh examination. The next date of hearing is fixed for 15th November, 2024. The Court is adjourned.',
      pitch: 0.75, rate: 0.9, gavel: true,
      facing: { DEFENSE: 0.85, PROSECUTION: -0.85 }
    }
  ],

  // Camera Presets — default is WIDE; user can switch anytime
  CAMERAS: {
    WIDE:        { pos: [0, 3.5, 14.5],   target: [0, 1.4, 0] },
    JUDGE:       { pos: [0, 2.5, 3.5],    target: [0, 2.1, -1.8] },
    DEFENSE:     { pos: [-2.6, 3.2, 5.8], target: [-4.0, 2.9, 1.0] },
    PROSECUTION: { pos: [2.6, 3.2, 5.8],  target: [4.0, 2.9, 1.0] }
  },

  // Avatar Placement (world coordinates)
  SPEAKER_COORDS: {
    JUDGE:       { x: 0,  y: -0.45, z: -1.8 },  // Elevated so upper body, robes & head sit authoritatively behind bench = SEATED
    DEFENSE:     { x: -4, y: 0,     z: 1 },     // Standing behind advocate podium
    PROSECUTION: { x: 4,  y: 0,     z: 1 }      // Standing behind advocate podium
  },

  /* ==================== 1. UI RENDERING ==================== */
  renderLanding() {
    return `
      <div class="vc-hub-container">
        <div class="vc-hero-banner">
          <div class="vc-status-badge">
            <span class="material-symbols-rounded">view_in_ar</span>
            V4 WebGL Engine — 3-Avatar Debate
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
            <div class="v3-hud-controls">
              <div class="v3-camera-controls" id="v3-cams">
                <button class="v3-cam-btn active" id="v3-cam-wide" onclick="VirtualCourtSimulator.setCamera('WIDE', true)" title="Wide Courtroom View (Default)">
                  <span class="material-symbols-rounded">panorama</span> WIDE
                </button>
                <button class="v3-cam-btn" id="v3-cam-judge" onclick="VirtualCourtSimulator.setCamera('JUDGE', true)" title="Judge Bench Camera">
                  <span class="material-symbols-rounded">gavel</span> JUDGE
                </button>
                <button class="v3-cam-btn" id="v3-cam-defense" onclick="VirtualCourtSimulator.setCamera('DEFENSE', true)" title="Defense Counsel Camera">
                  <span class="material-symbols-rounded">person</span> DEFENSE
                </button>
                <button class="v3-cam-btn" id="v3-cam-pros" onclick="VirtualCourtSimulator.setCamera('PROSECUTION', true)" title="Prosecution Counsel Camera">
                  <span class="material-symbols-rounded">person</span> PROS
                </button>
              </div>

              <!-- Pause / Resume Button -->
              <button class="v3-control-btn" id="v3-pause-btn" onclick="VirtualCourtSimulator.togglePause()" title="Pause / Resume Debate">
                <span class="material-symbols-rounded" id="v3-pause-icon">pause</span>
                <span id="v3-pause-text">PAUSE</span>
              </button>
            </div>

            <div class="v3-hud-status recording" id="v3-status">
              <span class="material-symbols-rounded" id="v3-status-icon">fiber_manual_record</span>
              <span id="v3-status-text">IN SESSION</span>
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
    this._cameraMode = 'WIDE';
    this._stepTimeout = null;
    this._mixers = {};
    this._actions = {};
    this._avatarModels = {};
    this._targetRotations = {
      JUDGE: 0,
      DEFENSE: 0.35,
      PROSECUTION: -0.35
    };
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
    this._renderer.toneMappingExposure = 0.92;
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

  // Generates authentic rich polished mahogany/teak wood texture
  _createWoodTexture(isDark = false) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Base deep mahogany wood color
    const baseColor = isDark ? '#2a1207' : '#3e1b0c';
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, 512, 512);

    // Natural wood grain wavy lines
    for (let y = 0; y < 512; y += 2) {
      const alpha = 0.15 + Math.sin(y * 0.04 + Math.sin(y * 0.012) * 3) * 0.1;
      ctx.fillStyle = (y % 4 === 0) ? `rgba(10, 4, 1, ${alpha})` : `rgba(88, 38, 16, ${alpha * 0.8})`;
      ctx.fillRect(0, y, 512, 2);
    }

    // Wood vertical plank paneling seams
    for (let x = 64; x < 512; x += 128) {
      ctx.fillStyle = 'rgba(8, 3, 1, 0.45)';
      ctx.fillRect(x, 0, 3, 512);
      ctx.fillStyle = 'rgba(110, 52, 22, 0.25)';
      ctx.fillRect(x + 3, 0, 1, 512);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 1);
    return tex;
  },

  /* ==================== 3. SCENE CONSTRUCTION ==================== */
  _buildEnvironment() {
    // === DARK COURTROOM ATMOSPHERE ===
    this._scene.background = new THREE.Color(0x060809);
    this._scene.fog = new THREE.FogExp2(0x060809, 0.008);

    // === BALANCED LIGHTING (Rich Wood Tones without Washout) ===

    // 1. Warm ambient fill light
    const ambient = new THREE.AmbientLight(0xffeedd, 0.22);
    this._scene.add(ambient);

    // 2. Hemisphere light (cool upper sky, warm hardwood reflections)
    const hemi = new THREE.HemisphereLight(0x8faab4, 0x3d2b1f, 0.25);
    hemi.position.set(0, 20, 0);
    this._scene.add(hemi);

    // 3. Overhead courtroom chandelier (focused warm directional)
    const mainLight = new THREE.DirectionalLight(0xfff4e8, 0.7);
    mainLight.position.set(0, 15, 6);
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

    this._spotLight = new THREE.SpotLight(0xffedd0, 0.85, 35, Math.PI / 6, 0.5, 1.2);
    this._spotLight.position.set(0, 12, 10);
    this._spotLight.target = this._spotLightTarget;
    this._spotLight.castShadow = true;
    this._scene.add(this._spotLight);

    // 5. Window accent light (subtle daylight from court windows)
    const windowLight = new THREE.DirectionalLight(0x6699cc, 0.22);
    windowLight.position.set(-10, 8, 0);
    this._scene.add(windowLight);

    // Create authentic wood textures
    const darkWoodTex = this._createWoodTexture(true);
    const warmWoodTex = this._createWoodTexture(false);

    // === COURTROOM FLOOR ===
    const floorGeo = new THREE.PlaneGeometry(40, 30);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x1a100a, // Dark polished courtroom parquet floor
      roughness: 0.65,
      metalness: 0.08
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.05;
    floor.receiveShadow = true;
    this._scene.add(floor);

    // === JUDGE'S BENCH (Rich Polished Mahogany & Teak Wood Desk) ===
    // 1. Main Bench Base with Wood Texture
    const benchGeo = new THREE.BoxGeometry(8.4, 2.0, 3.2);
    const benchMat = new THREE.MeshStandardMaterial({
      color: 0x4a2212, // Rich dark polished mahogany
      map: darkWoodTex,
      roughness: 0.38,
      metalness: 0.08
    });
    const bench = new THREE.Mesh(benchGeo, benchMat);
    bench.position.set(0, 1.0, -2);
    bench.castShadow = true;
    bench.receiveShadow = true;
    this._scene.add(bench);

    // 2. Bench Top Molding (Polished Teak Wood Counter Top)
    const benchTopGeo = new THREE.BoxGeometry(8.8, 0.16, 3.4);
    const benchTopMat = new THREE.MeshStandardMaterial({
      color: 0x5a2d16, // Polished rich wood counter
      map: warmWoodTex,
      roughness: 0.3,
      metalness: 0.1
    });
    const benchTop = new THREE.Mesh(benchTopGeo, benchTopMat);
    benchTop.position.set(0, 2.05, -2);
    benchTop.castShadow = true;
    benchTop.receiveShadow = true;
    this._scene.add(benchTop);

    // 3. Front Carved Wood Panels with Insets and Golden Molding
    const panelMat = new THREE.MeshStandardMaterial({
      color: 0x623018, // Warm carved wood accent
      map: warmWoodTex,
      roughness: 0.42,
      metalness: 0.05
    });
    const panelInnerMat = new THREE.MeshStandardMaterial({
      color: 0x1c0c05, // Dark recessed wood inlay
      roughness: 0.7
    });

    [-2.7, 0, 2.7].forEach((xOffset, i) => {
      const w = i === 1 ? 2.6 : 2.2;
      // Outer raised frame
      const p = new THREE.Mesh(new THREE.BoxGeometry(w, 1.4, 0.1), panelMat);
      p.position.set(xOffset, 1.1, -0.36);
      this._scene.add(p);
      // Inner recessed panel
      const pInner = new THREE.Mesh(new THREE.BoxGeometry(w - 0.25, 1.15, 0.08), panelInnerMat);
      pInner.position.set(xOffset, 1.1, -0.32);
      this._scene.add(pInner);
    });

    // 4. Executive Leather Desk Blotter Pad (Dark Forest Green with Gold Border)
    const blotter = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 0.02, 1.4),
      new THREE.MeshStandardMaterial({ color: 0x0f2b18, roughness: 0.75 })
    );
    blotter.position.set(0, 2.14, -1.2);
    this._scene.add(blotter);

    // 5. Wooden Gavel Sound Block & Gavel on Desk
    const soundBlock = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.34, 0.06, 24),
      new THREE.MeshStandardMaterial({ color: 0x542914, roughness: 0.38, metalness: 0.1 })
    );
    soundBlock.position.set(1.4, 2.16, -0.95);
    this._scene.add(soundBlock);

    const gavelHead = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, 0.26, 16),
      new THREE.MeshStandardMaterial({ color: 0x5a2d16, roughness: 0.35 })
    );
    gavelHead.rotation.z = Math.PI / 2;
    gavelHead.position.set(1.4, 2.22, -0.95);
    this._scene.add(gavelHead);

    const gavelHandle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.45, 12),
      new THREE.MeshStandardMaterial({ color: 0x482312, roughness: 0.4 })
    );
    gavelHandle.rotation.x = Math.PI / 2;
    gavelHandle.position.set(1.4, 2.22, -0.72);
    this._scene.add(gavelHandle);

    // 6. Legal Case Briefs / Law Books on Desk
    const book1 = new THREE.Mesh(
      new THREE.BoxGeometry(0.65, 0.1, 0.9),
      new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.5 }) // Red legal volume
    );
    book1.position.set(-2.5, 2.18, -1.1);
    this._scene.add(book1);

    const book2 = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.09, 0.85),
      new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.5 }) // Blue legal volume
    );
    book2.position.set(-2.5, 2.27, -1.1);
    this._scene.add(book2);

    // 7. Judge's Executive High-Back Chair (Visible seated frame behind judge)
    const chairBack = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 2.4, 0.28),
      new THREE.MeshStandardMaterial({ color: 0x140f0c, roughness: 0.55, metalness: 0.05 }) // Dark executive leather
    );
    chairBack.position.set(0, 2.1, -2.4);
    chairBack.castShadow = true;
    this._scene.add(chairBack);

    const chairHeadrest = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 0.5, 0.32),
      new THREE.MeshStandardMaterial({ color: 0x18120e, roughness: 0.5 })
    );
    chairHeadrest.position.set(0, 3.2, -2.4);
    this._scene.add(chairHeadrest);

    const chairFrame = new THREE.Mesh(
      new THREE.BoxGeometry(1.75, 2.6, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x482414, roughness: 0.4 }) // Mahogany wood frame
    );
    chairFrame.position.set(0, 2.2, -2.52);
    this._scene.add(chairFrame);

    // Ashoka Emblem (bronze gold medallion on court wall)
    const emblemGeo = new THREE.CircleGeometry(0.85, 32);
    const emblemMat = new THREE.MeshStandardMaterial({
      color: 0xc49b38,
      roughness: 0.35,
      metalness: 0.75,
      emissive: 0xc49b38,
      emissiveIntensity: 0.04
    });
    const emblem = new THREE.Mesh(emblemGeo, emblemMat);
    emblem.position.set(0, 5.2, -3.4);
    this._scene.add(emblem);

    // === ADVOCATE PODIUMS (Matching Dark Mahogany Wood) ===
    const podiumGeo = new THREE.BoxGeometry(2.5, 1.2, 1.5);
    const podiumMat = new THREE.MeshStandardMaterial({
      color: 0x4a2212, // Matching rich dark mahogany
      map: darkWoodTex,
      roughness: 0.38,
      metalness: 0.08
    });
    const podiumTopMat = new THREE.MeshStandardMaterial({
      color: 0x5a2d16,
      map: warmWoodTex,
      roughness: 0.3
    });

    [-4, 4].forEach(xPos => {
      const pod = new THREE.Mesh(podiumGeo, podiumMat.clone());
      pod.position.set(xPos, 0.6, 1);
      pod.castShadow = true;
      pod.receiveShadow = true;
      this._scene.add(pod);

      // Angled document reading slope
      const topSlope = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.06, 1.2), podiumTopMat.clone());
      topSlope.position.set(xPos, 1.25, 0.95);
      topSlope.rotation.x = -0.18; // Angled toward advocate
      this._scene.add(topSlope);

      // Legal papers sheet
      const papers = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.02, 0.6),
        new THREE.MeshStandardMaterial({ color: 0xf4eedb, roughness: 0.8 })
      );
      papers.position.set(xPos - 0.3, 1.28, 0.95);
      papers.rotation.x = -0.18;
      this._scene.add(papers);

      // Advocate microphone stand
      const micBase = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.08, 0.04, 16),
        new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.2 })
      );
      micBase.position.set(xPos + 0.6, 1.28, 0.7);
      this._scene.add(micBase);

      const micStem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015, 0.015, 0.35, 8),
        new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.9, roughness: 0.2 })
      );
      micStem.position.set(xPos + 0.6, 1.45, 0.75);
      micStem.rotation.x = 0.25;
      this._scene.add(micStem);
    });

    // === COURTROOM RAILING (Polished Mahogany Wood Bar) ===
    const railGeo = new THREE.BoxGeometry(20, 0.12, 0.18);
    const railMat = new THREE.MeshStandardMaterial({
      color: 0x5a2d16, // Polished mahogany bar
      map: warmWoodTex,
      roughness: 0.32,
      metalness: 0.08
    });
    const rail = new THREE.Mesh(railGeo, railMat);
    rail.position.set(0, 1.1, 4);
    this._scene.add(rail);

    // Rail Posts
    for (let x = -10; x <= 10; x += 2.5) {
      const postGeo = new THREE.CylinderGeometry(0.065, 0.065, 1.1, 12);
      const post = new THREE.Mesh(postGeo, railMat.clone());
      post.position.set(x, 0.55, 4);
      this._scene.add(post);
    }

    // === BACK WALL & WOOD WAINSCOTING ===
    const wallGeo = new THREE.PlaneGeometry(40, 15);
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x140e0a,
      roughness: 0.9,
      metalness: 0
    });
    const backWall = new THREE.Mesh(wallGeo, wallMat);
    backWall.position.set(0, 7, -3.5);
    this._scene.add(backWall);

    // Dark mahogany wood wainscot paneling on lower back wall
    const wainscotGeo = new THREE.PlaneGeometry(40, 5);
    const wainscotMat = new THREE.MeshStandardMaterial({
      color: 0x3d1b0c,
      map: darkWoodTex,
      roughness: 0.45
    });
    const wainscot = new THREE.Mesh(wainscotGeo, wainscotMat);
    wainscot.position.set(0, 2.5, -3.48);
    this._scene.add(wainscot);

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

    // === 3D NAMEPLATE LABELS (HTML labels via 3D positioned objects — glow indicators) ===
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
    // Judge: rotY = 0 (Faces forward toward courtroom, lawyers, and audience)
    this._loadAvatar(this.AVATAR_FILES.JUDGE, 'JUDGE', 2.5, 0, 0);
    // Defense: rotY = 0.35 (Faces courtroom/judge, dynamically swivels to 0.85 for Judge and 1.42 for Opponent)
    this._loadAvatar(this.AVATAR_FILES.DEFENSE, 'DEFENSE', 2.5, 0.35, 0);
    // Prosecution: rotY = -0.35 (Faces courtroom/judge, dynamically swivels to -0.85 for Judge and -1.42 for Opponent)
    this._loadAvatar(this.AVATAR_FILES.PROSECUTION, 'PROSECUTION', 2.5, -0.35, 0);
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

      // Store model reference for dynamic rotation swivel
      this._avatarModels[actorKey] = model;

      // Enable shadows AND apply realistic skin tones + black court dress
      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;

          if (child.material) {
            const mat = child.material.clone();
            const name = (child.name || '').toLowerCase();

            if (name.includes('head')) {
              // Natural warm human skin tone
              mat.color = new THREE.Color(0xdca88c);
              mat.roughness = 0.65;
              mat.metalness = 0.0;
            } else if (name.includes('eyeball') || name.includes('cornea')) {
              // Natural white sclera with dark iris
              mat.color = new THREE.Color(0xf2f2f2);
              mat.roughness = 0.2;
            } else if (name.includes('eyelash') || name.includes('hair')) {
              // Dark brown/black hair and eyelashes
              mat.color = new THREE.Color(0x1a1412);
              mat.roughness = 0.85;
            } else if (name.includes('teeth')) {
              mat.color = new THREE.Color(0xeee9dd);
            } else if (name.includes('body')) {
              // Neck and hands
              mat.color = new THREE.Color(0xdca88c);
              mat.roughness = 0.65;
            } else {
              // Professional attire
              if (actorKey === 'JUDGE') {
                // Judge black judicial robe
                mat.color = new THREE.Color(0x0e0e12);
                mat.roughness = 0.82;
                mat.metalness = 0.02;
              } else {
                // Advocate black coat & trousers
                mat.color = new THREE.Color(0x131318);
                mat.roughness = 0.78;
                mat.metalness = 0.04;
              }
            }
            child.material = mat;
          }
        }
      });

      // Per-avatar warm fill light (soft, non-overexposing)
      const avatarLight = new THREE.PointLight(
        actorKey === 'JUDGE' ? 0xffe8d0 : 0xffffff,
        0.28, 10
      );
      avatarLight.position.set(coord.x, coord.y + 3.8, coord.z + 2.0);
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

    // Update all avatar animation mixers
    if (this._clock) {
      const delta = this._clock.getDelta();
      Object.values(this._mixers).forEach(mixer => mixer.update(delta));
    }

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

    // 4. Smoothly swivel lawyers toward dynamic targets (Judge vs Opponent)
    if (this._avatarModels.DEFENSE) {
      this._avatarModels.DEFENSE.rotation.y = THREE.MathUtils.lerp(
        this._avatarModels.DEFENSE.rotation.y,
        this._targetRotations.DEFENSE,
        0.045
      );
    }
    if (this._avatarModels.PROSECUTION) {
      this._avatarModels.PROSECUTION.rotation.y = THREE.MathUtils.lerp(
        this._avatarModels.PROSECUTION.rotation.y,
        this._targetRotations.PROSECUTION,
        0.045
      );
    }

    // Render
    if (this._renderer && this._scene && this._camera) {
      this._renderer.render(this._scene, this._camera);
    }
  },

  /* ==================== 6. ORCHESTRATION & CONTROLS ==================== */
  setCamera(presetId, isUserAction = false) {
    const preset = this.CAMERAS[presetId];
    if (!preset) return;

    if (isUserAction) {
      this._cameraMode = presetId;
    }

    this._cameraPos.set(...preset.pos);
    this._cameraTarget.set(...preset.target);

    // Update UI active buttons
    document.querySelectorAll('.v3-cam-btn').forEach(b => b.classList.remove('active'));
    const btnMap = {
      WIDE: 'v3-cam-wide',
      JUDGE: 'v3-cam-judge',
      DEFENSE: 'v3-cam-defense',
      PROSECUTION: 'v3-cam-pros'
    };
    const targetBtnId = btnMap[presetId];
    if (targetBtnId) {
      const el = document.getElementById(targetBtnId);
      if (el) el.classList.add('active');
    }
  },

  togglePause() {
    if (!this._isPlaying) return;
    this._isPaused = !this._isPaused;

    const pauseBtn = document.getElementById('v3-pause-btn');
    const pauseIcon = document.getElementById('v3-pause-icon');
    const pauseText = document.getElementById('v3-pause-text');
    const statusEl = document.getElementById('v3-status');
    const statusIcon = document.getElementById('v3-status-icon');
    const statusText = document.getElementById('v3-status-text');
    const subContainer = document.getElementById('v3-subtitle');

    if (this._isPaused) {
      // 1. Cancel speech cleanly
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      // 2. Clear any pending step advance timer
      if (this._stepTimeout) {
        clearTimeout(this._stepTimeout);
        this._stepTimeout = null;
      }
      // 3. Pause all active avatar animations
      Object.values(this._actions).forEach(action => { action.paused = true; });

      // 4. Update UI to PAUSED state
      if (pauseBtn) pauseBtn.classList.add('v3-btn-paused');
      if (pauseIcon) pauseIcon.innerText = 'play_arrow';
      if (pauseText) pauseText.innerText = 'RESUME';

      if (statusEl) {
        statusEl.classList.remove('recording');
        statusEl.classList.add('paused');
      }
      if (statusIcon) statusIcon.innerText = 'pause_circle';
      if (statusText) statusText.innerText = 'PAUSED';

      if (subContainer) subContainer.classList.add('paused');
    } else {
      // RESUME
      if (pauseBtn) pauseBtn.classList.remove('v3-btn-paused');
      if (pauseIcon) pauseIcon.innerText = 'pause';
      if (pauseText) pauseText.innerText = 'PAUSE';

      if (statusEl) {
        statusEl.classList.remove('paused');
        statusEl.classList.add('recording');
      }
      if (statusIcon) statusIcon.innerText = 'fiber_manual_record';
      if (statusText) statusText.innerText = 'IN SESSION';

      if (subContainer) subContainer.classList.remove('paused');

      // Unpause active speaker avatar
      if (this._activeSpeakerId && this._actions[this._activeSpeakerId]) {
        this._actions[this._activeSpeakerId].paused = false;
      }

      // Resume playback from current step
      this._resumeCurrentStep();
    }
  },

  _resumeCurrentStep() {
    if (!this._isPlaying || this._isPaused) return;
    if (this._currentStep >= this._script.length) {
      this._endSimulation();
      return;
    }

    const step = this._script[this._currentStep];
    this._activeSpeakerId = step.actor;

    // Dynamic lawyer facing for current step
    if (step.facing) {
      if (step.facing.DEFENSE !== undefined) this._targetRotations.DEFENSE = step.facing.DEFENSE;
      if (step.facing.PROSECUTION !== undefined) this._targetRotations.PROSECUTION = step.facing.PROSECUTION;
    }

    if (this._actions[step.actor]) {
      this._actions[step.actor].paused = false;
    }

    const subContainer = document.getElementById('v3-subtitle');
    const speakerTextEl = document.getElementById('v3-speaker-text');
    const textEl = document.getElementById('v3-subtitle-text');

    if (speakerTextEl) speakerTextEl.innerText = step.name;
    if (textEl) textEl.innerText = step.text;
    if (subContainer) subContainer.classList.add('active');

    this._speakText(step.text, step.pitch, step.rate, () => {
      if (this._isPaused) return;
      if (subContainer) subContainer.classList.remove('active');
      this._activeSpeakerId = null;

      Object.values(this._actions).forEach(action => { action.paused = true; });

      this._currentStep++;
      this._stepTimeout = setTimeout(() => this._playNextStep(), 1200);
    });
  },

  _playNextStep() {
    if (!this._isPlaying || this._isPaused) return;
    if (this._currentStep >= this._script.length) {
      this._endSimulation();
      return;
    }

    const step = this._script[this._currentStep];
    this._activeSpeakerId = step.actor;

    // 1. Dynamic Lawyer Orientation based on who is being addressed
    if (step.facing) {
      if (step.facing.DEFENSE !== undefined) {
        this._targetRotations.DEFENSE = step.facing.DEFENSE;
      }
      if (step.facing.PROSECUTION !== undefined) {
        this._targetRotations.PROSECUTION = step.facing.PROSECUTION;
      }
    }

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
      if (this._isPaused) return; // Do not advance if user paused while speaking
      if (subContainer) subContainer.classList.remove('active');
      this._activeSpeakerId = null;

      // Pause all avatars
      Object.values(this._actions).forEach(action => { action.paused = true; });

      this._currentStep++;
      this._stepTimeout = setTimeout(() => this._playNextStep(), 1200);
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
      const actorIdx = { JUDGE: 0, DEFENSE: 1, PROSECUTION: 2 };
      const idx = actorIdx[actorKey] || 0;
      return enVoices[idx % enVoices.length];
    }

    return null;
  },

  _speakText(text, pitch, rate, onEnd) {
    if (!window.speechSynthesis) {
      this._stepTimeout = setTimeout(onEnd, 3500);
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.pitch = pitch;
    utterance.rate = rate;

    // Assign distinct voice per actor
    const actorKey = this._activeSpeakerId;
    const voice = this._findVoice(actorKey);
    if (voice) {
      utterance.voice = voice;
    } else {
      const pref = this._voicePrefs[actorKey];
      if (pref) utterance.pitch = pref.fallbackPitch;
    }

    utterance.onend = () => { onEnd(); };
    utterance.onerror = () => { onEnd(); };

    window.speechSynthesis.speak(utterance);
  },

  _endSimulation() {
    this.setCamera('WIDE');
    this._playGavelSound();

    const statusEl = document.getElementById('v3-status');
    const statusText = document.getElementById('v3-status-text');
    if (statusEl) {
      if (statusText) statusText.innerText = 'COURT ADJOURNED';
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
    if (this._stepTimeout) {
      clearTimeout(this._stepTimeout);
      this._stepTimeout = null;
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
    this._avatarModels = {};
    this._speakerRings = {};
  }
};
