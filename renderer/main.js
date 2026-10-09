import * as THREE from 'three';
import { CONFIG } from './config.js';
import { createCharacter } from './characters.js';

const canvas = document.getElementById('stage');
const bubble = document.getElementById('bubble');
const msgEl  = document.getElementById('msg');

// ---- Scene: orthographic camera in pixel units, origin at bottom-left of the work area ----
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
renderer.setClearColor(0x000000, 0);
renderer.setPixelRatio(window.devicePixelRatio);

const scene  = new THREE.Scene();
const camera = new THREE.OrthographicCamera(0, 1, 1, 0, -2000, 2000);
camera.position.z = 1000;
scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.7));
const sun = new THREE.DirectionalLight(0xffffff, 1.8);
sun.position.set(-300, 600, 800);
scene.add(sun);

function resize() {
  camera.right = window.innerWidth;
  camera.top   = window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  if (!active) renderer.render(scene, camera);
}

// ---- Character management ----
// lead  = the active reminder character; chase = cat (only with mouse)
const [mouse, cat, roboDog, coffeeCup, pythonSnake, monkey, mrBean] =
  await Promise.all([
    createCharacter(CONFIG.mouse),
    createCharacter(CONFIG.cat),
    createCharacter(CONFIG.roboDog),
    createCharacter(CONFIG.coffeeCup),
    createCharacter(CONFIG.pythonSnake),
    createCharacter(CONFIG.monkey),
    createCharacter(CONFIG.mrBean),
  ]);

// Map of id → character object for quick lookup
const CHAR_MAP = {
  mouse, roboDog, coffeeCup, pythonSnake, monkey, mrBean
};

for (const ch of Object.values(CHAR_MAP)) ch.object.visible = false;
cat.object.visible = false;
scene.add(cat.object, ...Object.values(CHAR_MAP).map((c) => c.object));

// Active lead and whether the cat chaser is used
let lead   = roboDog;
let useCat = false;

function setActiveCharacter(name) {
  const next = CHAR_MAP[name] || mouse;
  if (next === lead) return;
  // If mid-animation, abort current sequence and restart with new character
  if (active && state !== 'hidden') {
    lead.object.visible = false;
    cat.object.visible  = false;
    lead   = next;
    useCat = (name === 'mouse');
    console.info('[buddy] character (live switch) ->', name);
    // Re-enter walkIn with the new character immediately
    go('walkIn');
    return;
  }
  lead.object.visible = false;
  cat.object.visible  = false;
  lead   = next;
  useCat = (name === 'mouse');
  console.info('[buddy] character ->', name);
}

// ---- State machine: hidden -> walkIn -> speak -> waitAck -> walkOut -> hidden ----
let state         = 'hidden';
let stateTime     = 0;
let current       = null;
let pendingAction = null;
let active        = false;
let stopX         = 400;

const OFFSCREEN = 260;
const STATES = {
  hidden: {},
  walkIn: {
    enter() {
      stopX  = Math.max(420, window.innerWidth * CONFIG.stopXRatio);
      lead.x = -OFFSCREEN;
      lead.object.visible = true;
      lead.face(1);
      lead.play('walk');
      if (useCat) {
        cat.x = -OFFSCREEN - CONFIG.chaseGap * 2;
        cat.object.visible = true;
        cat.face(1);
      }
    },
    update(dt) {
      lead.x += CONFIG.speed * dt;
      if (lead.x >= stopX) go('speak');
    }
  },
  speak: {
    enter()  { lead.play('talk'); showBubble(current.text); },
    update() { if (stateTime >= CONFIG.speakSeconds) go('waitAck'); }
  },
  waitAck: {
    enter()  { lead.play('idle'); },
    update() { if (stateTime >= CONFIG.autoSnoozeSeconds) finish('snooze'); }
  },
  walkOut: {
    enter()  { lead.face(1); lead.play('walk'); },
    update(dt) {
      lead.x += CONFIG.speed * 1.15 * dt;
      const done = useCat
        ? cat.x > window.innerWidth + OFFSCREEN
        : lead.x > window.innerWidth + OFFSCREEN;
      if (done) go('hidden');
    }
  }
};

function go(next) {
  state     = next;
  stateTime = 0;
  console.info('[buddy] state ->', next);
  if (STATES[next].enter) STATES[next].enter();
  if (next === 'hidden') endSequence();
}

function finish(action) {
  if (state !== 'speak' && state !== 'waitAck') return;
  pendingAction = action;
  hideBubble();
  go('walkOut');
}

function endSequence() {
  lead.object.visible = false;
  cat.object.visible  = false;
  renderer.render(scene, camera);
  active = false;
  setIgnore(true);
  const payload = { id: current.id, action: pendingAction || 'done' };
  current       = null;
  pendingAction = null;
  window.buddy.sendAction(payload);
}

// ---- Chaser follows the lead with a lag (only when useCat) ----
function updateChaser(dt) {
  if (!useCat) return;
  const target = lead.x - CONFIG.chaseGap;
  const prev   = cat.x;
  cat.x += (target - cat.x) * Math.min(1, CONFIG.chaseStiffness * dt);
  const speed = Math.abs(cat.x - prev) / Math.max(dt, 1e-3);
  cat.play(speed > 12 ? 'walk' : 'idle');
}

// ---- Speech bubble ----
let bubbleVisible = false;
function leadHeight() {
  // Return configured height for the current lead character
  const cfgKey = Object.entries(CHAR_MAP).find(([, ch]) => ch === lead)?.[0];
  return cfgKey && CONFIG[cfgKey] ? CONFIG[cfgKey].height : CONFIG.mouse.height;
}

function showBubble(text) {
  msgEl.textContent = text;
  bubble.style.display = 'block';
  bubbleVisible = true;
  const w    = bubble.offsetWidth;
  const left = Math.min(Math.max(lead.x - 30, 8), window.innerWidth - w - 8);
  bubble.style.left   = `${left}px`;
  bubble.style.bottom = `${leadHeight() + 22}px`;
  bubble.style.setProperty('--tail', `${Math.min(Math.max(lead.x - left - 9, 14), w - 32)}px`);
}
function hideBubble() {
  bubble.style.display = 'none';
  bubbleVisible = false;
}
document.getElementById('done').addEventListener('click',   () => finish('done'));
document.getElementById('snooze').addEventListener('click', () => finish('snooze'));

// ---- Click-through ----
let ignoring = true;
function setIgnore(v) {
  if (v === ignoring) return;
  ignoring = v;
  window.buddy.setIgnoreMouse(v);
}
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function hitCharacters(e) {
  ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  return {
    lead: ray.intersectObject(lead.object, true).length > 0,
    cat:  useCat && ray.intersectObject(cat.object, true).length > 0
  };
}
window.addEventListener('mousemove', (e) => {
  if (!active) return setIgnore(true);
  const r = bubble.getBoundingClientRect();
  const overBubble = bubbleVisible &&
    e.clientX >= r.left && e.clientX <= r.right &&
    e.clientY >= r.top  && e.clientY <= r.bottom;
  const hit = hitCharacters(e);
  setIgnore(!(overBubble || hit.lead || hit.cat));
});
window.addEventListener('pointerdown', (e) => {
  if (!active) return;
  const hit = hitCharacters(e);
  if (hit.cat)  cat.poke();
  if (hit.lead) lead.poke();
});

// ---- Character switching via IPC ----
window.buddy.onCharacterSet((name) => {
  setActiveCharacter(name);
});

// ---- Render loop ----
let last = 0;
function frame(now) {
  if (!active) return;
  requestAnimationFrame(frame);
  const dt = (now - last) / 1000;
  if (dt < 1 / (CONFIG.fpsCap + 2)) return;
  last = now;
  const step = Math.min(dt, 0.1);
  stateTime += step;
  if (STATES[state].update) STATES[state].update(step);
  updateChaser(step);
  lead.update(step);
  if (useCat) cat.update(step);
  renderer.render(scene, camera);
}

function show(reminder) {
  current       = reminder;
  pendingAction = null;
  active        = true;
  last          = performance.now();
  requestAnimationFrame(frame);
  go('walkIn');
}

window.addEventListener('resize', resize);
resize();
window.buddy.onReminder(show);
window.buddy.ready();
console.info('[buddy] renderer ready');
