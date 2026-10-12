# Active Context — Desk Buddy

## Current Focus
Character appearance and animation polish. README and project memory synchronized with the current source on 2026-10-12.

## Latest Changes — 2026-10-12
- Both material helpers in `renderer/characters.js` now use `MeshPhongMaterial`: shininess 18 for soft surfaces and 48 for polished surfaces, with restrained specular highlights.
- Added `curveMesh()` for continuous tube curves and `eyeGroup()` for tagged blinking eye groups.
- Cat and mouse: warmer palettes, belly patches, layered eyes, highlights, blush, whiskers, and curved tails.
- Coffee cup: blinking eyes, highlights, blush, continuous smile, and translucent curved steam (opacity 0.36, depth writing disabled).
- Hoodie kid: blinking layered eyes, blush, warm button nose, and a continuous smile.
- Camera-facing characters turn slightly toward travel while walking and return to the camera for idle/talk, including leftward travel.
- Facing and selected gait transitions use exponential smoothing. Character updates clamp dt to 0–0.05 seconds; hop timers clamp at zero to prevent landing overshoot.
- Procedural models receive an outer grounding group so their resting bounds start at desktop y = 0 without changing configured height or animation pivots. GLB models retain their existing normalization.

## Current Character Inventory
Seven selectable characters: `mouse`, `roboDog`, `coffeeCup`, `pythonSnake`, `monkey`, `mrBean`, `hoodieKid`. `cat` is the mouse chaser, giving eight procedural models total. The default is `roboDog`.

## Active Decisions
- Preserve each character's silhouette and existing reminder behavior.
- `frontFacing` is per implementation. These characters start at yaw 0, walk at facing × 0.28 radians, and idle/talk at 0. Other characters use facing × `YAW`, where `YAW = Math.PI / 2 - 0.45`.
- Face placement follows each builder's geometry; do not apply the old universal +X-face rule.
- Blink only groups explicitly tagged with `userData.blink`; currently cat, mouse, coffee cup, and hoodie kid. Timings vary per character.
- Character switching during a reminder still immediately re-enters `walkIn`.

## Validation
- `node --check renderer/characters.js` passed.
- `npm test`: all 11 scheduler tests passed. The sandbox initially blocked Node's test subprocess with EPERM; rerunning with escalation passed.
- One-off Node checks passed for all eight procedural models: construction, configured height, resting grounding, finite walk/talk/idle poses, poke animation, large-dt handling, and idle camera-facing orientation where applicable. These checks were not added as committed tests.
- `git diff --check` passed for the character change.
- In-app visual review remains pending; no screenshots or GUI verification recorded.

## Next Steps
- Preview every character in `npm run demo`, including turning and click-to-hop behavior.
- Add screenshots after visual review.
- Existing roadmap: multi-monitor support, in-app reminder editor, macOS/Linux packaging.
