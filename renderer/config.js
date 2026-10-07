// Tunables. Pixel units are CSS px on the primary display.
//
// To use your own 3D models, drop .glb files into assets/models/ and set `model`
// (path is relative to renderer/index.html) plus the animation clip names inside the file.
//   mouse: { kind: 'mouse', height: 110, model: '../assets/models/mouse.glb',
//            clips: { idle: 'Idle', walk: 'Walk', talk: 'Talk' } }
// If a model fails to load, the procedural placeholder is used instead.
export const CONFIG = {
  speed: 280,              // px/s, lead character walking speed
  stopXRatio: 0.3,         // where the lead stops, as a fraction of screen width
  chaseGap: 190,           // px the chaser tries to stay behind the lead
  chaseStiffness: 3,       // higher = chaser catches up faster
  speakSeconds: 2.5,       // lead "talks" this long after arriving
  autoSnoozeSeconds: 120,  // if ignored this long, snooze automatically
  fpsCap: 30,

  mouse: { kind: 'mouse', height: 110, model: null, clips: { idle: 'Idle', walk: 'Walk', talk: 'Talk' } },
  cat:   { kind: 'cat',   height: 230, model: null, clips: { idle: 'Idle', walk: 'Walk', talk: 'Talk' } },

  // RoboDog — animated 3-D cartoon robot dog. Procedural; swap `model` for a .glb
  // with Idle/Walk/Talk clips (see assets/models/README.md).
  roboDog:     { kind: 'roboDog',     height: 240, model: null, clips: { idle: 'Idle', walk: 'Walk', talk: 'Talk' } },
  penguin:     { kind: 'penguin',     height: 160, model: null, clips: { idle: 'Idle', walk: 'Walk', talk: 'Talk' } },
  astronaut:   { kind: 'astronaut',   height: 220, model: null, clips: { idle: 'Idle', walk: 'Walk', talk: 'Talk' } },
  rubberDuck:  { kind: 'rubberDuck',  height: 130, model: null, clips: { idle: 'Idle', walk: 'Walk', talk: 'Talk' } },
  coffeeCup:   { kind: 'coffeeCup',   height: 150, model: null, clips: { idle: 'Idle', walk: 'Walk', talk: 'Talk' } },
  debugBug:    { kind: 'debugBug',    height: 110, model: null, clips: { idle: 'Idle', walk: 'Walk', talk: 'Talk' } },
  terminalBot: { kind: 'terminalBot', height: 210, model: null, clips: { idle: 'Idle', walk: 'Walk', talk: 'Talk' } },
  nightOwl:    { kind: 'nightOwl',    height: 175, model: null, clips: { idle: 'Idle', walk: 'Walk', talk: 'Talk' } },
  pythonSnake: { kind: 'pythonSnake', height: 140, model: null, clips: { idle: 'Idle', walk: 'Walk', talk: 'Talk' } },

  // Which character is active — persisted via userData/state.json (written by tray menu).
  activeCharacter: 'roboDog'
};
