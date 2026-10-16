/* ═══════════════════════════════════════════════════════════════════════
   BACKEND — 3D Digital Dustbin Twin Engine (Three.js)
   ═══════════════════════════════════════════════════════════════════════
   Merged from app.py:
   • 4-Compartment Smart Bin 3D Digital Twin
   • Animated Hinged Lids & Photorealistic Cylindrical Bins
   • Dynamic 3D Waste Item with Photo/Texture Mapping
   • Computer Vision X-Ray Laser Inspection & Wireframe Scanning
   • Correct Sorting: Green Emissive Pulse + 3D Particle Celebration
   • Wrong Sorting: Red Buzzer Vibration + Auto-Ejection + Parabolic Re-Routing
   • Orbit Drag-to-Rotate Camera & Dynamic Cinematic Zoom
   • Full Bidirectional Sync with Application State & Backend Data Store
   ═══════════════════════════════════════════════════════════════════════ */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.BinTwin3D = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  // Bin Configuration matching app.py
  const CATEGORIES = [
    { key: 'wet', label: 'Wet Waste', color: 0x3fa34d, hex: '#3fa34d', bag: 'Green', dest: 'Compost Facility' },
    { key: 'dry', label: 'Dry Recyclable', color: 0x3b82c4, hex: '#3b82c4', bag: 'Blue', dest: 'Recycling Yard' },
    { key: 'hazardous', label: 'Hazardous', color: 0xd64545, hex: '#d64545', bag: 'Red', dest: 'Safe Disposal' },
    { key: 'nonrecyclable', label: 'Non-Recyclable', color: 0x6b7280, hex: '#6b7280', bag: 'Black', dest: 'Landfill' }
  ];

  const XS = [-4.5, -1.5, 1.5, 4.5];
  const START_POS = { x: 0, y: 5.0, z: 5.5 };

  // Easing Utilities
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const easeIO = u => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
  const easeOut = u => 1 - Math.pow(1 - u, 3);
  const easeIn = u => u * u * u;
  const lerp = (a, b, k) => a + (b - a) * k;

  let containerEl = null;
  let renderer = null;
  let scene = null;
  let camera = null;
  let worldGroup = null;
  let animFrameId = null;

  // 3D Objects
  const bins = [];
  let wasteItem = null;
  let wasteItemMesh = null;
  let wireframeBox = null;
  let laserScanner = null;
  let scanPlane = null;
  let scanRing = null;
  let trailMesh = null;
  let particlePoints = null;
  let particlePositions = null;
  let particleVelocities = [];
  const PARTICLE_COUNT = 75;

  // Interaction State
  let isDragging = false;
  let lastPointerX = 0;
  let isDropping = false;
  let dropStartTime = 0;
  let activeDropConfig = null;
  let selectedCompartment = 0; // Default: Wet
  let currentWasteImage = null;
  let lastDropPayload = null;

  // Callbacks
  let onStatusChange = null;
  let onDropFinished = null;

  /**
   * Create dynamic text label sprite for 3D bin
   */
  function createLabelSprite(text, bagText, hexColor) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 160;
    const ctx = canvas.getContext('2d');

    // Rounded background pill
    ctx.fillStyle = 'rgba(12, 22, 38, 0.92)';
    ctx.strokeStyle = '#' + hexColor.toString(16).padStart(6, '0');
    ctx.lineWidth = 6;
    
    // Draw rounded rect
    const r = 24;
    ctx.beginPath();
    ctx.moveTo(r, 6);
    ctx.lineTo(512 - r, 6);
    ctx.quadraticCurveTo(512 - 6, 6, 512 - 6, r);
    ctx.lineTo(512 - 6, 160 - r);
    ctx.quadraticCurveTo(512 - 6, 160 - 6, 512 - r, 160 - 6);
    ctx.lineTo(r, 160 - 6);
    ctx.quadraticCurveTo(6, 160 - 6, 6, 160 - r);
    ctx.lineTo(6, r);
    ctx.quadraticCurveTo(6, 6, r, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Category title
    ctx.font = 'bold 42px Montserrat, Arial, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text.toUpperCase(), 256, 60);

    // Subtitle / Bag destination
    ctx.font = '600 24px Montserrat, Arial, sans-serif';
    ctx.fillStyle = '#' + hexColor.toString(16).padStart(6, '0');
    ctx.fillText(bagText.toUpperCase(), 256, 115);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
    sprite.scale.set(3.4, 1.05, 1);
    return sprite;
  }

  /**
   * Build 3D Scene Geometry
   */
  function buildScene() {
    // 1. Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.78);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffffff, 0.95);
    sun.position.set(6, 12, 8);
    scene.add(sun);

    const blueRim = new THREE.DirectionalLight(0x38bdf8, 0.4);
    blueRim.position.set(-8, 5, -6);
    scene.add(blueRim);

    // 2. World Root Group (orbit rotated)
    worldGroup = new THREE.Group();
    scene.add(worldGroup);

    // 3. Ground & Grid
    const groundGeo = new THREE.PlaneGeometry(46, 26);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x0a1424, roughness: 0.92, metalness: 0.1 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    worldGroup.add(ground);

    const grid = new THREE.GridHelper(46, 46, 0xc9a24b, 0x1a2e4a);
    grid.position.y = 0.01;
    grid.material.transparent = true;
    grid.material.opacity = 0.32;
    worldGroup.add(grid);

    // 4. The 4 Compartment Bins
    bins.length = 0;
    CATEGORIES.forEach((cat, i) => {
      const group = new THREE.Group();
      group.position.set(XS[i], 0, 0);

      // Bin Body Material
      const bodyMat = new THREE.MeshStandardMaterial({
        color: cat.color,
        roughness: 0.45,
        metalness: 0.18,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.65,
        emissive: cat.color,
        emissiveIntensity: 0.08,
        depthWrite: false
      });

      // Bin Body (tapered cylinder open at top)
      const body = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 0.8, 2.1, 36, 1, true), bodyMat);
      body.position.y = 1.05;
      group.add(body);

      // Bottom plate
      const botMat = new THREE.MeshStandardMaterial({ color: cat.color, roughness: 0.5 });
      const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.8, 36), botMat);
      bottom.rotation.x = -Math.PI / 2;
      bottom.position.y = 0.02;
      group.add(bottom);

      // Dark Metallic Upper Rim
      const rimMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.35, metalness: 0.6 });
      const rim = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.07, 10, 36), rimMat);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 2.1;
      group.add(rim);

      // Hinged Lid Pivot
      const lidPivot = new THREE.Group();
      lidPivot.position.set(0, 2.12, -0.98);

      const lidMat = new THREE.MeshStandardMaterial({
        color: cat.color,
        roughness: 0.4,
        metalness: 0.25,
        emissive: cat.color,
        emissiveIntensity: 0.1
      });
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(1.06, 1.06, 0.14, 36), lidMat);
      lid.position.set(0, 0.07, 0.98); // offset relative to hinge pivot
      lidPivot.add(lid);

      // Lid Handle
      const handleMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.2, metalness: 0.8 });
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.035, 8, 18, Math.PI), handleMat);
      handle.position.set(0, 0.18, 1.25);
      handle.rotation.x = -Math.PI;
      lidPivot.add(handle);

      group.add(lidPivot);

      // Soft Ground Drop-Shadow
      const shadow = new THREE.Mesh(
        new THREE.CircleGeometry(1.45, 32),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.42 })
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = 0.015;
      group.add(shadow);

      // Floating 3D Label
      const label = createLabelSprite(cat.label, cat.bag + ' Bag', cat.color);
      label.position.set(0, 3.55, 0);
      group.add(label);

      worldGroup.add(group);

      bins.push({
        cat,
        group,
        body,
        bodyMat,
        lidPivot,
        lidMat,
        label,
        baseX: XS[i]
      });
    });

    // 5. 3D Waste Item Group
    wasteItem = new THREE.Group();
    wasteItem.position.set(START_POS.x, START_POS.y, START_POS.z);
    wasteItem.visible = false;
    worldGroup.add(wasteItem);

    const boxGeo = new THREE.BoxGeometry(0.95, 0.95, 0.95);
    const boxMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.6,
      metalness: 0.1
    });
    wasteItemMesh = new THREE.Mesh(boxGeo, boxMat);
    wasteItem.add(wasteItemMesh);

    // Cyan wireframe bounding box
    const wireGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.22, 1.22, 1.22));
    const wireMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 2 });
    wireframeBox = new THREE.LineSegments(wireGeo, wireMat);
    wireframeBox.visible = false;
    wasteItem.add(wireframeBox);

    // 6. Laser Scanner (sweep plane + glowing ring)
    laserScanner = new THREE.Group();
    laserScanner.visible = false;
    worldGroup.add(laserScanner);

    const planeGeo = new THREE.PlaneGeometry(2.35, 2.35);
    const planeMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide
    });
    scanPlane = new THREE.Mesh(planeGeo, planeMat);
    scanPlane.rotation.x = -Math.PI / 2;
    laserScanner.add(scanPlane);

    const ringGeo = new THREE.TorusGeometry(1.08, 0.04, 10, 48);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.95 });
    scanRing = new THREE.Mesh(ringGeo, ringMat);
    scanRing.rotation.x = Math.PI / 2;
    laserScanner.add(scanRing);

    // 7. Particle Celebration System
    const pGeo = new THREE.BufferGeometry();
    particlePositions = new Float32Array(PARTICLE_COUNT * 3);
    particleVelocities = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particlePositions[i * 3] = 0;
      particlePositions[i * 3 + 1] = 0;
      particlePositions[i * 3 + 2] = 0;

      const angle = Math.random() * Math.PI * 2;
      const speed = 1.2 + Math.random() * 2.8;
      particleVelocities.push({
        vx: Math.cos(angle) * speed,
        vy: 2.5 + Math.random() * 3.5,
        vz: Math.sin(angle) * speed
      });
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const pMat = new THREE.PointsMaterial({
      color: 0x4ade80,
      size: 0.16,
      transparent: true,
      opacity: 0.0
    });
    particlePoints = new THREE.Points(pGeo, pMat);
    particlePoints.visible = false;
    particlePoints.frustumCulled = false;
    worldGroup.add(particlePoints);
  }

  /**
   * Set up Camera & Orbit Controls
   */
  function setupCameraAndControls() {
    const width = containerEl.clientWidth || 800;
    const height = containerEl.clientHeight || 520;

    camera = new THREE.PerspectiveCamera(44, width / height, 0.1, 100);
    camera.position.set(0, 6.6, 14.2);
    camera.lookAt(0, 1.4, 0);

    // Pointer Drag to Orbit World
    containerEl.addEventListener('pointerdown', e => {
      isDragging = true;
      lastPointerX = e.clientX;
      containerEl.style.cursor = 'grabbing';
    });

    window.addEventListener('pointerup', () => {
      isDragging = false;
      if (containerEl) containerEl.style.cursor = 'grab';
    });

    window.addEventListener('pointermove', e => {
      if (!isDragging || !worldGroup) return;
      const delta = e.clientX - lastPointerX;
      lastPointerX = e.clientX;
      worldGroup.rotation.y = clamp(worldGroup.rotation.y + delta * 0.005, -0.65, 0.65);
    });

    // Resize Observer
    const ro = new ResizeObserver(() => handleResize());
    ro.observe(containerEl);
  }

  function handleResize() {
    if (!renderer || !camera || !containerEl) return;
    const w = containerEl.clientWidth || 800;
    const h = containerEl.clientHeight || 520;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  /**
   * Dynamic Camera Pan
   */
  function updateCameraFocus(progress, targetX) {
    if (!camera) return;
    // Zoom in toward active bin during drop & scan, then pull back
    const zoomProgress = easeIO(clamp(seg(progress, 0.2, 0.45) - seg(progress, 0.75, 0.95)));
    const targetCamX = lerp(0, targetX * 0.65, zoomProgress);
    const targetCamY = lerp(6.6, 4.8, zoomProgress);
    const targetCamZ = lerp(14.2, 9.6, zoomProgress);

    camera.position.set(targetCamX, targetCamY, targetCamZ);
    camera.lookAt(lerp(0, targetX * 0.85, zoomProgress), lerp(1.4, 1.25, zoomProgress), 0);
  }

  /**
   * Reset All Bins to Default State
   */
  function resetBinsState() {
    bins.forEach((b, i) => {
      b.group.position.x = b.baseX;
      b.lidPivot.rotation.x = 0;
      b.bodyMat.opacity = 0.65;
      b.bodyMat.emissive.setHex(b.cat.color);
      b.bodyMat.emissiveIntensity = 0.08;
    });

    if (wireframeBox) wireframeBox.visible = false;
    if (laserScanner) laserScanner.visible = false;
    if (particlePoints) particlePoints.visible = false;
    if (trailMesh) {
      worldGroup.remove(trailMesh);
      trailMesh = null;
    }
  }

  /**
   * Trigger Particle Burst
   */
  function triggerParticleBurst(x, y, hexColor, elapsed) {
    if (!particlePoints) return;
    particlePoints.visible = true;
    particlePoints.material.color.setHex(hexColor);
    particlePoints.material.opacity = Math.max(0, 1 - elapsed / 1.5);

    const positions = particlePositions;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const v = particleVelocities[i];
      positions[i * 3] = x + v.vx * elapsed;
      positions[i * 3 + 1] = y + v.vy * elapsed - 4.2 * elapsed * elapsed;
      positions[i * 3 + 2] = v.vz * elapsed;
    }
    particlePoints.geometry.attributes.position.needsUpdate = true;
  }

  /**
   * Build Parabolic 3D Curve Trail for Wrong Sort Re-Routing
   */
  function buildTrajectoryTrail(x1, x2) {
    if (trailMesh) worldGroup.remove(trailMesh);

    const points = [];
    const steps = 40;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const x = lerp(x1, x2, u);
      const y = 3.6 + Math.sin(Math.PI * u) * 2.2;
      const z = 0.1;
      points.push(new THREE.Vector3(x, y, z));
    }

    const curveGeo = new THREE.BufferGeometry().setFromPoints(points);
    const curveMat = new THREE.LineDashedMaterial({
      color: 0xf59e0b,
      dashSize: 0.35,
      gapSize: 0.18,
      linewidth: 3
    });
    trailMesh = new THREE.Line(curveGeo, curveMat);
    trailMesh.computeLineDistances();
    worldGroup.add(trailMesh);
  }

  /**
   * Main Animation Loop (Runs 60 FPS)
   */
  function renderLoop(timestamp) {
    animFrameId = requestAnimationFrame(renderLoop);

    const timeSec = timestamp / 1000;

    if (isDropping && activeDropConfig) {
      executeDropTimeline(timeSec - dropStartTime);
    } else {
      executeIdleAnimation(timeSec);
    }

    if (renderer && scene && camera) {
      renderer.render(scene, camera);
    }
  }

  /**
   * Idle State Animation (Gentle breathing & selection glow)
   */
  function executeIdleAnimation(t) {
    resetBinsState();

    // Subtle breathing on selected compartment
    if (bins[selectedCompartment]) {
      const selBin = bins[selectedCompartment];
      selBin.lidPivot.rotation.x = -0.35 - 0.08 * Math.sin(t * 3.2);
      selBin.bodyMat.emissiveIntensity = 0.22 + 0.14 * Math.sin(t * 3.2);
    }

    // Waste item floating above ready
    if (wasteItem) {
      wasteItem.visible = true;
      wasteItem.position.set(START_POS.x, START_POS.y + Math.sin(t * 2.4) * 0.16, START_POS.z);
      wasteItem.scale.setScalar(1.0);
      wasteItem.rotation.set(0.32, t * 0.9, 0);
    }

    updateCameraFocus(0, XS[selectedCompartment]);
  }

  /**
   * Timeline Sequence for 3D Waste Drop
   */
  function executeDropTimeline(t) {
    const cfg = activeDropConfig;
    const D = cfg.declaredIdx;
    const S = cfg.seenIdx;
    const isWrong = !cfg.isCorrect;

    // Timeline Landmarks (in seconds)
    const T_DROP_START = 0.4;
    const T_LAND_CHOSEN = 2.4;
    const T_LID_CLOSE = 2.9;
    const T_SCAN_START = 3.0;
    const T_SCAN_END = 5.8;
    const T_VERDICT = 6.0;

    // Wrong sort extended sequence
    const T_EJECT_START = 7.4;
    const T_TRANSFER_END = 9.8;
    const T_LAND_CORRECT = 10.6;
    const T_TOTAL_END = isWrong ? 12.2 : 7.8;

    resetBinsState();

    // ─── 1. Lid Open/Close Mechanics ───
    if (t < T_LID_CLOSE) {
      // Open declared bin lid
      const openU = t < 1.4 ? easeOut(seg(t, T_DROP_START, 1.2)) : 1 - seg(t, 2.2, T_LID_CLOSE);
      bins[D].lidPivot.rotation.x = -1.9 * openU;
    } else if (isWrong && t >= T_EJECT_START && t < 8.8) {
      // Re-open declared bin lid to eject item
      const ejectU = t < 8.1 ? easeOut(seg(t, T_EJECT_START, 8.0)) : 1 - seg(t, 8.4, 8.8);
      bins[D].lidPivot.rotation.x = -1.9 * ejectU;
    }

    if (isWrong && t >= 8.6 && t < 11.2) {
      // Open correct bin lid to catch re-routed item
      const catchU = t < 9.6 ? easeOut(seg(t, 8.8, 9.4)) : 1 - seg(t, 10.6, 11.1);
      bins[S].lidPivot.rotation.x = -1.9 * catchU;
    }

    // ─── 2. Waste Item Trajectory ───
    const itemPos = new THREE.Vector3();
    let scale = 1.0;
    let spin = true;

    if (t < 0.6) {
      // Ready position
      itemPos.set(START_POS.x, START_POS.y, START_POS.z);
    } else if (t < 1.9) {
      // Arc toward declared bin opening
      const u = easeIO(seg(t, 0.6, 1.9));
      itemPos.lerpVectors(new THREE.Vector3(START_POS.x, START_POS.y, START_POS.z), new THREE.Vector3(XS[D], 3.4, 0), u);
      itemPos.y += Math.sin(Math.PI * u) * 1.5;
    } else if (t < T_LAND_CHOSEN) {
      // Drop inside declared bin
      const u = seg(t, 1.9, T_LAND_CHOSEN);
      itemPos.lerpVectors(new THREE.Vector3(XS[D], 3.4, 0), new THREE.Vector3(XS[D], 1.1, 0), u * u);
      scale = 1 - 0.15 * u;
      spin = false;
    } else if (!isWrong || t < T_EJECT_START) {
      // Resting inside declared bin during CV scan
      itemPos.set(XS[D], 1.05 + Math.sin(t * 3.5) * 0.04, 0);
      scale = 0.85;
      spin = false;
    } else if (t < 8.4) {
      // Wrong Sort: Ejected upward out of bin
      const u = easeIO(seg(t, T_EJECT_START, 8.4));
      itemPos.lerpVectors(new THREE.Vector3(XS[D], 1.1, 0), new THREE.Vector3(XS[D], 3.5, 0), u);
      scale = lerp(0.85, 1.0, u);
      spin = true;
    } else if (t < T_TRANSFER_END) {
      // Parabolic flight across to correct compartment
      const u = easeIO(seg(t, 8.4, T_TRANSFER_END));
      itemPos.lerpVectors(new THREE.Vector3(XS[D], 3.5, 0), new THREE.Vector3(XS[S], 3.5, 0), u);
      itemPos.y += Math.sin(Math.PI * u) * 1.8;
      spin = true;
    } else if (t < T_LAND_CORRECT) {
      // Drop inside correct bin
      const u = seg(t, T_TRANSFER_END, T_LAND_CORRECT);
      itemPos.lerpVectors(new THREE.Vector3(XS[S], 3.5, 0), new THREE.Vector3(XS[S], 1.1, 0), u * u);
      scale = 1 - 0.15 * u;
      spin = false;
    } else {
      // Settled in correct compartment
      itemPos.set(XS[S], 1.05, 0);
      scale = 0.85;
      spin = false;
    }

    wasteItem.visible = true;
    wasteItem.position.copy(itemPos);
    wasteItem.scale.setScalar(scale);
    wasteItem.rotation.set(spin ? t * 2.2 : 0.25, spin ? t * 2.8 : t * 0.4, 0);

    // ─── 3. CV Optical Scanning Phase (Laser + X-Ray) ───
    const isScanning = t >= T_SCAN_START && t <= T_SCAN_END;
    if (isScanning) {
      // X-Ray transparency on declared bin
      bins[D].bodyMat.opacity = 0.22;

      // Laser scanner sweeps through bin vertically
      laserScanner.visible = true;
      const sweepK = (t - T_SCAN_START) / (T_SCAN_END - T_SCAN_START);
      const sweepY = 0.25 + 1.85 * (0.5 + 0.5 * Math.sin(sweepK * Math.PI * 5 - Math.PI / 2));
      laserScanner.position.set(XS[D], sweepY, 0);

      // Wireframe pulse
      wireframeBox.visible = true;
      wireframeBox.scale.setScalar(1 + 0.06 * Math.sin(t * 12));
    } else {
      laserScanner.visible = false;
      wireframeBox.visible = false;
    }

    // ─── 4. Verdict Effects & Re-Routing ───
    if (t >= T_VERDICT) {
      const dtVerdict = t - T_VERDICT;

      if (!isWrong) {
        // Correct Sort: Bin pulses green + Particle celebration
        bins[D].bodyMat.emissive.setHex(0x22c55e);
        bins[D].bodyMat.emissiveIntensity = 0.9 * Math.exp(-dtVerdict * 1.2);
        triggerParticleBurst(XS[D], 2.2, 0x22c55e, dtVerdict);
      } else {
        // Wrong Sort: Red buzzer vibration
        if (dtVerdict < 1.4) {
          bins[D].bodyMat.emissive.setHex(0xef4444);
          bins[D].bodyMat.emissiveIntensity = 0.95 * Math.abs(Math.sin(dtVerdict * 8));
          bins[D].group.position.x = XS[D] + Math.sin(dtVerdict * 48) * 0.08 * (1 - dtVerdict / 1.4);
        }

        // Show Parabolic Trajectory
        if (t >= 8.2 && t <= T_LAND_CORRECT && !trailMesh) {
          buildTrajectoryTrail(XS[D], XS[S]);
        }

        // Correct bin celebration upon arrival
        if (t >= T_LAND_CORRECT) {
          const dtCorrect = t - T_LAND_CORRECT;
          bins[S].bodyMat.emissive.setHex(0x22c55e);
          bins[S].bodyMat.emissiveIntensity = 0.9 * Math.exp(-dtCorrect * 1.2);
          triggerParticleBurst(XS[S], 2.2, 0x22c55e, dtCorrect);
        }
      }
    }

    // ─── 5. Dynamic Camera Focus ───
    const focusTargetX = isWrong && t >= 8.4 ? XS[S] : XS[D];
    const cameraProgress = t / T_TOTAL_END;
    updateCameraFocus(cameraProgress, focusTargetX);

    // ─── 6. Real-time Status Dispatcher ───
    if (onStatusChange) {
      if (t < 1.2) {
        onStatusChange(`🗑️ Dropping item into ${CATEGORIES[D].label}...`, 'info');
      } else if (t < T_SCAN_START) {
        onStatusChange('🔒 Lid closed. Engaging Computer Vision scanner...', 'info');
      } else if (t < T_SCAN_END) {
        const pct = Math.round(seg(t, T_SCAN_START, T_SCAN_END) * 100);
        onStatusChange(`👁️ CV multi-spectral optical scan: ${pct}%`, 'scanning');
      } else if (!isWrong) {
        onStatusChange(`✅ Correct sorting! Classified as ${CATEGORIES[S].label}`, 'success');
      } else if (t < 8.4) {
        onStatusChange(`⚠️ Wrong compartment! CV detected ${CATEGORIES[S].label}, not ${CATEGORIES[D].label}.`, 'warning');
      } else if (t < T_LAND_CORRECT) {
        onStatusChange(`🔄 Auto-Ejecting: Re-routing to ${CATEGORIES[S].label} (${CATEGORIES[S].bag} Bag)...`, 'reroute');
      } else {
        onStatusChange(`♻️ Successfully re-routed into ${CATEGORIES[S].label}!`, 'success');
      }
    }

    // ─── 7. Completion Check ───
    if (t >= T_TOTAL_END) {
      isDropping = false;
      if (onDropFinished) {
        onDropFinished({
          ...cfg,
          completedAt: new Date().toLocaleTimeString()
        });
      }
    }
  }

  // ═══════════════════════════════════════════════
  // PUBLIC API METHODS
  // ═══════════════════════════════════════════════

  /**
   * Initialize 3D Engine on a DOM element
   */
  function init(targetContainerId, options = {}) {
    containerEl = typeof targetContainerId === 'string'
      ? document.getElementById(targetContainerId)
      : targetContainerId;

    if (!containerEl) {
      console.error(`[BinTwin3D] Container element '#${targetContainerId}' not found.`);
      return false;
    }

    // Check Three.js availability
    if (typeof THREE === 'undefined') {
      containerEl.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;height:100%;color:#E2E8F0;padding:24px;text-align:center;background:#0b1422;border-radius:12px;">
          <div>
            <h4 style="margin:0 0 8px;color:#f59e0b">Three.js Loading...</h4>
            <p style="font-size:0.88rem;color:#94a3b8">Connecting 3D WebGL engine. Please check internet connection or reload.</p>
          </div>
        </div>
      `;
      return false;
    }

    // Clean previous
    containerEl.innerHTML = '';

    // Create WebGL Renderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(containerEl.clientWidth || 800, containerEl.clientHeight || 520, false);
      if (renderer.outputEncoding !== undefined) {
        renderer.outputEncoding = THREE.sRGBEncoding;
      }
      containerEl.appendChild(renderer.domElement);
      renderer.domElement.style.display = 'block';
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      containerEl.style.cursor = 'grab';
    } catch (err) {
      containerEl.innerHTML = `<div style="padding:24px;color:#ef4444">WebGL not supported: ${err.message}</div>`;
      return false;
    }

    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0b1422, 18, 48);

    buildScene();
    setupCameraAndControls();

    if (options.onStatus) onStatusChange = options.onStatus;
    if (options.onComplete) onDropFinished = options.onComplete;

    // Start 60 FPS Render Loop
    if (animFrameId) cancelAnimationFrame(animFrameId);
    animFrameId = requestAnimationFrame(renderLoop);

    return true;
  }

  /**
   * Set texture on the 3D waste item
   */
  function setWasteTexture(dataUrlOrImageSrc) {
    if (!wasteItemMesh || !dataUrlOrImageSrc) return;
    currentWasteImage = dataUrlOrImageSrc;

    const loader = new THREE.TextureLoader();
    loader.load(
      dataUrlOrImageSrc,
      texture => {
        if (texture.encoding !== undefined) texture.encoding = THREE.sRGBEncoding;
        wasteItemMesh.material.map = texture;
        wasteItemMesh.material.color.setHex(0xffffff);
        wasteItemMesh.material.needsUpdate = true;
      },
      undefined,
      err => {
        console.warn('[BinTwin3D] Texture load fallback:', err);
      }
    );
  }

  /**
   * Select compartment by index or key (0=wet, 1=dry, 2=hazardous, 3=nonrecyclable)
   */
  function selectCompartment(idxOrKey) {
    let idx = idxOrKey;
    if (typeof idxOrKey === 'string') {
      idx = CATEGORIES.findIndex(c => c.key === idxOrKey.toLowerCase());
    }
    selectedCompartment = clamp(idx, 0, 3);
  }

  /**
   * Execute 3D Waste Drop Simulation
   */
  function dropWaste({ declared, seen, imageSrc, itemName, itemIcon, isCorrect, message }) {
    let dIdx = typeof declared === 'number' ? declared : CATEGORIES.findIndex(c => c.key === (declared || 'wet').toLowerCase());
    let sIdx = typeof seen === 'number' ? seen : CATEGORIES.findIndex(c => c.key === (seen || 'wet').toLowerCase());

    dIdx = clamp(dIdx, 0, 3);
    sIdx = clamp(sIdx, 0, 3);

    const correct = isCorrect !== undefined ? !!isCorrect : dIdx === sIdx;

    if (imageSrc) {
      setWasteTexture(imageSrc);
    } else {
      // Default colored material
      if (wasteItemMesh) {
        wasteItemMesh.material.map = null;
        wasteItemMesh.material.color.setHex(CATEGORIES[sIdx].color);
        wasteItemMesh.material.needsUpdate = true;
      }
    }

    activeDropConfig = {
      declaredIdx: dIdx,
      seenIdx: sIdx,
      declaredCat: CATEGORIES[dIdx],
      seenCat: CATEGORIES[sIdx],
      isCorrect: correct,
      itemName: itemName || 'Waste Item',
      itemIcon: itemIcon || '📦',
      imageSrc: imageSrc || currentWasteImage,
      message: message || ''
    };

    lastDropPayload = { ...activeDropConfig };
    selectedCompartment = dIdx;
    isDropping = true;
    dropStartTime = performance.now() / 1000;
  }

  /**
   * Replay the last drop animation
   */
  function replay() {
    if (!lastDropPayload) return;
    dropWaste(lastDropPayload);
  }

  /**
   * Reset Camera to default view
   */
  function resetCamera() {
    if (!camera || !worldGroup) return;
    worldGroup.rotation.y = 0;
    camera.position.set(0, 6.6, 14.2);
    camera.lookAt(0, 1.4, 0);
  }

  /**
   * Update visual fill levels on 3D bins
   */
  function updateFillLevels(fillLevels) {
    if (!fillLevels) return;
    CATEGORIES.forEach((cat, i) => {
      const fill = fillLevels[cat.key];
      if (fill !== undefined && bins[i]) {
        // Adjust opacity & emissive intensity based on fill
        const isUrgent = fill >= 80;
        bins[i].bodyMat.emissiveIntensity = isUrgent ? 0.35 : 0.08;
      }
    });
  }

  // Export API
  return {
    init,
    dropWaste,
    replay,
    selectCompartment,
    resetCamera,
    setWasteTexture,
    updateFillLevels,
    resize: handleResize,
    CATEGORIES
  };
});
