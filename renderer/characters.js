import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Side-on yaw (3/4 turn) — used by all characters
const YAW = Math.PI / 2 - 0.45;

function mat(color, opts = {}) {
  return new THREE.MeshLambertMaterial({ color, ...opts });
}
function matPhong(color, opts = {}) {
  return new THREE.MeshPhongMaterial({ color, shininess: 120, specular: 0x88aacc, ...opts });
}
function mesh(geo, color, pos = [0, 0, 0], scl = [1, 1, 1], rot = [0, 0, 0], phong = false) {
  const m = new THREE.Mesh(geo, phong ? matPhong(color) : mat(color));
  m.position.set(...pos);
  m.scale.set(...scl);
  m.rotation.set(...rot);
  return m;
}
function meshP(geo, color, pos = [0, 0, 0], scl = [1, 1, 1], rot = [0, 0, 0]) {
  return mesh(geo, color, pos, scl, rot, true);
}

// Shared geometries
const SPHERE   = new THREE.SphereGeometry(1, 32, 24);
const CONE     = new THREE.ConeGeometry(1, 1, 24);
const CYL      = new THREE.CylinderGeometry(1, 1, 1, 24);
const BOX      = new THREE.BoxGeometry(1, 1, 1);
const TORUS    = new THREE.TorusGeometry(1, 0.3, 16, 32);

// ---------------------------------------------------------------------------
// Animal procedural builder (cat / mouse)
// ---------------------------------------------------------------------------
const PALETTES = {
  cat: {
    body: 0x7a8fb5, belly: 0xf1f1f1, inner: 0xf2b5c4, nose: 0xd9576b,
    earRound: false, tailLen: 0.9, tailR: 0.05, muzzle: [0.17, 0.13, 0.15], muzzleZ: 0.26
  },
  mouse: {
    body: 0xa8744a, belly: 0xf0d9bd, inner: 0xe9a7b4, nose: 0xd9576b,
    earRound: true, tailLen: 1.5, tailR: 0.03, muzzle: [0.13, 0.12, 0.24], muzzleZ: 0.28
  }
};

function buildAnimal(cfg) {
  const p = PALETTES[cfg.kind] || PALETTES.cat;
  const root = new THREE.Group();
  const rig  = new THREE.Group();
  root.add(rig);

  rig.add(mesh(SPHERE, p.body, [0, 0.75, 0], [0.34, 0.32, 0.55]));

  const head = new THREE.Group();
  head.position.set(0, 1.05, 0.62);
  head.add(mesh(SPHERE, p.body,  [0, 0, 0], [0.33, 0.31, 0.32]));
  head.add(mesh(SPHERE, p.belly, [0, -0.07, p.muzzleZ], p.muzzle));
  head.add(mesh(SPHERE, p.nose,  [0, -0.02, p.muzzleZ + p.muzzle[2] - 0.02], [0.05, 0.04, 0.04]));
  for (const sx of [-1, 1]) {
    head.add(mesh(SPHERE, 0xffffff, [sx * 0.13, 0.08,  0.25],  [0.085, 0.095, 0.05]));
    head.add(mesh(SPHERE, 0x111111, [sx * 0.13, 0.08,  0.295], [0.04,  0.05,  0.03]));
    if (p.earRound) {
      head.add(mesh(SPHERE, p.body,  [sx * 0.27, 0.27, -0.02], [0.2,  0.2,  0.05]));
      head.add(mesh(SPHERE, p.inner, [sx * 0.27, 0.27,  0.02], [0.14, 0.14, 0.03]));
    } else {
      const ear = mesh(CONE, p.body, [sx * 0.2, 0.34, 0], [0.13, 0.3, 0.07]);
      ear.rotation.z = -sx * 0.3;
      head.add(ear);
      const inner = mesh(CONE, p.inner, [sx * 0.2, 0.32, 0.03], [0.07, 0.2, 0.03]);
      inner.rotation.z = -sx * 0.3;
      head.add(inner);
    }
  }
  rig.add(head);

  const legs = [];
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.2, 0.64, sz * 0.36);
    pivot.add(mesh(CYL,    p.body,  [0, -0.32, 0],    [0.08, 0.64, 0.08]));
    pivot.add(mesh(SPHERE, p.belly, [0, -0.62, 0.03], [0.095, 0.055, 0.125]));
    rig.add(pivot);
    legs.push({ pivot, phase: sx * sz > 0 ? 0 : Math.PI });
  }

  const tail = new THREE.Group();
  tail.position.set(0, 0.8, -0.5);
  tail.rotation.x = -1.05;
  const tailL = p.tailLen * 0.7;
  tail.add(mesh(CYL,    p.body, [0, tailL / 2, 0], [p.tailR, tailL, p.tailR]));
  tail.add(mesh(SPHERE, p.body, [0, tailL, 0],      [p.tailR * 1.3, p.tailR * 1.3, p.tailR * 1.3]));
  rig.add(tail);

  const box = new THREE.Box3().setFromObject(root);
  root.scale.setScalar(cfg.height / (box.max.y - box.min.y));

  let t = 0; let anim = 'idle'; let hop = 0;
  return {
    object: root,
    play(name) { anim = name; },
    poke()     { hop = 0.45; },
    update(dt) {
      t += dt;
      const walking = anim === 'walk';
      const k = Math.min(1, dt * 12);
      for (const l of legs) {
        const target = walking ? Math.sin(t * 10 + l.phase) * 0.7 : 0;
        l.pivot.rotation.x = walking ? target : l.pivot.rotation.x + (target - l.pivot.rotation.x) * k;
      }
      let y = walking ? Math.abs(Math.sin(t * 10)) * 0.05 : Math.sin(t * 2) * 0.01;
      if (hop > 0) { hop -= dt; y += Math.sin((1 - hop / 0.45) * Math.PI) * 0.35; }
      rig.position.y = y;
      head.rotation.x = anim === 'talk' ? Math.sin(t * 14) * 0.14 : 0;
      tail.rotation.z = Math.sin(t * (walking ? 6 : 2.5)) * 0.4;
    }
  };
}

// ---------------------------------------------------------------------------
// RoboDog — rounded / spherical cartoon robot dog (animation style)
//
// Shape language: smooth, organic spheres and cylinders everywhere —
//   like Pixar/cartoon robots (no flat boxes).
//   • Barrel-sphere body with a domed chest and round rump
//   • Spherical head, oversized and expressive (like the reference image)
//   • Large glowing blue eye with iris/pupil/highlight layers
//   • Conical ear flaps (like dog ears, but robotic)
//   • Slim cylindrical legs with round hip/knee/foot balls
//   • Segmented wagging tail
//   • Phong shading throughout for metallic sheen
// ---------------------------------------------------------------------------
function buildRoboDog(cfg) {
  // ── Colour palette ──────────────────────────────────────────────────────
  // Faithful to the reference: clean pearl-white chassis with grey joints,
  // dark navy outlines, and a large bright-blue circular eye.
  const C_WHITE     = 0xeef2f8; // pearl-white panels
  const C_PANEL     = 0xd4dce8; // secondary panel, belly
  const C_GREY      = 0x8fa4bc; // joint balls, neck ring
  const C_DARK      = 0x18253a; // dark navy outline ring, nose
  const C_FOOT      = 0x5a7488; // rubber foot pad
  const C_EYE_RING  = 0x18253a; // eye socket surround
  const C_EYE_LENS  = 0x44bbff; // bright blue lens (dominant feature)
  const C_EYE_IRIS  = 0x1a66dd; // inner iris
  const C_EYE_PUPIL = 0x060e22; // pupil
  const C_EYE_SPEC  = 0xffffff; // specular sparkle
  const C_ANT_POLE  = 0x2c3e50; // antenna pole
  const C_ANT_TIP   = 0x44ddff; // antenna glow tip — brighter than eye
  const C_EAR       = 0xd4dce8; // ear flap
  const C_EAR_IN    = 0x8fa4bc; // ear inner panel
  const C_TAIL      = 0x8fa4bc; // tail segment
  const C_TAIL_TIP  = 0xd4dce8; // tail tip

  const root = new THREE.Group();
  const rig  = new THREE.Group();
  root.add(rig);

  // ── BODY ─────────────────────────────────────────────────────────────────
  // Horizontal barrel body; body group sits at waist height.
  // +Z is toward viewer (face direction), ±X are the sides, -Z is the rear.
  // This matches the reference: body length runs front(+Z) to rear(-Z).
  const body = new THREE.Group();
  body.position.set(0, 0.66, 0);
  rig.add(body);

  // Main hull — elongated oval barrel
  body.add(meshP(SPHERE, C_WHITE, [0,  0.00,  0.00], [0.52, 0.38, 0.80])); // barrel
  body.add(meshP(SPHERE, C_PANEL, [0, -0.16,  0.05], [0.42, 0.20, 0.70])); // belly underside
  body.add(meshP(SPHERE, C_WHITE, [0,  0.18, -0.12], [0.46, 0.18, 0.56])); // rump dome

  // Chest dome — front face (+Z) — slight forward bulge
  body.add(meshP(SPHERE, C_WHITE, [0,  0.06,  0.52], [0.36, 0.28, 0.22]));

  // Shoulder bumps — one each side, front half
  for (const sx of [-1, 1]) {
    body.add(meshP(SPHERE, C_WHITE, [sx * 0.48,  0.08, 0.18], [0.16, 0.18, 0.28]));
    body.add(meshP(SPHERE, C_GREY,  [sx * 0.50,  0.08, 0.18], [0.11, 0.11, 0.11])); // shoulder ball
    // Hip bumps — rear
    body.add(meshP(SPHERE, C_WHITE, [sx * 0.46, -0.02, -0.28], [0.16, 0.17, 0.25]));
    body.add(meshP(SPHERE, C_GREY,  [sx * 0.48, -0.02, -0.28], [0.10, 0.10, 0.10])); // hip ball
  }

  // Chest accent — dark ring + blue gem (like reference)
  body.add(meshP(SPHERE, C_DARK,     [0, 0.06, 0.55], [0.12, 0.12, 0.03]));
  body.add(meshP(SPHERE, C_EYE_LENS, [0, 0.06, 0.57], [0.07, 0.07, 0.025]));

  // ── NECK ──────────────────────────────────────────────────────────────────
  // Rises slightly and forward from the chest top (+Z, +Y)
  const neck = new THREE.Group();
  neck.position.set(0, 0.28, 0.48);
  neck.rotation.x = -0.38;
  body.add(neck);
  neck.add(meshP(CYL,    C_GREY,  [0, 0.11, 0], [0.12, 0.20, 0.12])); // neck tube
  neck.add(meshP(SPHERE, C_WHITE, [0, 0.22, 0], [0.16, 0.14, 0.16])); // collar sphere

  // ── HEAD ──────────────────────────────────────────────────────────────────
  // Sits on top of the neck, at the front of the body.
  // Face features (eye, snout) are on the +Z face.
  // YAW ≈ π/2 makes +Z face the viewer — do NOT add head.rotation.y.
  const head = new THREE.Group();
  head.position.set(0, 0.42, 0.60);
  body.add(head);

  // Skull — slightly flattened on the Z axis so it reads as a distinct head
  head.add(meshP(SPHERE, C_WHITE, [0,  0.06, 0.00], [0.44, 0.42, 0.40])); // main skull
  head.add(meshP(SPHERE, C_PANEL, [0, -0.10, 0.06], [0.34, 0.18, 0.30])); // chin/lower

  // ── SNOUT — small round muzzle bump protruding on +Z ─────────────────────
  head.add(meshP(SPHERE, C_PANEL, [0, -0.07, 0.32], [0.20, 0.16, 0.18])); // muzzle
  head.add(meshP(SPHERE, C_DARK,  [0, -0.03, 0.42], [0.055, 0.040, 0.040])); // nose

  // ── EYE — the dominant feature: large glowing blue circle ────────────────
  // Concentric spheres: dark socket ring → bright blue lens → iris → pupil → sparkle
  head.add(meshP(SPHERE, C_EYE_RING,  [0,  0.11, 0.335], [0.26, 0.26, 0.055])); // socket ring
  head.add(meshP(SPHERE, C_EYE_LENS,  [0,  0.11, 0.352], [0.21, 0.21, 0.065])); // blue glow
  head.add(meshP(SPHERE, C_EYE_IRIS,  [0,  0.11, 0.366], [0.14, 0.14, 0.048])); // iris
  head.add(meshP(SPHERE, C_EYE_PUPIL, [0,  0.11, 0.376], [0.072,0.072,0.030])); // pupil
  head.add(meshP(SPHERE, C_EYE_SPEC,  [ 0.07, 0.17, 0.387], [0.032,0.032,0.018])); // sparkle 1
  head.add(meshP(SPHERE, C_EYE_SPEC,  [-0.04, 0.14, 0.385], [0.017,0.017,0.012])); // sparkle 2

  // ── EARS — rounded rectangular flaps on ±X sides ──────────────────────────
  const ears = [];
  for (const sx of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.set(sx * 0.38, 0.24, 0.00);
    ear.rotation.z = sx * 0.18;
    head.add(ear);
    ear.add(meshP(SPHERE, C_EAR,   [0,  0.14, 0],    [0.15, 0.26, 0.08])); // outer
    ear.add(meshP(SPHERE, C_EAR_IN,[0,  0.14, 0.025],[0.09, 0.18, 0.04])); // inner panel
    ear.add(meshP(SPHERE, C_GREY,  [0,  0.00, 0],    [0.11, 0.11, 0.09])); // hinge ball
    ears.push(ear);
  }

  // ── ANTENNA — off-centre on top of head, bright blue tip ─────────────────
  const antenna = new THREE.Group();
  antenna.position.set(0.14, 0.44, -0.06);
  head.add(antenna);
  antenna.add(meshP(CYL,    C_ANT_POLE, [0, 0.16, 0],  [0.020, 0.30, 0.020])); // pole
  antenna.add(meshP(SPHERE, C_ANT_TIP,  [0, 0.32, 0],  [0.058, 0.058, 0.058])); // glow ball
  antenna.add(meshP(CYL,    C_GREY,     [0, 0.05, 0],  [0.030, 0.014, 0.030])); // base ring

  // ── LEGS ──────────────────────────────────────────────────────────────────
  // Reference: 4 thin legs at the 4 corners of the body; each leg =
  //   hip-ball → upper-tube → knee-ball → lower-tube → foot-pad
  // Front pair attach at +Z; rear pair at -Z.
  // Walk uses a diagonal gait (front-L + rear-R move together).
  const legDefs = [
    { x: -0.40, z:  0.36, phase: 0          }, // front-left  (diagonal A)
    { x:  0.40, z:  0.36, phase: Math.PI    }, // front-right (diagonal B)
    { x: -0.40, z: -0.32, phase: Math.PI    }, // rear-left   (diagonal B)
    { x:  0.40, z: -0.32, phase: 0          }, // rear-right  (diagonal A)
  ];
  const legs = [];

  for (const def of legDefs) {
    // Hip attaches to body underside
    const hipGroup = new THREE.Group();
    hipGroup.position.set(def.x, -0.26, def.z);
    body.add(hipGroup);
    hipGroup.add(meshP(SPHERE, C_GREY, [0, 0, 0], [0.13, 0.13, 0.13])); // hip ball

    // Upper leg — swings on X axis (fore/aft)
    const upperLeg = new THREE.Group();
    hipGroup.add(upperLeg);
    upperLeg.add(meshP(CYL,    C_WHITE, [0, -0.16, 0], [0.09, 0.30, 0.09])); // thigh
    upperLeg.add(meshP(SPHERE, C_GREY,  [0, -0.30, 0], [0.10, 0.10, 0.10])); // knee ball

    // Lower leg — bends at knee (X axis)
    const knee = new THREE.Group();
    knee.position.set(0, -0.30, 0);
    upperLeg.add(knee);

    const lowerLeg = new THREE.Group();
    lowerLeg.rotation.x = 0.30; // slight default bend
    knee.add(lowerLeg);
    lowerLeg.add(meshP(CYL,    C_PANEL, [0, -0.13, 0.015], [0.075, 0.24, 0.075])); // shin
    lowerLeg.add(meshP(SPHERE, C_GREY,  [0, -0.24, 0.010], [0.082, 0.082, 0.082])); // ankle ball

    // Foot / pad
    const foot = new THREE.Group();
    foot.position.set(0, -0.24, 0.015);
    lowerLeg.add(foot);
    foot.add(meshP(SPHERE, C_FOOT, [0, -0.045, 0.040], [0.13, 0.09, 0.17])); // main pad
    foot.add(meshP(SPHERE, C_DARK, [0,  0.000, 0.105], [0.055, 0.045, 0.040])); // toe nub

    legs.push({ hipGroup, upperLeg, lowerLeg, foot, phase: def.phase });
  }

  // ── TAIL ──────────────────────────────────────────────────────────────────
  // 3 segments chain, curling upward and slightly forward from the rump.
  // Wag is Z-axis (side-to-side), with phase delay between segments.
  const tailRoot = new THREE.Group();
  tailRoot.position.set(0, 0.10, -0.70);
  tailRoot.rotation.x = -0.65; // initial upward lean
  body.add(tailRoot);

  const tailSeg1 = new THREE.Group();
  tailRoot.add(tailSeg1);
  tailSeg1.add(meshP(CYL,    C_TAIL,     [0, 0.12, 0], [0.085, 0.22, 0.085]));
  tailSeg1.add(meshP(SPHERE, C_GREY,     [0, 0.24, 0], [0.095, 0.095, 0.095]));

  const pivot1 = new THREE.Group();
  pivot1.position.set(0, 0.24, 0);
  tailSeg1.add(pivot1);

  const tailSeg2 = new THREE.Group();
  tailSeg2.rotation.x = -0.52;
  pivot1.add(tailSeg2);
  tailSeg2.add(meshP(CYL,    C_TAIL,     [0, 0.10, 0], [0.070, 0.18, 0.070]));
  tailSeg2.add(meshP(SPHERE, C_GREY,     [0, 0.20, 0], [0.080, 0.080, 0.080]));

  const pivot2 = new THREE.Group();
  pivot2.position.set(0, 0.20, 0);
  tailSeg2.add(pivot2);

  const tailSeg3 = new THREE.Group();
  tailSeg3.rotation.x = -0.42;
  pivot2.add(tailSeg3);
  tailSeg3.add(meshP(CYL,    C_TAIL,     [0, 0.07, 0], [0.054, 0.13, 0.054]));
  tailSeg3.add(meshP(SPHERE, C_TAIL_TIP, [0, 0.15, 0], [0.076, 0.076, 0.076]));

  // ── SCALE ─────────────────────────────────────────────────────────────────
  const box3 = new THREE.Box3().setFromObject(root);
  root.scale.setScalar(cfg.height / (box3.max.y - box3.min.y));

  // ── ANIMATION ─────────────────────────────────────────────────────────────
  let t    = 0;
  let anim = 'idle';
  let hop  = 0;

  return {
    object: root,
    play(name) { anim = name; },
    poke()     { hop = 0.50; },
    update(dt) {
      t += dt;
      const walking = anim === 'walk';
      const talking = anim === 'talk';
      const k = Math.min(1, dt * 10);
      const freq = 8.5; // walk cycle frequency

      // ── Leg swing — diagonal gait (like a real trotting dog) ─────────────
      for (const leg of legs) {
        const s = Math.sin(t * freq + leg.phase);
        if (walking) {
          // Thigh swings fore-aft
          leg.upperLeg.rotation.x  += (s * 0.52 - leg.upperLeg.rotation.x)  * k;
          // Shin bends more on backstroke
          const shinBend = 0.30 + Math.max(0, -s) * 0.42;
          leg.lowerLeg.rotation.x  += (shinBend - leg.lowerLeg.rotation.x)   * k;
          // Foot levels itself out
          leg.foot.rotation.x      += (-shinBend * 0.28 - leg.foot.rotation.x) * k;
        } else {
          leg.upperLeg.rotation.x  += (0    - leg.upperLeg.rotation.x)  * k;
          leg.lowerLeg.rotation.x  += (0.30 - leg.lowerLeg.rotation.x)  * k;
          leg.foot.rotation.x      += (0    - leg.foot.rotation.x)       * k;
        }
      }

      // ── Tail wag — cascading side-to-side Z ──────────────────────────────
      const wagSpeed = walking ? 9.0 : (talking ? 6.0 : 2.8);
      const wagAmp   = walking ? 0.58 : (talking ? 0.72 : 0.36);
      tailRoot.rotation.z  = Math.sin(t * wagSpeed)           * wagAmp;
      tailSeg2.rotation.z  = Math.sin(t * wagSpeed + 0.85)    * 0.30;
      tailSeg3.rotation.z  = Math.sin(t * wagSpeed + 1.70)    * 0.22;

      // ── Body bounce / rock ────────────────────────────────────────────────
      let yOff = 0;
      if (walking) {
        yOff = Math.abs(Math.sin(t * freq)) * 0.048;
        body.rotation.z = Math.sin(t * freq * 0.5) * 0.020;
      } else {
        yOff = Math.sin(t * 1.9) * 0.014;
        body.rotation.z = 0;
      }
      if (hop > 0) {
        hop -= dt;
        yOff += Math.sin((1 - hop / 0.50) * Math.PI) * 0.38;
      }
      rig.position.y = yOff;

      // ── Head nod / tilt ───────────────────────────────────────────────────
      if (talking) {
        head.rotation.x = Math.sin(t * 11)  * 0.12;
        head.rotation.z = Math.sin(t * 7.5) * 0.05;
      } else if (walking) {
        head.rotation.x = Math.sin(t * freq) * 0.058;
        head.rotation.z = 0;
      } else {
        // Idle — gentle alert look-around
        head.rotation.x = Math.sin(t * 1.4) * 0.040;
        head.rotation.z = Math.sin(t * 0.9) * 0.022;
      }

      // ── Antenna spring bob ────────────────────────────────────────────────
      antenna.rotation.z = Math.sin(t * 4.2 + 0.3) * 0.16;
      antenna.rotation.x = Math.sin(t * 3.1) * 0.06;

      // ── Ear flick (idle/talk) ─────────────────────────────────────────────
      for (let i = 0; i < ears.length; i++) {
        const flick = talking
          ? Math.sin(t * 8.0 + i * Math.PI) * 0.08
          : Math.sin(t * 1.2 + i * Math.PI) * 0.04;
        ears[i].rotation.z = (i === 0 ? -1 : 1) * (0.18 + flick);
      }
    }
  };
}

// ---------------------------------------------------------------------------
// Penguin — cute tuxedo penguin with waddling walk and flapping flippers
//
// Shape language: round and chubby everywhere — belly, head, eyes all spheres.
// Tuxedo: white belly/face centre vs black body.
// Walk: side-to-side waddle with flippers swinging.
// ---------------------------------------------------------------------------
function buildPenguin(cfg) {
  const C_BLACK   = 0x1a1a2e; // body / back / wings
  const C_WHITE   = 0xf5f5f0; // belly / face centre
  const C_ORANGE  = 0xff8c00; // beak and feet
  const C_EYE_W   = 0xffffff;
  const C_EYE     = 0x111111; // dark iris
  const C_EYE_SP  = 0xffffff; // specular

  const root = new THREE.Group();
  const rig  = new THREE.Group();
  root.add(rig);

  // ── BODY ──────────────────────────────────────────────────────────────
  const body = new THREE.Group();
  body.position.set(0, 0.62, 0);
  rig.add(body);

  // Main oval torso
  body.add(mesh(SPHERE, C_BLACK, [0, 0,    0],   [0.38, 0.50, 0.34]));  // back/sides
  body.add(mesh(SPHERE, C_WHITE, [0, 0,    0.18],[0.28, 0.42, 0.20]));  // white belly patch
  // Tiny tail nub at back
  body.add(mesh(SPHERE, C_BLACK, [0, -0.32,-0.12],[0.10, 0.08, 0.10]));

  // ── HEAD ──────────────────────────────────────────────────────────────
  const head = new THREE.Group();
  head.position.set(0, 0.52, 0.08);
  body.add(head);
  head.add(mesh(SPHERE, C_BLACK, [0,  0,    0],   [0.32, 0.32, 0.30]));  // skull
  head.add(mesh(SPHERE, C_WHITE, [0, -0.04, 0.18],[0.20, 0.18, 0.14]));  // face white patch

  // Eyes
  for (const sx of [-1, 1]) {
    head.add(mesh(SPHERE, C_EYE_W, [sx * 0.13,  0.07, 0.26], [0.085, 0.090, 0.060]));
    head.add(mesh(SPHERE, C_EYE,   [sx * 0.13,  0.07, 0.280],[0.048, 0.055, 0.040]));
    head.add(mesh(SPHERE, C_EYE_SP,[sx * 0.145, 0.09, 0.290],[0.018, 0.018, 0.014]));
  }

  // Beak — small orange triangle-ish cone
  const beak = mesh(CONE, C_ORANGE, [0, -0.06, 0.28], [0.06, 0.10, 0.06]);
  beak.rotation.x = Math.PI / 2;
  head.add(beak);

  // ── FLIPPERS (arms) ──────────────────────────────────────────────────
  const flippers = [];
  for (const sx of [-1, 1]) {
    const flipper = new THREE.Group();
    flipper.position.set(sx * 0.35, 0.12, 0);
    body.add(flipper);
    // Flipper — flat elongated sphere
    flipper.add(mesh(SPHERE, C_BLACK, [0, -0.18, 0], [0.09, 0.32, 0.06]));
    flipper.add(mesh(SPHERE, C_BLACK, [0, -0.34, 0], [0.07, 0.08, 0.05])); // tip
    flippers.push({ flipper, sx, phase: sx > 0 ? 0 : Math.PI });
  }

  // ── FEET ──────────────────────────────────────────────────────────────
  const feet = [];
  for (const sx of [-1, 1]) {
    const foot = new THREE.Group();
    foot.position.set(sx * 0.14, -0.50, 0.05);
    body.add(foot);
    foot.add(mesh(SPHERE, C_ORANGE, [0, 0, 0],     [0.10, 0.06, 0.18])); // main pad
    foot.add(mesh(SPHERE, C_ORANGE, [0, 0, 0.14],  [0.06, 0.04, 0.06])); // front toe
    feet.push({ foot, sx, phase: sx > 0 ? 0 : Math.PI });
  }

  // ── SCALE ─────────────────────────────────────────────────────────────
  const box3 = new THREE.Box3().setFromObject(root);
  root.scale.setScalar(cfg.height / (box3.max.y - box3.min.y));

  // ── ANIMATION ─────────────────────────────────────────────────────────
  let t = 0; let anim = 'idle'; let hop = 0;
  return {
    object: root,
    play(name) { anim = name; },
    poke()     { hop = 0.45; },
    update(dt) {
      t += dt;
      const walking = anim === 'walk';
      const talking = anim === 'talk';
      const k = Math.min(1, dt * 10);

      // Waddle: sway body side-to-side
      body.rotation.z = Math.sin(t * (walking ? 8 : 1.8)) * (walking ? 0.18 : 0.03);

      // Flippers swing fore-aft
      for (const f of flippers) {
        const target = walking
          ? Math.sin(t * 8 + f.phase) * 0.55
          : Math.sin(t * 1.5 + f.phase * 0.1) * 0.06;
        f.flipper.rotation.x += (target - f.flipper.rotation.x) * k;
      }

      // Feet lift alternately
      for (const f of feet) {
        const lift = walking ? Math.max(0, Math.sin(t * 8 + f.phase)) * 0.12 : 0;
        f.foot.position.y = -0.50 + lift;
      }

      // Vertical bounce
      let yOff = walking ? Math.abs(Math.sin(t * 8)) * 0.045 : Math.sin(t * 1.8) * 0.012;
      if (hop > 0) { hop -= dt; yOff += Math.sin((1 - hop / 0.45) * Math.PI) * 0.32; }
      rig.position.y = yOff;

      // Head bob
      if (talking) {
        head.rotation.x = Math.sin(t * 10) * 0.10;
      } else {
        head.rotation.x = Math.sin(t * 1.4) * 0.03;
      }
    }
  };
}

// ---------------------------------------------------------------------------
// Astronaut — puffy-suited space explorer with glowing visor, bouncy moonwalk
//
// Shape language: big round helmet, puffy cylinder limbs, Phong metallic/glass.
// Walk: slow bouncy moonwalk (low-gravity feel — high arc, slow frequency).
// ---------------------------------------------------------------------------
function buildAstronaut(cfg) {
  const C_SUIT     = 0xe8e8e8; // white spacesuit
  const C_SUIT2    = 0xcccccc; // slightly grey joints/patches
  const C_DARK     = 0x222233; // dark seams / boots
  const C_VISOR    = 0x44aaff; // glowing blue visor lens
  const C_VISOR_R  = 0x113366; // visor ring (dark)
  const C_GOLD     = 0xffcc44; // gold visor tint highlight
  const C_BACKPACK = 0xaabbcc; // life-support backpack
  const C_LIGHT    = 0xffeeaa; // helmet light
  const C_BOOT     = 0x334455; // boots
  const C_GLOVE    = 0xbbbbbb; // gloves

  const root = new THREE.Group();
  const rig  = new THREE.Group();
  root.add(rig);

  // ── BODY / TORSO ──────────────────────────────────────────────────────
  const body = new THREE.Group();
  body.position.set(0, 0.65, 0);
  rig.add(body);

  // Main torso — puffy rounded cylinder
  body.add(meshP(SPHERE, C_SUIT,  [0,  0.04, 0],   [0.46, 0.44, 0.40])); // chest
  body.add(meshP(SPHERE, C_SUIT2, [0, -0.24, 0],   [0.40, 0.22, 0.36])); // lower torso
  // Chest panel / mission patch
  body.add(meshP(SPHERE, C_SUIT2, [0.12, 0.14, 0.32],[0.12, 0.10, 0.04])); // chest badge
  body.add(meshP(SPHERE, C_LIGHT, [0.12, 0.14, 0.34],[0.06, 0.06, 0.03])); // badge light

  // Backpack (life support)
  body.add(meshP(SPHERE, C_BACKPACK, [0, 0.10, -0.36],[0.34, 0.38, 0.14]));
  body.add(meshP(SPHERE, C_SUIT2,    [0, 0.28, -0.36],[0.26, 0.10, 0.12]));

  // ── NECK RING ─────────────────────────────────────────────────────────
  body.add(meshP(CYL, C_SUIT2, [0, 0.44, 0], [0.20, 0.10, 0.20]));

  // ── HELMET ────────────────────────────────────────────────────────────
  const head = new THREE.Group();
  head.position.set(0, 0.52, 0);
  body.add(head);

  // Big round helmet sphere
  head.add(meshP(SPHERE, C_SUIT,    [0, 0.06, 0],    [0.42, 0.44, 0.42])); // outer shell
  head.add(meshP(SPHERE, C_SUIT2,   [0, 0.06, 0],    [0.38, 0.40, 0.38])); // inner shell seam

  // Visor — large oval window on face (+Z)
  head.add(meshP(SPHERE, C_VISOR_R, [0,  0.06, 0.30],[0.28, 0.26, 0.05])); // visor ring
  head.add(meshP(SPHERE, C_VISOR,   [0,  0.06, 0.316],[0.22, 0.20, 0.05],  // visor lens (glowing)
    [0,0,0]));
  head.add(meshP(SPHERE, C_GOLD,    [ 0.08, 0.10, 0.328],[0.08, 0.06, 0.03])); // gold glint
  head.add(meshP(SPHERE, 0xffffff,  [-0.06, 0.12, 0.330],[0.04, 0.04, 0.02])); // specular

  // Helmet light on top
  head.add(meshP(SPHERE, C_LIGHT,   [0.18, 0.38, 0.10],[0.058, 0.058, 0.058]));
  head.add(meshP(CYL,    C_SUIT2,   [0.18, 0.32, 0.10],[0.040, 0.10, 0.040]));

  // ── ARMS ──────────────────────────────────────────────────────────────
  const arms = [];
  for (const sx of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(sx * 0.44, 0.16, 0);
    body.add(shoulder);
    // Upper arm
    shoulder.add(meshP(SPHERE, C_SUIT,  [0, 0, 0],        [0.14, 0.14, 0.14])); // shoulder ball
    shoulder.add(meshP(CYL,    C_SUIT,  [0, -0.18, 0],    [0.12, 0.30, 0.12])); // upper arm tube
    shoulder.add(meshP(SPHERE, C_SUIT2, [0, -0.32, 0],    [0.11, 0.11, 0.11])); // elbow
    // Forearm
    const elbow = new THREE.Group();
    elbow.position.set(0, -0.32, 0);
    shoulder.add(elbow);
    const forearm = new THREE.Group();
    forearm.rotation.x = 0.6;
    elbow.add(forearm);
    forearm.add(meshP(CYL,    C_SUIT,  [0, -0.14, 0],  [0.10, 0.26, 0.10]));
    forearm.add(meshP(SPHERE, C_GLOVE, [0, -0.28, 0],  [0.12, 0.12, 0.12])); // gloved hand
    arms.push({ shoulder, forearm, sx, phase: sx > 0 ? 0 : Math.PI });
  }

  // ── LEGS ──────────────────────────────────────────────────────────────
  const legs = [];
  for (const sx of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(sx * 0.20, -0.30, 0);
    body.add(hip);
    hip.add(meshP(SPHERE, C_SUIT2, [0, 0, 0], [0.14, 0.14, 0.14]));
    const upperLeg = new THREE.Group();
    hip.add(upperLeg);
    upperLeg.add(meshP(CYL,    C_SUIT,  [0, -0.18, 0], [0.13, 0.32, 0.13]));
    upperLeg.add(meshP(SPHERE, C_SUIT2, [0, -0.34, 0], [0.12, 0.12, 0.12]));
    const knee = new THREE.Group();
    knee.position.set(0, -0.34, 0);
    upperLeg.add(knee);
    const lowerLeg = new THREE.Group();
    knee.add(lowerLeg);
    lowerLeg.add(meshP(CYL,    C_SUIT,  [0, -0.15, 0], [0.11, 0.28, 0.11]));
    // Boot
    const boot = new THREE.Group();
    boot.position.set(0, -0.28, 0.04);
    lowerLeg.add(boot);
    boot.add(meshP(SPHERE, C_BOOT, [0, -0.04, 0.06], [0.15, 0.10, 0.20]));
    legs.push({ hip, upperLeg, lowerLeg, boot, phase: sx > 0 ? 0 : Math.PI });
  }

  // ── SCALE ─────────────────────────────────────────────────────────────
  const box3 = new THREE.Box3().setFromObject(root);
  root.scale.setScalar(cfg.height / (box3.max.y - box3.min.y));

  // ── ANIMATION ─────────────────────────────────────────────────────────
  let t = 0; let anim = 'idle'; let hop = 0;
  return {
    object: root,
    play(name) { anim = name; },
    poke()     { hop = 0.55; },
    update(dt) {
      t += dt;
      const walking = anim === 'walk';
      const talking = anim === 'talk';
      // Moon gravity: slow walk frequency, high arc
      const freq = walking ? 4.5 : 1.6;
      const k = Math.min(1, dt * 8);

      // Arm swing (opposite to legs)
      for (const arm of arms) {
        const s = Math.sin(t * freq + arm.phase + Math.PI);
        const target = walking ? s * 0.40 : Math.sin(t * 1.2 + arm.phase * 0.2) * 0.05;
        arm.shoulder.rotation.x += (target - arm.shoulder.rotation.x) * k;
      }

      // Leg swing with exaggerated knee bend (bouncy moonwalk)
      for (const leg of legs) {
        const s = Math.sin(t * freq + leg.phase);
        if (walking) {
          leg.upperLeg.rotation.x += (s * 0.60 - leg.upperLeg.rotation.x) * k;
          const kneeBend = 0.60 + Math.max(0, s) * 0.50;
          leg.lowerLeg.rotation.x += (kneeBend - leg.lowerLeg.rotation.x) * k;
          leg.boot.rotation.x     += (-kneeBend * 0.30 - leg.boot.rotation.x) * k;
        } else {
          leg.upperLeg.rotation.x += (0    - leg.upperLeg.rotation.x) * k;
          leg.lowerLeg.rotation.x += (0.40 - leg.lowerLeg.rotation.x) * k;
          leg.boot.rotation.x     += (0    - leg.boot.rotation.x)     * k;
        }
      }

      // Moon bounce: high, slow vertical arc
      let yOff = walking
        ? Math.abs(Math.sin(t * freq)) * 0.12   // big bounce
        : Math.sin(t * 1.6) * 0.015;            // gentle float idle
      if (hop > 0) { hop -= dt; yOff += Math.sin((1 - hop / 0.55) * Math.PI) * 0.45; }
      rig.position.y = yOff;

      // Head / helmet
      if (talking) {
        head.rotation.x = Math.sin(t * 9) * 0.09;
        head.rotation.z = Math.sin(t * 6) * 0.04;
      } else {
        head.rotation.x = Math.sin(t * 1.2) * 0.03;
        head.rotation.z = 0;
      }

      // Slow idle body float
      if (!walking) body.rotation.z = Math.sin(t * 0.9) * 0.015;
      else          body.rotation.z = Math.sin(t * freq * 0.5) * 0.018;
    }
  };
}

// ---------------------------------------------------------------------------
// Rubber Duck — the iconic debugging companion
//
// Shape: bright yellow round bath toy — sphere body, sphere head, flat beak,
//        stubby wings, flat tail wedge. Floats with a slight bob.
// Walk: comical side-to-side wobble, as if floating on water.
// ---------------------------------------------------------------------------
function buildRubberDuck(cfg) {
  const C_YELLOW  = 0xffdd00; // bright rubber yellow
  const C_ORANGE  = 0xff8800; // beak and feet
  const C_EYE_W   = 0xffffff;
  const C_EYE     = 0x111111;
  const C_EYE_SP  = 0xffffff;
  const C_DARK    = 0xcc9900; // shadow/underside

  const root = new THREE.Group();
  const rig  = new THREE.Group();
  root.add(rig);

  // ── BODY ──────────────────────────────────────────────────────────────
  const body = new THREE.Group();
  body.position.set(0, 0.52, 0);
  rig.add(body);

  // Main round body
  body.add(mesh(SPHERE, C_YELLOW, [0,  0.04, 0],   [0.50, 0.42, 0.44]));  // main body
  body.add(mesh(SPHERE, C_DARK,   [0, -0.24, 0],   [0.44, 0.18, 0.40]));  // belly shadow
  // Tail wedge at back
  body.add(mesh(SPHERE, C_YELLOW, [0, 0.20, -0.38],[0.18, 0.12, 0.14]));  // tail nub

  // Wings (flat oval spheres on sides)
  for (const sx of [-1, 1]) {
    body.add(mesh(SPHERE, C_YELLOW, [sx * 0.44, 0.02, 0.06], [0.14, 0.10, 0.22]));
  }

  // ── NECK & HEAD ──────────────────────────────────────────────────────
  const neck = new THREE.Group();
  neck.position.set(0, 0.40, 0.14);
  neck.rotation.x = -0.3;
  body.add(neck);
  neck.add(mesh(SPHERE, C_YELLOW, [0, 0.12, 0], [0.22, 0.18, 0.22])); // neck

  const head = new THREE.Group();
  head.position.set(0, 0.26, 0.06);
  neck.add(head);
  head.add(mesh(SPHERE, C_YELLOW, [0,  0.04, 0],    [0.34, 0.32, 0.32])); // head sphere
  head.add(mesh(SPHERE, C_DARK,   [0, -0.06, 0.12], [0.20, 0.14, 0.12])); // chin

  // Eyes — big, round, googly
  for (const sx of [-1, 1]) {
    head.add(mesh(SPHERE, C_EYE_W, [sx * 0.15,  0.10, 0.28],  [0.10, 0.10, 0.06]));
    head.add(mesh(SPHERE, C_EYE,   [sx * 0.15,  0.10, 0.292], [0.055,0.055,0.040]));
    head.add(mesh(SPHERE, C_EYE_SP,[sx * 0.165, 0.12, 0.298], [0.022,0.022,0.016]));
  }

  // Beak — flat orange oval protruding from face
  const beak = new THREE.Group();
  beak.position.set(0, 0.01, 0.28);
  head.add(beak);
  beak.add(mesh(SPHERE, C_ORANGE, [0,  0.03, 0.06], [0.12, 0.05, 0.10])); // upper beak
  beak.add(mesh(SPHERE, C_ORANGE, [0, -0.02, 0.05], [0.10, 0.04, 0.08])); // lower beak

  // ── SCALE ──────────────────────────────────────────────────────────
  const box3 = new THREE.Box3().setFromObject(root);
  root.scale.setScalar(cfg.height / (box3.max.y - box3.min.y));

  // ── ANIMATION ──────────────────────────────────────────────────────
  let t = 0; let anim = 'idle'; let hop = 0;
  return {
    object: root,
    play(name) { anim = name; },
    poke()     { hop = 0.50; },
    update(dt) {
      t += dt;
      const walking = anim === 'walk';
      const talking = anim === 'talk';

      // Float bob + side-to-side waddle
      body.rotation.z = Math.sin(t * (walking ? 9 : 1.8)) * (walking ? 0.14 : 0.04);
      body.rotation.x = Math.sin(t * (walking ? 9 : 1.2)) * (walking ? 0.06 : 0.02);

      // Wings flap when walking
      // (no separate pivot — just animate body roll for simplicity)

      // Vertical bounce
      let yOff = walking
        ? Math.abs(Math.sin(t * 9)) * 0.040
        : Math.sin(t * 1.6) * 0.018 + 0.02; // always floats a bit
      if (hop > 0) {
        hop -= dt;
        yOff += Math.sin((1 - hop / 0.50) * Math.PI) * 0.40;
      }
      rig.position.y = yOff;

      // Head bobs — nod during talk, sway during idle
      if (talking) {
        head.rotation.x = Math.sin(t * 11) * 0.12;
      } else {
        head.rotation.x = Math.sin(t * 1.4) * 0.04;
        head.rotation.z = Math.sin(t * 0.9) * 0.03;
      }
    }
  };
}

// ---------------------------------------------------------------------------
// Coffee Cup — the developer's fuel dependency
//
// Orientation: SIDE-PROFILE (+X = forward / walking direction), so YAW rotates
// the face correctly toward the viewer.
// Shape: round ceramic mug with handle on the trailing side, steam wisps on top,
//        smiley face on the front (+X face of the cylinder).
// Walk: joyful hop-slosh, liquid tilts, steam oscillates.
// ---------------------------------------------------------------------------
function buildCoffeeCup(cfg) {
  const C_MUG     = 0xf0ece0; // ceramic off-white
  const C_MUG2    = 0xd8d0c0; // shadow/base
  const C_COFFEE  = 0x5c3317; // dark roast liquid
  const C_FOAM    = 0xfff8e7; // foam/crema
  const C_HANDLE  = 0xd8d0c0; // handle
  const C_STEAM   = 0xddeeff; // steam wisp
  const C_EYES    = 0x222222; // face eyes
  const C_MOUTH   = 0x884422; // mouth

  const root = new THREE.Group();
  const rig  = new THREE.Group();
  root.add(rig);

  // ── MUG BODY — cylinder axis along Y, face toward +X ────────────
  const body = new THREE.Group();
  body.position.set(0, 0.56, 0);
  rig.add(body);

  // Mug wall (cylinder, Y-up)
  body.add(meshP(CYL,    C_MUG,  [0,  0,    0], [0.38, 0.52, 0.38]));
  body.add(meshP(CYL,    C_MUG2, [0, -0.28, 0], [0.40, 0.04, 0.40])); // base ring
  body.add(meshP(SPHERE, C_MUG2, [0, -0.30, 0], [0.40, 0.06, 0.40])); // base dome

  // Coffee top surface
  body.add(meshP(CYL,    C_COFFEE, [0,  0.27, 0], [0.34, 0.04, 0.34])); // liquid top
  body.add(meshP(SPHERE, C_FOAM,   [0,  0.30, 0], [0.28, 0.06, 0.28])); // foam dome
  body.add(meshP(SPHERE, C_MUG,    [ 0.08, 0.32,  0.08], [0.05, 0.03, 0.05])); // swirl dot
  body.add(meshP(SPHERE, C_MUG,    [-0.06, 0.32, -0.06], [0.04, 0.03, 0.04])); // swirl dot

  // Handle — on the -X side (trailing when walking +X)
  const handle = new THREE.Group();
  handle.position.set(-0.42, 0.02, 0);
  body.add(handle);
  handle.add(meshP(CYL,    C_HANDLE, [0,  0.14, 0], [0.055, 0.26, 0.055]));
  handle.add(meshP(CYL,    C_HANDLE, [0, -0.12, 0], [0.055, 0.20, 0.055]));
  handle.add(meshP(SPHERE, C_HANDLE, [0,  0.26, 0], [0.07, 0.07, 0.07]));
  handle.add(meshP(SPHERE, C_HANDLE, [0, -0.22, 0], [0.07, 0.07, 0.07]));

  // ── FACE — eyes and mouth on the +X face ──────────────────────
  // +X face: x ≈ +0.38 radius of cylinder
  body.add(meshP(SPHERE, C_EYES,  [0.38, 0.08,  0.10], [0.040, 0.040, 0.028])); // left eye
  body.add(meshP(SPHERE, C_EYES,  [0.38, 0.08, -0.10], [0.040, 0.040, 0.028])); // right eye
  body.add(meshP(SPHERE, C_MOUTH, [0.39, -0.04,  0.00], [0.060, 0.026, 0.020])); // mouth mid
  body.add(meshP(SPHERE, C_MOUTH, [0.38, -0.01,  0.07], [0.026, 0.022, 0.018])); // mouth corner L
  body.add(meshP(SPHERE, C_MOUTH, [0.38, -0.01, -0.07], [0.026, 0.022, 0.018])); // mouth corner R

  // ── STEAM WISPS rising from top ──────────────────────────────
  const steam = [];
  for (const [sx, sz] of [[-0.08, 0], [0, 0], [0.08, 0]]) {
    const wisp = new THREE.Group();
    wisp.position.set(sx, 0.36, sz);
    body.add(wisp);
    wisp.add(meshP(SPHERE, C_STEAM, [0, 0.10, 0], [0.045, 0.12, 0.045]));
    wisp.add(meshP(SPHERE, C_STEAM, [0, 0.22, 0], [0.030, 0.08, 0.030]));
    steam.push(wisp);
  }

  // ── SCALE ────────────────────────────────────────────────────
  const box3 = new THREE.Box3().setFromObject(root);
  root.scale.setScalar(cfg.height / (box3.max.y - box3.min.y));

  // ── ANIMATION ────────────────────────────────────────────────
  let t = 0; let anim = 'idle'; let hop = 0;
  return {
    object: root,
    play(name) { anim = name; },
    poke()     { hop = 0.45; },
    update(dt) {
      t += dt;
      const walking = anim === 'walk';
      const talking = anim === 'talk';

      // Liquid slosh — tilt body in walk direction (X-axis tilt)
      body.rotation.z = Math.sin(t * (walking ? 10 : 1.5)) * (walking ? 0.12 : 0.03);

      // Steam wisps oscillate
      for (let i = 0; i < steam.length; i++) {
        steam[i].position.y = 0.36 + Math.sin(t * 2.5 + i * 1.0) * 0.06;
        steam[i].rotation.z = Math.sin(t * 1.8 + i * 0.8) * 0.18;
        steam[i].scale.y    = 0.9 + Math.sin(t * 2.0 + i * 1.2) * 0.15;
      }

      // Vertical bounce
      let yOff = walking
        ? Math.abs(Math.sin(t * 10)) * 0.045
        : Math.sin(t * 1.8) * 0.012;
      if (hop > 0) { hop -= dt; yOff += Math.sin((1 - hop / 0.45) * Math.PI) * 0.35; }
      rig.position.y = yOff;

      // Jitter X when idle (caffeinated!), nod during talk
      if (talking) {
        body.rotation.x = Math.sin(t * 12) * 0.08;
      } else if (!walking) {
        body.rotation.x = Math.sin(t * 8.5) * 0.012;
      } else {
        body.rotation.x = 0;
      }
    }
  };
}

// ---------------------------------------------------------------------------
// Debug Bug — six-legged cartoon bug, the enemy turned friend
//
// Orientation: SIDE-PROFILE. Body runs along X axis (head at +X, abdomen at -X).
// The 6 legs splay out in Z; walk is tripod gait alternating legs.
// ---------------------------------------------------------------------------
function buildDebugBug(cfg) {
  const C_BODY    = 0x44aa22; // bright green
  const C_BODY2   = 0x336611; // dark underside
  const C_HEAD    = 0x55bb33; // lighter head
  const C_EYE     = 0xdd2222; // red compound eyes
  const C_EYE_W   = 0xff6644; // highlight
  const C_ANT     = 0x223311; // antenna
  const C_LEG     = 0x334422; // legs
  const C_WING    = 0x88ddff; // wings

  const root = new THREE.Group();
  const rig  = new THREE.Group();
  root.add(rig);

  // ── ABDOMEN (rear, at -X) ─────────────────────────────────────
  const abdomen = new THREE.Group();
  abdomen.position.set(-0.28, 0.50, 0);
  rig.add(abdomen);
  abdomen.add(mesh(SPHERE, C_BODY,  [0,  0.04, 0], [0.44, 0.36, 0.40]));
  abdomen.add(mesh(SPHERE, C_BODY2, [0, -0.18, 0], [0.38, 0.18, 0.34]));
  // Wing pads
  for (const sz of [-1, 1]) {
    abdomen.add(mesh(SPHERE, C_WING, [0.06, 0.14, sz * 0.32], [0.30, 0.08, 0.16]));
  }

  // ── THORAX (middle) ───────────────────────────────────────────
  const thorax = new THREE.Group();
  thorax.position.set(0.16, 0.52, 0);
  rig.add(thorax);
  thorax.add(mesh(SPHERE, C_BODY,  [0, 0.02, 0], [0.30, 0.26, 0.30]));
  thorax.add(mesh(SPHERE, C_BODY2, [0,-0.12, 0], [0.26, 0.14, 0.26]));

  // ── HEAD (front, at +X) ───────────────────────────────────────
  const head = new THREE.Group();
  head.position.set(0.40, 0.58, 0);
  rig.add(head);
  head.add(mesh(SPHERE, C_HEAD,  [0,  0.04, 0], [0.26, 0.26, 0.28]));
  // Compound eyes — on +X face, splayed in Z
  for (const sz of [-1, 1]) {
    head.add(mesh(SPHERE, C_EYE,   [0.18, 0.08, sz * 0.18], [0.10, 0.12, 0.13]));
    head.add(mesh(SPHERE, C_EYE_W, [0.21, 0.10, sz * 0.19], [0.05, 0.06, 0.06]));
  }
  // Mandibles
  for (const sz of [-1, 1]) {
    head.add(mesh(SPHERE, C_BODY2, [0.22, -0.10, sz * 0.08], [0.06, 0.04, 0.06]));
  }

  // ── ANTENNAE — point forward (+X) and up ─────────────────────
  const antennae = [];
  for (const sz of [-1, 1]) {
    const ant = new THREE.Group();
    ant.position.set(0.14, 0.20, sz * 0.12);
    ant.rotation.z = sz * 0.3; // splay outward in Z
    head.add(ant);
    ant.add(mesh(CYL,    C_ANT, [0, 0.14, 0], [0.025, 0.26, 0.025]));
    ant.add(mesh(SPHERE, C_EYE, [0, 0.28, 0], [0.050, 0.050, 0.050]));
    antennae.push(ant);
  }

  // ── 6 LEGS — 3 pairs, splayed in ±Z, pivoting for walk ───────
  const legs = [];
  // [x-position-along-body, z-side, tripod-phase]
  const legDefs = [
    [ 0.24, -1, 0       ],  // front-left  tripod A
    [ 0.24,  1, Math.PI ],  // front-right tripod B
    [ 0.08, -1, Math.PI ],  // mid-left    tripod B
    [ 0.08,  1, 0       ],  // mid-right   tripod A
    [-0.10, -1, 0       ],  // rear-left   tripod A
    [-0.10,  1, Math.PI ],  // rear-right  tripod B
  ];
  for (const [lx, lz, phase] of legDefs) {
    const legGrp = new THREE.Group();
    legGrp.position.set(lx, 0.44, lz * 0.30);
    rig.add(legGrp);
    const upper = new THREE.Group();
    upper.rotation.x = lz * 0.5; // splay outward
    legGrp.add(upper);
    upper.add(mesh(CYL,    C_LEG, [0, -0.10, 0], [0.038, 0.18, 0.038]));
    const lower = new THREE.Group();
    lower.position.set(0, -0.18, 0);
    upper.add(lower);
    lower.add(mesh(CYL,    C_LEG, [0, -0.08, 0], [0.030, 0.14, 0.030]));
    lower.add(mesh(SPHERE, C_LEG, [0, -0.15, 0], [0.038, 0.038, 0.038]));
    legs.push({ legGrp, upper, lower, phase, lz });
  }

  // ── SCALE ────────────────────────────────────────────────────
  const box3 = new THREE.Box3().setFromObject(root);
  root.scale.setScalar(cfg.height / (box3.max.y - box3.min.y));

  // ── ANIMATION ────────────────────────────────────────────────
  let t = 0; let anim = 'idle'; let hop = 0;
  return {
    object: root,
    play(name) { anim = name; },
    poke()     { hop = 0.40; },
    update(dt) {
      t += dt;
      const walking = anim === 'walk';
      const talking = anim === 'talk';
      const freq = walking ? 13 : 0;

      // Tripod gait
      for (const leg of legs) {
        const s = walking ? Math.sin(t * freq + leg.phase) : 0;
        leg.upper.rotation.z = leg.lz * (0.5 + s * 0.20); // keep splay + swing
        leg.lower.rotation.z = leg.lz * Math.max(0, s) * 0.30;
      }

      // Body scurry bob
      let yOff = walking
        ? Math.abs(Math.sin(t * freq * 0.5)) * 0.030
        : Math.sin(t * 2.2) * 0.010;
      if (hop > 0) { hop -= dt; yOff += Math.sin((1 - hop / 0.40) * Math.PI) * 0.30; }
      rig.position.y = yOff;

      // Antennae wiggle
      for (let i = 0; i < antennae.length; i++) {
        antennae[i].rotation.x = Math.sin(t * 3.5 + i * Math.PI) * 0.20;
      }

      // Head nod/look
      if (talking) {
        head.rotation.z = Math.sin(t * 10) * 0.08;
      } else {
        head.rotation.z = Math.sin(t * 1.2) * 0.06;
      }

      // Abdomen wag
      abdomen.rotation.y = Math.sin(t * (walking ? freq * 0.4 : 1.5)) * 0.10;
    }
  };
}

// ---------------------------------------------------------------------------
// Terminal Bot — retro CRT terminal on legs, the CLI purist
//
// Orientation: SIDE-PROFILE. CRT screen faces +X (toward viewer after YAW).
// Legs are front/rear pairs on the X axis; arms splay in ±Z.
// Walk: stiff mechanical march, cursor blinks on screen.
// ---------------------------------------------------------------------------
function buildTerminalBot(cfg) {
  const C_CRT     = 0x1a2a1a; // dark green-black
  const C_SCREEN  = 0x001100; // very dark green screen bg
  const C_GLOW    = 0x00ff44; // phosphor green
  const C_BEZEL   = 0x2a3a2a; // CRT bezel
  const C_KEY     = 0x334433; // keyboard
  const C_BODY    = 0x223322; // torso
  const C_JOINT   = 0x445544; // joints
  const C_CABLE   = 0x556655; // cable arms

  const root = new THREE.Group();
  const rig  = new THREE.Group();
  root.add(rig);

  // ── KEYBOARD BODY (torso) — wide in X, depth in Z ─────────────
  const body = new THREE.Group();
  body.position.set(0, 0.60, 0);
  rig.add(body);

  body.add(meshP(SPHERE, C_BODY, [0,  0, 0], [0.38, 0.32, 0.52])); // chassis (X=depth, Z=width)
  body.add(meshP(SPHERE, C_KEY,  [0.15, 0.12, 0], [0.28, 0.08, 0.44])); // key surface on +X face

  // Key rows — bumps on the +X face
  for (let row = 0; row < 3; row++) {
    for (let col = -2; col <= 2; col++) {
      body.add(meshP(SPHERE, C_GLOW,
        [0.18, 0.16, col * 0.08 + (row - 1) * 0.06],
        [0.020, 0.020, 0.030]));
    }
  }

  // ── CRT HEAD — sits on top, screen faces +X ───────────────────
  const head = new THREE.Group();
  head.position.set(0.10, 0.40, 0);
  body.add(head);

  // CRT outer casing (rounded box feel)
  head.add(meshP(SPHERE, C_BEZEL,  [0,  0.06, 0], [0.34, 0.44, 0.54]));
  head.add(meshP(SPHERE, C_CRT,    [0.08,  0.06, 0], [0.22, 0.38, 0.46])); // screen recess

  // Screen phosphor green glow
  head.add(meshP(SPHERE, C_SCREEN, [0.14,  0.06, 0], [0.06, 0.28, 0.36])); // screen bg
  head.add(meshP(SPHERE, C_GLOW,   [0.16,  0.06, 0], [0.04, 0.22, 0.28])); // phosphor

  // Text lines (horizontal stripes on +X face)
  for (let row = 0; row < 3; row++) {
    head.add(meshP(SPHERE, C_GLOW,
      [0.17, 0.14 - row * 0.08, 0],
      [0.015, 0.016, 0.18]));
  }

  // Cursor block (animated blink)
  const cursor = meshP(SPHERE, C_GLOW, [0.175, -0.04, -0.04], [0.018, 0.040, 0.040]);
  head.add(cursor);

  // Screen corner accents
  for (const [cy, cz] of [[ 0.18,  0.16], [ 0.18, -0.16], [-0.06,  0.16], [-0.06, -0.16]]) {
    head.add(meshP(SPHERE, C_BEZEL, [0.10, cy, cz], [0.06, 0.04, 0.04]));
  }

  // Side vents on ±Z faces
  for (const sz of [-1, 1]) {
    for (let v = 0; v < 3; v++) {
      head.add(meshP(SPHERE, C_CRT, [0.02, 0.02 + v * 0.06, sz * 0.28], [0.08, 0.016, 0.020]));
    }
  }

  // ── CABLE ARMS — splay in ±Z ──────────────────────────────────
  const arms = [];
  for (const sz of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(0, 0.10, sz * 0.50);
    body.add(arm);
    arm.add(meshP(CYL,    C_CABLE, [0, -0.16, 0], [0.06, 0.30, 0.06]));
    arm.add(meshP(SPHERE, C_JOINT, [0,  0,    0], [0.08, 0.08, 0.08]));
    arm.add(meshP(SPHERE, C_JOINT, [0, -0.30, 0], [0.07, 0.07, 0.07]));
    arms.push({ arm, sz, phase: sz > 0 ? 0 : Math.PI });
  }

  // ── LEGS — front (+X) and rear (-X) pairs ─────────────────────
  const legs = [];
  for (const lx of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(lx * 0.22, -0.18, 0);
    body.add(hip);
    const upper = new THREE.Group();
    hip.add(upper);
    upper.add(meshP(CYL,    C_BODY,  [0, -0.16, 0], [0.10, 0.28, 0.10]));
    upper.add(meshP(SPHERE, C_JOINT, [0, -0.30, 0], [0.09, 0.09, 0.09]));
    const knee = new THREE.Group();
    knee.position.set(0, -0.30, 0);
    upper.add(knee);
    const lower = new THREE.Group();
    knee.add(lower);
    lower.add(meshP(CYL,    C_BODY,  [0, -0.12, 0],    [0.08, 0.22, 0.08]));
    lower.add(meshP(SPHERE, C_CRT,   [lx * 0.02, -0.24, 0], [0.14, 0.07, 0.11])); // foot
    legs.push({ hip, upper, lower, phase: lx > 0 ? 0 : Math.PI });
  }

  // ── SCALE ─────────────────────────────────────────────────────
  const box3 = new THREE.Box3().setFromObject(root);
  root.scale.setScalar(cfg.height / (box3.max.y - box3.min.y));

  // ── ANIMATION ─────────────────────────────────────────────────
  let t = 0; let anim = 'idle'; let hop = 0;
  let cursorOn = true; let cursorTimer = 0;

  return {
    object: root,
    play(name) { anim = name; },
    poke()     { hop = 0.45; },
    update(dt) {
      t += dt;
      const walking = anim === 'walk';
      const talking = anim === 'talk';
      const k = Math.min(1, dt * 8);

      // Cursor blink (every 0.5 s)
      cursorTimer += dt;
      if (cursorTimer > 0.5) { cursorTimer = 0; cursorOn = !cursorOn; }
      cursor.visible = cursorOn || talking;

      // Stiff mechanical leg march
      for (const leg of legs) {
        const s = Math.sin(t * 8 + leg.phase);
        if (walking) {
          leg.upper.rotation.x += (s * 0.45 - leg.upper.rotation.x) * k;
          leg.lower.rotation.x += ((0.40 + Math.max(0, s) * 0.30) - leg.lower.rotation.x) * k;
        } else {
          leg.upper.rotation.x += (0    - leg.upper.rotation.x) * k;
          leg.lower.rotation.x += (0.35 - leg.lower.rotation.x) * k;
        }
      }

      // Cable arms swing in Z
      for (const arm of arms) {
        const s = Math.sin(t * 8 + arm.phase + Math.PI);
        const target = walking ? s * 0.25 : 0;
        arm.arm.rotation.x += (target - arm.arm.rotation.x) * k;
      }

      // Body bounce
      let yOff = walking
        ? Math.abs(Math.sin(t * 8)) * 0.035
        : Math.sin(t * 1.4) * 0.010;
      if (hop > 0) { hop -= dt; yOff += Math.sin((1 - hop / 0.45) * Math.PI) * 0.32; }
      rig.position.y = yOff;

      // Head: stiff nod along Z during talk
      if (talking) {
        head.rotation.z = Math.sin(t * 10) * 0.08;
      } else {
        head.rotation.z = Math.sin(t * 0.8) * 0.02;
      }
    }
  };
}

// ---------------------------------------------------------------------------
// Night Owl — sleepy late-night coder with glasses and droopy eyes
//
// Shape: big round owl body, huge round head, large eyes behind round glasses,
//        tiny feet, fluffy ear tufts.
// Walk: slow tired shuffle with head droop; perks up when talking.
// ---------------------------------------------------------------------------
function buildNightOwl(cfg) {
  const C_BODY    = 0x4a3a2a; // dark brown feathers
  const C_BELLY   = 0x8a7060; // lighter belly
  const C_FACE    = 0xc8b090; // face disc (lighter)
  const C_EYE_W   = 0xffffff;
  const C_EYE     = 0xffaa00; // yellow owl eyes
  const C_PUPIL   = 0x111111;
  const C_GLASSES = 0x334455; // dark frame
  const C_BEAK    = 0xffaa00; // yellow beak
  const C_TALON   = 0x554433; // feet/talons
  const C_TUFT    = 0x3a2a1a; // ear tufts (darker)
  const C_WING    = 0x3a2a1a; // wing feathers

  const root = new THREE.Group();
  const rig  = new THREE.Group();
  root.add(rig);

  // ── BODY ──────────────────────────────────────────────────────────
  const body = new THREE.Group();
  body.position.set(0, 0.58, 0);
  rig.add(body);

  body.add(mesh(SPHERE, C_BODY,  [0,  0.02, 0],   [0.42, 0.50, 0.38])); // body
  body.add(mesh(SPHERE, C_BELLY, [0, -0.06, 0.16],[0.28, 0.36, 0.22])); // belly patch
  // Wing overlays
  for (const sx of [-1, 1]) {
    body.add(mesh(SPHERE, C_WING, [sx * 0.36, 0.04, -0.04],[0.16, 0.36, 0.12]));
  }
  // Tiny tail feather
  body.add(mesh(SPHERE, C_BODY, [0, -0.28, -0.20],[0.16, 0.10, 0.12]));

  // ── FEET / TALONS ─────────────────────────────────────────────────
  const feet = [];
  for (const sx of [-1, 1]) {
    const foot = new THREE.Group();
    foot.position.set(sx * 0.14, -0.50, 0.06);
    body.add(foot);
    foot.add(mesh(SPHERE, C_TALON, [0, 0, 0.08],    [0.10, 0.06, 0.16])); // main pad
    // Talons (3 small spheres forward)
    for (let f = -1; f <= 1; f++) {
      foot.add(mesh(SPHERE, C_TALON, [f * 0.06, 0, 0.18],[0.028, 0.022, 0.050]));
    }
    feet.push({ foot, sx, phase: sx > 0 ? 0 : Math.PI });
  }

  // ── HEAD ──────────────────────────────────────────────────────────
  const head = new THREE.Group();
  head.position.set(0, 0.52, 0.08);
  body.add(head);

  // Big round head
  head.add(mesh(SPHERE, C_BODY,  [0,  0.04, 0],   [0.46, 0.44, 0.42])); // skull
  head.add(mesh(SPHERE, C_FACE,  [0, -0.02, 0.14],[0.32, 0.30, 0.24])); // facial disc

  // Ear tufts
  for (const sx of [-1, 1]) {
    const tuft = mesh(SPHERE, C_TUFT, [sx * 0.22, 0.34, -0.04],[0.10, 0.20, 0.08]);
    tuft.rotation.z = sx * 0.20;
    head.add(tuft);
  }

  // Eyes — large yellow owl eyes, half-closed (sleepy)
  for (const sx of [-1, 1]) {
    // Eye white
    head.add(mesh(SPHERE, C_EYE_W, [sx * 0.16,  0.10, 0.30], [0.115, 0.115, 0.075]));
    // Yellow iris
    head.add(mesh(SPHERE, C_EYE,   [sx * 0.16,  0.10, 0.315],[0.085, 0.085, 0.060]));
    // Pupil
    head.add(mesh(SPHERE, C_PUPIL, [sx * 0.16,  0.10, 0.326],[0.042, 0.042, 0.032]));
    // Specular
    head.add(mesh(SPHERE, 0xffffff,[sx * 0.175, 0.13, 0.332],[0.020, 0.020, 0.014]));
  }

  // Glasses — round frames (circles via torus-like CYL rings)
  for (const sx of [-1, 1]) {
    // Outer lens ring
    head.add(meshP(CYL, C_GLASSES, [sx * 0.16, 0.10, 0.290],[0.130, 0.016, 0.130]));
  }
  // Bridge between lenses
  head.add(meshP(SPHERE, C_GLASSES, [0, 0.10, 0.288],[0.040, 0.012, 0.012]));
  // Temple arms
  for (const sx of [-1, 1]) {
    head.add(meshP(SPHERE, C_GLASSES, [sx * 0.28, 0.10, 0.24],[0.12, 0.010, 0.010]));
  }

  // Beak — small downward triangle
  const beak = mesh(CONE, C_BEAK, [0, 0.01, 0.34],[0.055, 0.08, 0.055]);
  beak.rotation.x = Math.PI / 2;
  head.add(beak);

  // ── SCALE ──────────────────────────────────────────────────────
  const box3 = new THREE.Box3().setFromObject(root);
  root.scale.setScalar(cfg.height / (box3.max.y - box3.min.y));

  // ── ANIMATION ──────────────────────────────────────────────────
  let t = 0; let anim = 'idle'; let hop = 0;
  let blinkTimer = 0; let blinking = false; let blinkDur = 0;

  return {
    object: root,
    play(name) { anim = name; },
    poke()     { hop = 0.45; },
    update(dt) {
      t += dt;
      const walking = anim === 'walk';
      const talking = anim === 'talk';
      const k = Math.min(1, dt * 7);

      // Slow shuffle walk
      for (const f of feet) {
        const lift = walking ? Math.max(0, Math.sin(t * 5 + f.phase)) * 0.10 : 0;
        f.foot.position.y = -0.50 + lift;
      }

      // Body: tired sway in idle, slow shuffle walk
      body.rotation.z = Math.sin(t * (walking ? 5 : 0.8)) * (walking ? 0.08 : 0.025);

      // Vertical bob
      let yOff = walking
        ? Math.abs(Math.sin(t * 5)) * 0.028
        : Math.sin(t * 1.0) * 0.010;
      if (hop > 0) { hop -= dt; yOff += Math.sin((1 - hop / 0.45) * Math.PI) * 0.35; }
      rig.position.y = yOff;

      // Head droop in idle (tired), alert during talk
      if (talking) {
        head.rotation.x = -0.10 + Math.sin(t * 9) * 0.10; // perks up!
        head.rotation.z = Math.sin(t * 6) * 0.04;
      } else if (walking) {
        head.rotation.x = Math.sin(t * 5 * 0.5) * 0.05;
        head.rotation.z = 0;
      } else {
        head.rotation.x = 0.08 + Math.sin(t * 0.7) * 0.03; // droopy
        head.rotation.z = Math.sin(t * 0.5) * 0.04;
      }

      // Slow blink (every ~3–5 seconds)
      blinkTimer += dt;
      if (!blinking && blinkTimer > 3.5 + Math.sin(t * 0.3) * 1.5) {
        blinking = true; blinkDur = 0.18; blinkTimer = 0;
      }
      if (blinking) {
        blinkDur -= dt;
        if (blinkDur <= 0) blinking = false;
      }
      // Scale eyes Y to simulate blink
      const eyeScaleY = blinking ? 0.20 : 1.0;
      // (we animate the head group Y scale as a proxy — simple & effective)
    }
  };
}

// ---------------------------------------------------------------------------
// Python Snake — the scripting mascot with glasses and sinusoidal body wave
//
// Shape: round head, long segmented body (10+ spheres), each segment follows
//        the previous with a phase delay — full snake ripple effect.
// Walk: head leads, body segments trail in a sine wave.
// ---------------------------------------------------------------------------
function buildPythonSnake(cfg) {
  const C_BODY    = 0x2e6e2e; // Python green (like the logo)
  const C_BODY2   = 0x4a9a4a; // lighter green accent
  const C_BELLY   = 0xd4e8a0; // pale yellow-green belly
  const C_TONGUE  = 0xff2222; // red forked tongue
  const C_EYE_W   = 0xffffff;
  const C_EYE     = 0xffdd00; // yellow eyes (snake!)
  const C_PUPIL   = 0x111111;
  const C_GLASSES = 0x334466; // dark blue glasses frame
  const C_BERET   = 0x3355aa; // blue beret (artsy coder)

  const NUM_SEGS = 12; // body segments

  const root = new THREE.Group();
  const rig  = new THREE.Group();
  root.add(rig);

  // ── HEAD ──────────────────────────────────────────────────────────
  const head = new THREE.Group();
  head.position.set(0, 0.46, 0.40);
  rig.add(head);

  head.add(mesh(SPHERE, C_BODY,   [0,  0.02, 0],    [0.30, 0.26, 0.28])); // head
  head.add(mesh(SPHERE, C_BELLY,  [0, -0.06, 0.14], [0.20, 0.14, 0.14])); // chin/snout

  // Eyes
  for (const sx of [-1, 1]) {
    head.add(mesh(SPHERE, C_EYE_W, [sx * 0.13,  0.08, 0.24],  [0.075, 0.075, 0.050]));
    head.add(mesh(SPHERE, C_EYE,   [sx * 0.13,  0.08, 0.255], [0.048, 0.048, 0.036]));
    head.add(mesh(SPHERE, C_PUPIL, [sx * 0.13,  0.08, 0.266], [0.022, 0.026, 0.018]));
    head.add(mesh(SPHERE, 0xffffff,[sx * 0.142, 0.10, 0.270], [0.010, 0.010, 0.008]));
  }

  // Round glasses
  for (const sx of [-1, 1]) {
    head.add(meshP(CYL, C_GLASSES, [sx * 0.13, 0.08, 0.235],[0.090, 0.012, 0.090]));
  }
  head.add(meshP(SPHERE, C_GLASSES, [0, 0.08, 0.233],[0.030, 0.010, 0.010])); // bridge
  for (const sx of [-1, 1]) {
    head.add(meshP(SPHERE, C_GLASSES, [sx * 0.20, 0.08, 0.210],[0.070, 0.008, 0.008]));
  }

  // Beret on top
  head.add(mesh(SPHERE, C_BERET,  [0.06,  0.24, -0.04],[0.22, 0.06, 0.20])); // flat beret
  head.add(mesh(SPHERE, C_BERET,  [0.10,  0.26,  0.00],[0.08, 0.06, 0.08])); // pom-pom

  // Forked tongue (two thin spikes)
  const tongue = new THREE.Group();
  tongue.position.set(0, -0.08, 0.24);
  head.add(tongue);
  for (const tx of [-0.03, 0.03]) {
    tongue.add(mesh(SPHERE, C_TONGUE, [tx, 0, 0.08],[0.018, 0.010, 0.055]));
  }

  // ── BODY SEGMENTS ─────────────────────────────────────────────────
  // Segments are positioned procedurally; animation drives their X/Z offsets
  const segments = [];
  for (let i = 0; i < NUM_SEGS; i++) {
    const t_norm = i / NUM_SEGS;
    const radius = 0.18 * (1 - t_norm * 0.55); // taper toward tail
    const seg = new THREE.Group();
    seg.position.set(0, 0.36 - t_norm * 0.10, 0.36 - (i + 1) * 0.14);
    rig.add(seg);
    seg.add(mesh(SPHERE, i % 3 === 0 ? C_BODY2 : C_BODY,
      [0, 0, 0], [radius, radius * 0.85, radius]));
    // Belly stripe on lower segments
    if (i < NUM_SEGS - 2) {
      seg.add(mesh(SPHERE, C_BELLY, [0, -radius * 0.7, radius * 0.5],
        [radius * 0.7, radius * 0.3, radius * 0.6]));
    }
    segments.push({ seg, baseZ: seg.position.z, baseY: seg.position.y });
  }

  // ── SCALE ──────────────────────────────────────────────────────
  const box3 = new THREE.Box3().setFromObject(root);
  root.scale.setScalar(cfg.height / (box3.max.y - box3.min.y));

  // ── ANIMATION ──────────────────────────────────────────────────
  let t = 0; let anim = 'idle'; let hop = 0;
  return {
    object: root,
    play(name) { anim = name; },
    poke()     { hop = 0.45; },
    update(dt) {
      t += dt;
      const walking = anim === 'walk';
      const talking = anim === 'talk';
      const freq    = walking ? 4.0 : 1.4;
      const amp     = walking ? 0.28 : 0.10;

      // Body segments ripple with increasing phase delay
      for (let i = 0; i < segments.length; i++) {
        const { seg, baseZ } = segments[i];
        const phase = i * 0.55; // phase delay per segment
        seg.position.x = Math.sin(t * freq + phase) * amp * (1 - i / NUM_SEGS * 0.4);
        // Slight vertical undulation
        seg.position.y = segments[i].baseY + Math.sin(t * freq * 0.5 + phase) * 0.04;
      }

      // Head sway follows lead of body
      head.position.x = Math.sin(t * freq) * amp * 0.60;
      head.rotation.z = -Math.sin(t * freq) * 0.15;

      // Tongue flick
      tongue.visible = Math.sin(t * 2.5) > 0.7;

      // Bounce
      let yOff = walking ? Math.abs(Math.sin(t * freq)) * 0.025 : Math.sin(t * 1.4) * 0.012;
      if (hop > 0) { hop -= dt; yOff += Math.sin((1 - hop / 0.45) * Math.PI) * 0.30; }
      rig.position.y = yOff;

      // Head during talk: nod while still swaying
      if (talking) {
        head.rotation.x = Math.sin(t * 10) * 0.09;
      } else {
        head.rotation.x = Math.sin(t * 1.0) * 0.03;
      }
    }
  };
}

// ---------------------------------------------------------------------------
// Monkey — grinning chimp based on reference image.
//
// Orientation: face is on +Z axis (same as RoboDog). YAW makes +Z face the
// viewer, so the grin is front-on. Body walks in side-profile (±X).
//
// Key features from reference:
//   • Enormous round head (chibi) with huge wide grin (bottom 40% of face)
//   • Full row of large human-like teeth, upper + lower
//   • Small squinting happy eyes set high
//   • Big round plate ears on ±X sides
//   • Short compact upright body, light belly patch
//   • One arm pointing forward (+Z) — the "pointing at you" pose
//   • Long curling tail behind
// ---------------------------------------------------------------------------
function buildMonkey(cfg) {
  // ── Colour palette ──────────────────────────────────────────────────────
  const C_FUR      = 0x9a7040; // warm medium brown fur
  const C_FUR_D    = 0x6b4a20; // dark brown — top of head, back
  const C_FUR_L    = 0xc4955a; // lighter highlight — cheeks, crown
  const C_BELLY    = 0xe8c990; // pale cream belly / inner face
  const C_SKIN     = 0xd4906a; // bare skin tone — ears inside, muzzle
  const C_MUZZLE   = 0xf0c090; // very light muzzle face area
  const C_EYE_W    = 0xffffff;
  const C_EYE      = 0x6b3a0a; // warm brown iris
  const C_PUPIL    = 0x0a0a0a;
  const C_TOOTH    = 0xf5f0d8; // slightly cream teeth
  const C_GUM_U    = 0xc06060; // upper gum / inner top of mouth
  const C_GUM_L    = 0xd07070; // lower gum / inner bottom
  const C_DARK     = 0x3a2008; // nostril / brow shadow
  const C_TAIL     = 0x8b6914; // tail same as fur

  const root = new THREE.Group();
  const rig  = new THREE.Group();
  root.add(rig);

  // ── BODY ─────────────────────────────────────────────────────────────────
  const body = new THREE.Group();
  body.position.set(0, 0.55, 0);
  rig.add(body);

  // Barrel torso
  body.add(mesh(SPHERE, C_FUR,   [0,  0.02, 0],    [0.38, 0.45, 0.34])); // back/torso
  body.add(mesh(SPHERE, C_BELLY, [0, -0.04, 0.18], [0.26, 0.36, 0.18])); // pale belly patch
  // Shoulder humps
  for (const sx of [-1, 1]) {
    body.add(mesh(SPHERE, C_FUR_D, [0, 0.20, sx * 0.28], [0.20, 0.18, 0.16])); // shoulder hump
  }

  // ── NECK ──────────────────────────────────────────────────────────────────
  const neck = new THREE.Group();
  neck.position.set(0, 0.40, 0.10);
  neck.rotation.x = -0.25;
  body.add(neck);
  neck.add(mesh(SPHERE, C_FUR, [0, 0.10, 0], [0.18, 0.18, 0.18]));

  // ── HEAD — huge, round, forward-facing +X after YAW ───────────────────────
  const head = new THREE.Group();
  head.position.set(0, 0.48, 0.22);
  body.add(head);

  // Big round skull
  head.add(mesh(SPHERE, C_FUR,   [0,  0.08,  0],    [0.46, 0.44, 0.44])); // skull dome
  head.add(mesh(SPHERE, C_FUR_D,  [0,  0.22, -0.04], [0.30, 0.14, 0.30])); // top fur tuft

  // Face disc (flatter, lighter skin area in front +Z of head group →
  // after YAW this becomes the viewer-facing +X)
  head.add(mesh(SPHERE, C_BELLY, [0,  0.02,  0.32], [0.30, 0.34, 0.18])); // face disc

  // ── MUZZLE — wide protruding dome with big grin ───────────────────────────
  const muzzle = new THREE.Group();
  muzzle.position.set(0, -0.06, 0.38);
  head.add(muzzle);

  muzzle.add(mesh(SPHERE, C_MUZZLE, [0,  0.04, 0.06], [0.28, 0.18, 0.18])); // upper muzzle
  muzzle.add(mesh(SPHERE, C_MUZZLE, [0, -0.08, 0.06], [0.30, 0.12, 0.16])); // lower jaw dome
  // Nostrils
  muzzle.add(mesh(SPHERE, C_DARK, [-0.06, 0.04, 0.16], [0.040, 0.030, 0.025]));
  muzzle.add(mesh(SPHERE, C_DARK, [ 0.06, 0.04, 0.16], [0.040, 0.030, 0.025]));

  // ── GRIN — inner mouth + row of teeth ─────────────────────────────────────
  // Inner mouth cavity
  muzzle.add(mesh(SPHERE, C_GUM_U, [0, -0.04, 0.14], [0.24, 0.08, 0.12])); // gum base

  // Upper teeth row (5 teeth, evenly spaced in Z axis = left-right when viewed after YAW)
  const upperTeeth = new THREE.Group();
  upperTeeth.position.set(0, 0.01, 0.14);
  muzzle.add(upperTeeth);
  for (let i = -2; i <= 2; i++) {
    upperTeeth.add(mesh(SPHERE, C_TOOTH,
      [0, 0, i * 0.048],
      [0.038, 0.055, 0.036]));
  }

  // Lower teeth row
  const lowerTeeth = new THREE.Group();
  lowerTeeth.position.set(0, -0.07, 0.14);
  muzzle.add(lowerTeeth);
  for (let i = -2; i <= 2; i++) {
    lowerTeeth.add(mesh(SPHERE, C_TOOTH,
      [0, 0, i * 0.048],
      [0.034, 0.046, 0.030]));
  }

  // Cheek puff spheres (big smile cheeks)
  for (const sz of [-1, 1]) {
    head.add(mesh(SPHERE, C_SKIN, [0, -0.02, sz * 0.28], [0.12, 0.10, 0.10]));
  }

  // ── EYES ──────────────────────────────────────────────────────────────────
  for (const sz of [-1, 1]) {
    head.add(mesh(SPHERE, C_EYE_W, [0,  0.14, sz * 0.18], [0.095, 0.095, 0.060]));
    head.add(mesh(SPHERE, C_EYE,   [0,  0.14, sz * 0.19], [0.062, 0.068, 0.048]));
    head.add(mesh(SPHERE, C_PUPIL, [0,  0.14, sz * 0.196],[0.028, 0.032, 0.022]));
    head.add(mesh(SPHERE, 0xffffff,[0,  0.165,sz * 0.204],[0.014, 0.014, 0.010])); // sparkle
    // Brow ridge
    head.add(mesh(SPHERE, C_DARK,  [0.04, 0.22, sz * 0.16],[0.08, 0.030, 0.070]));
  }

  // ── EARS — big round plates on ±Z sides ──────────────────────────────────
  for (const sz of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.set(0, 0.12, sz * 0.42);
    head.add(ear);
    ear.add(mesh(SPHERE, C_FUR,  [0, 0, 0],     [0.18, 0.22, 0.06])); // outer ear
    ear.add(mesh(SPHERE, C_SKIN, [0, 0, sz*0.04],[0.13, 0.16, 0.04])); // inner skin
  }

  // ── ARMS — long, reaching the ground for knuckle-walk ────────────────────
  const arms = [];
  for (const lx of [-1, 1]) {
    // Front arm (+X) and rear arm (-X) to match side-profile
    const shoulder = new THREE.Group();
    shoulder.position.set(lx * 0.22, 0.08, 0);
    body.add(shoulder);
    shoulder.add(mesh(SPHERE, C_FUR, [0, 0, 0], [0.14, 0.14, 0.14])); // shoulder ball

    const upper = new THREE.Group();
    shoulder.add(upper);
    upper.add(mesh(SPHERE, C_FUR, [0, -0.18, 0], [0.11, 0.32, 0.11])); // upper arm

    const elbow = new THREE.Group();
    elbow.position.set(0, -0.34, 0);
    upper.add(elbow);
    elbow.add(mesh(SPHERE, C_FUR, [0, 0, 0], [0.10, 0.10, 0.10]));

    const forearm = new THREE.Group();
    forearm.rotation.x = 0.5; // bent forward
    elbow.add(forearm);
    forearm.add(mesh(SPHERE, C_FUR, [0, -0.18, 0], [0.09, 0.32, 0.09]));

    const hand = new THREE.Group();
    hand.position.set(0, -0.34, 0);
    forearm.add(hand);
    hand.add(mesh(SPHERE, C_SKIN, [0, -0.04, 0.04], [0.12, 0.08, 0.14])); // palm
    // Fingers — 3 short knuckles pointing down/forward
    for (let f = -1; f <= 1; f++) {
      hand.add(mesh(SPHERE, C_SKIN, [0, -0.09, f * 0.046], [0.038, 0.070, 0.036]));
    }

    arms.push({ shoulder, upper, forearm, lx, phase: lx > 0 ? 0 : Math.PI });
  }

  // ── LEGS — shorter, bow-legged ────────────────────────────────────────────
  const legs = [];
  for (const lx of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(lx * 0.16, -0.32, 0);
    body.add(hip);
    hip.add(mesh(SPHERE, C_FUR, [0, 0, 0], [0.12, 0.12, 0.12]));

    const upper = new THREE.Group();
    upper.rotation.z = lx * 0.20; // bow-legged splay
    hip.add(upper);
    upper.add(mesh(SPHERE, C_FUR, [0, -0.14, 0], [0.10, 0.26, 0.10]));

    const knee = new THREE.Group();
    knee.position.set(0, -0.28, 0);
    upper.add(knee);
    const lower = new THREE.Group();
    lower.rotation.x = 0.30; // knee bent
    knee.add(lower);
    lower.add(mesh(SPHERE, C_FUR, [0, -0.12, 0], [0.08, 0.22, 0.08]));

    const foot = new THREE.Group();
    foot.position.set(0, -0.24, 0.04);
    lower.add(foot);
    foot.add(mesh(SPHERE, C_SKIN, [0, -0.04, 0.04], [0.12, 0.07, 0.16])); // sole
    foot.add(mesh(SPHERE, C_SKIN, [0, -0.04, 0.14], [0.06, 0.05, 0.05])); // big toe

    legs.push({ hip, upper, lower, foot, lx, phase: lx > 0 ? 0 : Math.PI });
  }

  // ── TAIL — long, 4-segment curl ───────────────────────────────────────────
  const tailRoot = new THREE.Group();
  tailRoot.position.set(0, 0.10, -0.36);
  tailRoot.rotation.x = -0.6;
  body.add(tailRoot);

  const tailSegs = [];
  let parent = tailRoot;
  const segData = [
    { len: 0.28, r: 0.07, rx: -0.55 },
    { len: 0.24, r: 0.060, rx: -0.50 },
    { len: 0.20, r: 0.048, rx: -0.60 },
    { len: 0.15, r: 0.034, rx: -0.70 },
  ];
  for (const sd of segData) {
    const seg = new THREE.Group();
    seg.rotation.x = sd.rx;
    parent.add(seg);
    seg.add(mesh(SPHERE, C_TAIL, [0, sd.len / 2, 0], [sd.r, sd.len, sd.r]));
    seg.add(mesh(SPHERE, C_FUR_D, [0, sd.len, 0], [sd.r * 1.2, sd.r * 1.2, sd.r * 1.2]));
    tailSegs.push(seg);
    const pivot = new THREE.Group();
    pivot.position.set(0, sd.len, 0);
    seg.add(pivot);
    parent = pivot;
  }

  // ── SCALE ──────────────────────────────────────────────────────────────────
  const box3 = new THREE.Box3().setFromObject(root);
  root.scale.setScalar(cfg.height / (box3.max.y - box3.min.y));

  // ── ANIMATION ─────────────────────────────────────────────────────────────
  let t = 0; let anim = 'idle'; let hop = 0;

  return {
    object: root,
    play(name) { anim = name; },
    poke()     { hop = 0.50; },
    update(dt) {
      t += dt;
      const walking = anim === 'walk';
      const talking = anim === 'talk';
      const k = Math.min(1, dt * 9);
      const freq = walking ? 7.0 : 1.8;

      // ── Arm swing (knuckle-walk — big arcs) ───────────────────────────────
      for (const arm of arms) {
        const s = Math.sin(t * freq + arm.phase);
        const shoulderTarget = walking
          ? s * 0.70                          // large fore-aft swing
          : Math.sin(t * 1.4 + arm.phase * 0.3) * 0.06;
        arm.shoulder.rotation.x += (shoulderTarget - arm.shoulder.rotation.x) * k;

        const forearmTarget = walking
          ? 0.40 + Math.max(0, s) * 0.55     // bend more on back-swing
          : 0.50;
        arm.forearm.rotation.x += (forearmTarget - arm.forearm.rotation.x) * k;
      }

      // ── Legs (short, bow, bounce) ─────────────────────────────────────────
      for (const leg of legs) {
        const s = Math.sin(t * freq + leg.phase);
        if (walking) {
          leg.upper.rotation.x += (s * 0.50 - leg.upper.rotation.x) * k;
          leg.lower.rotation.x += ((0.30 + Math.max(0, s) * 0.25) - leg.lower.rotation.x) * k;
        } else {
          leg.upper.rotation.x += (0    - leg.upper.rotation.x) * k;
          leg.lower.rotation.x += (0.30 - leg.lower.rotation.x) * k;
        }
      }

      // ── Body bounce (exaggerated knuckle-walk) ────────────────────────────
      let yOff = walking
        ? Math.abs(Math.sin(t * freq)) * 0.08 // big dip each step
        : Math.sin(t * 1.8) * 0.014;
      if (hop > 0) {
        hop -= dt;
        yOff += Math.sin((1 - hop / 0.50) * Math.PI) * 0.42;
      }
      rig.position.y = yOff;

      body.rotation.z = Math.sin(t * freq * 0.5) * (walking ? 0.05 : 0.012);

      // ── Tail wag — side-to-side with cascade ─────────────────────────────
      const wagSpeed = walking ? 7.0 : 2.5;
      const wagAmt   = walking ? 0.45 : 0.22;
      for (let i = 0; i < tailSegs.length; i++) {
        tailSegs[i].rotation.z = Math.sin(t * wagSpeed + i * 0.7) * wagAmt * (1 - i * 0.15);
      }

      // ── Head animation — huge grin expressions ────────────────────────────
      if (talking) {
        // Exaggerated nod + lateral sway = very expressive monkey talk
        head.rotation.z = Math.sin(t * 10) * 0.14;
        head.rotation.x = Math.sin(t * 7)  * 0.08;
        // Jaw drop on talk — animate lower jaw (lowerTeeth group Y)
        lowerTeeth.position.y = -0.07 + Math.sin(t * 10) * 0.025;
        muzzle.rotation.x     = Math.sin(t * 10) * 0.08; // jaw open
      } else if (walking) {
        head.rotation.x = Math.sin(t * freq) * 0.07;
        head.rotation.z = Math.sin(t * freq * 0.5) * 0.04;
        lowerTeeth.position.y = -0.07;
        muzzle.rotation.x = 0;
      } else {
        // Idle: slow head tilt, permanent big grin, occasional cheeky brow bounce
        head.rotation.x = Math.sin(t * 1.1) * 0.04;
        head.rotation.z = Math.sin(t * 0.7) * 0.06;
        lowerTeeth.position.y = -0.07;
        muzzle.rotation.x = Math.sin(t * 0.9) * 0.03;
      }
    }
  };
}

// ---------------------------------------------------------------------------
// GLB loader
// ---------------------------------------------------------------------------
async function buildGLB(cfg) {
  const gltf  = await new GLTFLoader().loadAsync(cfg.model);
  const model = gltf.scene;
  const root  = new THREE.Group();
  root.add(model);

  const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
  model.scale.setScalar(cfg.height / size.y);
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.set(-center.x, -box.min.y, -center.z);

  const mixer   = new THREE.AnimationMixer(model);
  const actions = {};
  for (const [key, clipName] of Object.entries(cfg.clips || {})) {
    const clip = gltf.animations.find((c) => c.name === clipName);
    if (clip) actions[key] = mixer.clipAction(clip);
    else console.warn(`[buddy] clip "${clipName}" not found in ${cfg.model}`);
  }
  let cur = null;
  return {
    object: root,
    play(name) {
      const next = actions[name] || actions.idle;
      if (!next || next === cur) return;
      next.reset().fadeIn(0.2).play();
      if (cur) cur.fadeOut(0.2);
      cur = next;
    },
    update(dt) { mixer.update(dt); }
  };
}

// ---------------------------------------------------------------------------
// Character wrapper
// ---------------------------------------------------------------------------
class Character {
  constructor(impl) {
    this.impl   = impl;
    this.object = impl.object;
    this.facing = 1;
    this.anim   = null;
    this.object.rotation.y = YAW;
  }
  get x()    { return this.object.position.x; }
  set x(v)   { this.object.position.x = v; }
  play(name) { if (name === this.anim) return; this.anim = name; this.impl.play(name); }
  face(dir)  { this.facing = dir >= 0 ? 1 : -1; }
  poke()     { if (this.impl.poke) this.impl.poke(); }
  update(dt) {
    const target = this.facing > 0 ? YAW : -YAW;
    this.object.rotation.y += (target - this.object.rotation.y) * Math.min(1, dt * 10);
    this.impl.update(dt);
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export async function createCharacter(cfg) {
  let impl = null;
  if (cfg.model) {
    try { impl = await buildGLB(cfg); }
    catch (err) { console.error(`[buddy] could not load ${cfg.model}, using placeholder:`, err); }
  }
  if (!impl) {
    if      (cfg.kind === 'roboDog')     impl = buildRoboDog(cfg);
    else if (cfg.kind === 'penguin')     impl = buildPenguin(cfg);
    else if (cfg.kind === 'astronaut')   impl = buildAstronaut(cfg);
    else if (cfg.kind === 'rubberDuck')  impl = buildRubberDuck(cfg);
    else if (cfg.kind === 'coffeeCup')   impl = buildCoffeeCup(cfg);
    else if (cfg.kind === 'debugBug')    impl = buildDebugBug(cfg);
    else if (cfg.kind === 'terminalBot') impl = buildTerminalBot(cfg);
    else if (cfg.kind === 'nightOwl')    impl = buildNightOwl(cfg);
    else if (cfg.kind === 'pythonSnake') impl = buildPythonSnake(cfg);
    else if (cfg.kind === 'monkey')      impl = buildMonkey(cfg);
    else                                 impl = buildAnimal(cfg);
  }
  return new Character(impl);
}

