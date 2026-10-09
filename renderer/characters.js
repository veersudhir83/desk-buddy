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
// Mr. Bean — iconic British comedy character
//
// Orientation — EXACTLY matches Monkey / RoboDog convention:
//   • YAW rotates +Z to face the viewer.
//   • Legs:  front pivot at +X, rear pivot at −X  (swing on X-rotation).
//   • Arms:  front shoulder at +X, rear shoulder at −X  (swing on X-rotation).
//   • Face:  eyes / brows / nose / mouth all centred on z > 0 (viewer-facing).
//            Left/right eye separation = ±Z  (e.g. sz * 0.14).
//   • Ears:  on ±Z extremes of the head (sz * 0.26).
//   • Shoes: toe cap pushed forward along +X (walk direction).
// ---------------------------------------------------------------------------
function buildMrBean(cfg) {
  // ── Colour palette ─────────────────────────────────────────────────────
  const C_SKIN      = 0xf0c090;
  const C_SKIN_D    = 0xd4906a;
  const C_HAIR      = 0x2c1808;
  const C_SUIT      = 0x7a6545;
  const C_SUIT_D    = 0x4e3d22;
  const C_SHIRT     = 0xf2f0ec;
  const C_TIE       = 0xb82020;
  const C_TROUSER   = 0x22223a;
  const C_SHOE      = 0x140c04;
  const C_SOLE      = 0x0a0604;
  const C_EYE_W     = 0xffffff;
  const C_EYE       = 0x6b4020;
  const C_PUPIL     = 0x080808;
  const C_BROW      = 0x180a02;
  const C_MOUTH     = 0xc05838;
  const C_TEDDY     = 0xc8a050;
  const C_TEDDY_D   = 0x8a6030;
  const C_TEDDY_EYE = 0x180800;

  const root = new THREE.Group();
  const rig  = new THREE.Group();
  root.add(rig);

  // ── LEGS — front at +X, rear at −X, swing on X-rotation ─────────────
  const legs = [];
  for (const [lx, phase] of [[1, 0], [-1, Math.PI]]) {
    const pivot = new THREE.Group();
    pivot.position.set(lx * 0.10, 0.30, 0);
    rig.add(pivot);

    pivot.add(meshP(CYL,    C_TROUSER, [0, -0.17, 0],   [0.09, 0.34, 0.09])); // thigh
    pivot.add(meshP(SPHERE, C_TROUSER, [0, -0.34, 0],   [0.08, 0.08, 0.08])); // knee
    pivot.add(meshP(CYL,    C_TROUSER, [0, -0.50, 0],   [0.08, 0.30, 0.08])); // shin
    pivot.add(meshP(SPHERE, C_SHOE,    [0, -0.66, 0],   [0.08, 0.08, 0.08])); // ankle
    // shoe toe elongated along +X (walk direction)
    pivot.add(meshP(SPHERE, C_SHOE,    [0.09, -0.68, 0],[0.20, 0.055, 0.08]));
    pivot.add(meshP(SPHERE, C_SOLE,    [0.08, -0.71, 0],[0.21, 0.018, 0.085]));

    legs.push({ pivot, phase });
  }

  // ── TORSO ────────────────────────────────────────────────────────────
  const body = new THREE.Group();
  body.position.set(0, 0.64, 0);
  rig.add(body);

  body.add(meshP(SPHERE, C_SUIT,   [0,  0.04, 0.00],  [0.28, 0.44, 0.20])); // jacket
  body.add(meshP(SPHERE, C_SHIRT,  [0,  0.06, 0.15],  [0.13, 0.28, 0.10])); // shirt
  // lapels on +Z face
  body.add(meshP(SPHERE, C_SUIT_D, [0,  0.14, 0.14],  [0.055, 0.20, 0.048])); // left lapel
  body.add(meshP(SPHERE, C_SUIT_D, [0,  0.14,-0.14],  [0.055, 0.20, 0.048])); // right lapel
  // tie
  body.add(meshP(SPHERE, C_TIE,    [0,  0.04, 0.18],  [0.030, 0.30, 0.020]));
  body.add(meshP(SPHERE, C_TIE,    [0,  0.20, 0.17],  [0.044, 0.044, 0.030])); // knot
  // buttons
  for (let i = 0; i < 3; i++) {
    body.add(meshP(SPHERE, 0x111111, [0, 0.04 - i * 0.10, 0.19], [0.015, 0.015, 0.011]));
  }

  // ── ARMS — front shoulder at +X, rear shoulder at −X ─────────────────
  // Exactly like Monkey: shoulder.position.set(lx * 0.24, 0.24, 0)
  const arms = [];
  for (const [lx, holdsTeddy, phase] of [[1, false, 0], [-1, true, Math.PI]]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(lx * 0.24, 0.24, 0);
    body.add(shoulder);
    shoulder.add(meshP(SPHERE, C_SUIT, [0, 0, 0], [0.095, 0.095, 0.095]));

    const upper = new THREE.Group();
    shoulder.add(upper);
    upper.add(meshP(CYL,    C_SUIT, [0, -0.12, 0], [0.075, 0.24, 0.075]));
    upper.add(meshP(SPHERE, C_SUIT, [0, -0.24, 0], [0.068, 0.068, 0.068])); // elbow

    const elbow = new THREE.Group();
    elbow.position.set(0, -0.24, 0);
    upper.add(elbow);

    const forearm = new THREE.Group();
    // teddy arm bends forward (+Z) to cradle; free arm hangs naturally
    forearm.rotation.x = holdsTeddy ? -0.85 : 0;
    elbow.add(forearm);
    forearm.add(meshP(CYL,    C_SUIT, [0, -0.09, 0], [0.065, 0.18, 0.065]));

    const hand = new THREE.Group();
    hand.position.set(0, -0.18, 0);
    forearm.add(hand);
    // palm — push slightly toward +Z (viewer) so it's visible
    hand.add(meshP(SPHERE, C_SKIN, [0, -0.02, 0.04], [0.070, 0.045, 0.085]));
    for (let f = -1; f <= 1; f++) {
      hand.add(meshP(SPHERE, C_SKIN, [0, -0.06, f * 0.026 + 0.04], [0.024, 0.044, 0.022]));
    }

    arms.push({ upper, forearm, holdsTeddy, phase });
  }

  // ── TEDDY BEAR — on rear arm (−X shoulder), cradled in bent forearm ──
  const teddy = new THREE.Group();
  teddy.position.set(0, -0.20, 0.10);
  arms[1].forearm.add(teddy);

  teddy.add(meshP(SPHERE, C_TEDDY,     [0,  0.00, 0],    [0.088, 0.095, 0.078]));
  teddy.add(meshP(SPHERE, C_TEDDY,     [0, -0.06, 0.01], [0.058, 0.058, 0.050]));
  const tHead = new THREE.Group();
  tHead.position.set(0, 0.105, 0.01);
  teddy.add(tHead);
  tHead.add(meshP(SPHERE, C_TEDDY,     [0,  0,    0],    [0.075, 0.072, 0.068]));
  tHead.add(meshP(SPHERE, C_TEDDY_D,   [0,  0.01, 0.052],[0.035, 0.028, 0.023]));
  for (const sz of [-1, 1]) {
    tHead.add(meshP(SPHERE, C_TEDDY,     [0, 0.052, sz * 0.058],[0.026, 0.026, 0.017]));
    tHead.add(meshP(SPHERE, C_TEDDY_EYE, [0, 0.016, sz * 0.032],[0.011, 0.011, 0.008]));
  }
  for (const sz of [-1, 1]) {
    teddy.add(meshP(SPHERE, C_TEDDY, [0, 0.030, sz * 0.088], [0.034, 0.050, 0.030]));
  }

  // ── NECK ──────────────────────────────────────────────────────────────
  const neck = new THREE.Group();
  neck.position.set(0, 0.46, 0.04);
  body.add(neck);
  neck.add(meshP(CYL,    C_SKIN,  [0, 0.07, 0],  [0.088, 0.13, 0.088]));
  neck.add(meshP(SPHERE, C_SHIRT, [0, 0.00, 0],  [0.105, 0.065, 0.095]));

  // ── HEAD ─────────────────────────────────────────────────────────────
  // Cartoon Mr. Bean: large forward-facing head, all face features clearly
  // on the +Z face (viewer-facing after YAW).
  // Eyes use layered spheres at increasing z (RoboDog style).
  // Left/right eye separation = sz * 0.13 in Z.
  // Nose protrudes to z ≈ 0.38. Mouth at z ≈ 0.28.
  const head = new THREE.Group();
  head.position.set(0, 0.50, 0.06);
  body.add(head);

  // Skull — tall oval, Z-scale 0.32 so front face at z ≈ +0.32
  head.add(meshP(SPHERE, C_SKIN, [0,  0.10,  0.02], [0.26, 0.36, 0.32]));
  head.add(meshP(SPHERE, C_SKIN, [0, -0.06,  0.08], [0.18, 0.16, 0.24])); // chin juts forward

  // Hair — very dark, thick quiff swept forward
  head.add(meshP(SPHERE, C_HAIR, [0,  0.34,  0.04], [0.22, 0.10, 0.22]));
  head.add(meshP(SPHERE, C_HAIR, [0,  0.37,  0.14], [0.15, 0.09, 0.13])); // quiff tip
  head.add(meshP(SPHERE, C_HAIR, [0,  0.30, -0.08], [0.20, 0.07, 0.18]));
  head.add(meshP(SPHERE, C_HAIR, [0,  0.26, -0.14], [0.18, 0.055, 0.16]));

  // Face disc — lighter flat circle on the forward face surface
  head.add(meshP(SPHERE, C_SKIN, [0,  0.06,  0.28], [0.22, 0.30, 0.10]));

  // ── EYES — layered spheres protruding forward (RoboDog style) ─────────
  // sz = ±1 gives left/right eye (±Z = ±left/right after YAW)
  // Base z of each eye = sz * 0.13 (lateral offset)
  // Forward protrusion stacks: socket at z+0.26, white at z+0.30, iris at z+0.34
  const brows = [];
  for (const sz of [-1, 1]) {
    const ez = sz * 0.13; // lateral centre of this eye
    // Dark socket ring (gives definition)
    head.add(meshP(SPHERE, C_BROW,   [0, 0.12, ez + 0.255], [0.112, 0.108, 0.044]));
    // White sclera
    head.add(meshP(SPHERE, C_EYE_W,  [0, 0.12, ez + 0.278], [0.098, 0.094, 0.050]));
    // Warm brown iris
    head.add(meshP(SPHERE, C_EYE,    [0, 0.12, ez + 0.296], [0.062, 0.066, 0.036]));
    // Pupil
    head.add(meshP(SPHERE, C_PUPIL,  [0, 0.12, ez + 0.310], [0.032, 0.034, 0.022]));
    // Sparkle
    head.add(meshP(SPHERE, 0xffffff, [0, 0.136,ez + 0.318], [0.013, 0.013, 0.009]));

    // ── Brow — very thick, almost black, arched ─────────────────────
    const brow = new THREE.Group();
    brow.position.set(0, 0.228, ez + 0.25);
    head.add(brow);
    brow.add(meshP(SPHERE, C_BROW, [0, 0, 0], [0.112, 0.034, 0.084])); // main bar
    brow.add(meshP(SPHERE, C_BROW, [0, 0.009, sz > 0 ? 0.05 : -0.05], [0.050, 0.026, 0.036])); // arch
    brows.push(brow);
  }

  // ── NOSE — long straight bridge, prominent bulbous tip ───────────────
  head.add(meshP(SPHERE, C_SKIN,   [0,  0.085, 0.28], [0.050, 0.110, 0.046])); // bridge
  head.add(meshP(SPHERE, C_SKIN,   [0,  0.010, 0.35], [0.064, 0.062, 0.060])); // tip
  head.add(meshP(SPHERE, C_SKIN,   [0, -0.010, 0.33], [0.070, 0.042, 0.054])); // lower nose
  head.add(meshP(SPHERE, C_SKIN_D, [0, -0.030, 0.33], [0.018, 0.012, 0.012])); // nostril dimple

  // ── MOUTH — thin pursed lips, Bean sardonic expression ───────────────
  const mouthGroup = new THREE.Group();
  mouthGroup.position.set(0, -0.060, 0.27);
  head.add(mouthGroup);
  mouthGroup.add(meshP(SPHERE, C_MOUTH, [0,  0.008, 0.02], [0.096, 0.022, 0.026])); // upper lip
  mouthGroup.add(meshP(SPHERE, C_MOUTH, [0, -0.018, 0.018],[0.082, 0.020, 0.023])); // lower lip
  // corners — downward quirk (slightly asymmetric)
  mouthGroup.add(meshP(SPHERE, C_MOUTH, [0, -0.006,  0.068],[0.020, 0.016, 0.016]));
  mouthGroup.add(meshP(SPHERE, C_MOUTH, [0, -0.010, -0.030],[0.020, 0.016, 0.016]));

  // ── EARS — on ±Z extremes ────────────────────────────────────────────
  for (const sz of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.set(0, 0.08, sz * 0.30);
    head.add(ear);
    ear.add(meshP(SPHERE, C_SKIN,   [0, 0, 0],         [0.050, 0.076, 0.030]));
    ear.add(meshP(SPHERE, C_SKIN_D, [0, 0, sz * 0.018],[0.034, 0.052, 0.018]));
  }

  // ── SCALE ────────────────────────────────────────────────────────────
  const box3 = new THREE.Box3().setFromObject(root);
  root.scale.setScalar(cfg.height / (box3.max.y - box3.min.y));

  // ── ANIMATION ────────────────────────────────────────────────────────
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
      const freq = 7.0;

      // Legs — X rotation fore/aft swing
      for (const leg of legs) {
        const target = walking ? Math.sin(t * freq + leg.phase) * 0.42 : 0;
        leg.pivot.rotation.x += (target - leg.pivot.rotation.x) * k;
      }

      // Arms — front arm swings, rear (teddy) arm stays bent forward
      for (const arm of arms) {
        if (arm.holdsTeddy) {
          const sway = Math.sin(t * (walking ? freq : 1.0) + arm.phase) * 0.04;
          arm.upper.rotation.x = -0.28 + sway;
        } else {
          const s = Math.sin(t * freq + arm.phase);
          const target = walking ? s * 0.42 : Math.sin(t * 1.1) * 0.03;
          arm.upper.rotation.x += (target - arm.upper.rotation.x) * k;
        }
      }

      // Body bounce
      let yOff = walking
        ? Math.abs(Math.sin(t * freq)) * 0.024
        : Math.sin(t * 1.5) * 0.007;
      if (hop > 0) { hop -= dt; yOff += Math.sin((1 - hop / 0.45) * Math.PI) * 0.30; }
      rig.position.y = yOff;
      body.rotation.z = Math.sin(t * freq * 0.5) * (walking ? 0.020 : 0.006);

      // Head animations
      if (talking) {
        head.rotation.x = Math.sin(t * 12) * 0.11;
        head.rotation.z = Math.sin(t * 7)  * 0.08;
        brows[0].rotation.z =  Math.sin(t * 9.5) * 0.34;
        brows[1].rotation.z = -Math.sin(t * 7.8) * 0.30;
        brows[0].position.y = 0.215 + Math.abs(Math.sin(t * 9.5)) * 0.017;
        brows[1].position.y = 0.215 + Math.abs(Math.sin(t * 7.8)) * 0.017;
        mouthGroup.rotation.x = Math.sin(t * 11) * 0.13;
      } else if (walking) {
        head.rotation.x = Math.sin(t * freq) * 0.055;
        head.rotation.z = 0;
        brows[0].rotation.z =  0.15;
        brows[1].rotation.z = -0.15;
        brows[0].position.y = brows[1].position.y = 0.215;
        mouthGroup.rotation.x = 0;
      } else {
        head.rotation.x = Math.sin(t * 0.8)  * 0.036;
        head.rotation.z = Math.sin(t * 0.55) * 0.046;
        const beatA = Math.sin(t * 0.65);
        const beatB = Math.sin(t * 0.90 + 1.0);
        brows[0].rotation.z =  0.06 + (beatA > 0.65 ?  0.26 : 0);
        brows[1].rotation.z = -0.06 + (beatB > 0.70 ? -0.22 : 0);
        brows[0].position.y = 0.215 + (beatA > 0.65 ? 0.019 : 0);
        brows[1].position.y = 0.215 + (beatB > 0.70 ? 0.013 : 0);
        mouthGroup.rotation.x = Math.sin(t * 1.2) * 0.022;
      }

      teddy.rotation.z = Math.sin(t * (walking ? freq : 1.6)) * 0.035;
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
    else if (cfg.kind === 'coffeeCup')   impl = buildCoffeeCup(cfg);
    else if (cfg.kind === 'pythonSnake') impl = buildPythonSnake(cfg);
    else if (cfg.kind === 'monkey')      impl = buildMonkey(cfg);
    else if (cfg.kind === 'mrBean')      impl = buildMrBean(cfg);
    else                                 impl = buildAnimal(cfg);
  }
  return new Character(impl);
}

