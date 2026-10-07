'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('buddy', {
  ready:          () => ipcRenderer.send('renderer:ready'),
  onReminder:     (cb) => ipcRenderer.on('reminder:show',    (_e, reminder) => cb(reminder)),
  sendAction:     (payload) => ipcRenderer.send('reminder:action', payload),
  setIgnoreMouse: (ignore) => ipcRenderer.send('overlay:ignore-mouse', Boolean(ignore)),
  onCharacterSet: (cb) => ipcRenderer.on('character:set', (_e, name) => cb(name))
});
