Drop your own .glb files here, then point renderer/config.js at them:

  mouse: { kind: 'mouse', height: 110, model: '../assets/models/mouse.glb',
           clips: { idle: 'Idle', walk: 'Walk', talk: 'Talk' } }

- Models should face +Z (the glTF default) with feet near y = 0; they are auto-scaled to `height` px.
- `clips` maps the app's three states to animation clip names inside your file.
  Missing clips fall back to "idle"; a model that fails to load falls back to the built-in placeholder.
- Tom & Jerry are Warner Bros. IP: fine for a private build on your own machine, not for sharing
  or distributing. Use original characters for anything shared or internal to an organisation.
