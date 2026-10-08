'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('assistant', {
  /** Get loaded AiDE credentials { baseUrl, token } from main process */
  getCredentials: () => ipcRenderer.invoke('assistant:get-credentials'),

  /**
   * Send conversation messages to main process; main streams AiDE response
   * back via 'assistant:token', 'assistant:done', 'assistant:error' events.
   * @param {Array<{role:string, content:string}>} messages
   */
  chat: (messages) => ipcRenderer.send('assistant:chat', messages),

  /** Receive a streamed token from AiDE */
  onToken:  (cb) => ipcRenderer.on('assistant:token',  (_e, token)    => cb(token)),
  /** Receive stream-complete signal with full accumulated text */
  onDone:   (cb) => ipcRenderer.on('assistant:done',   (_e, fullText) => cb(fullText)),
  /** Receive stream error message */
  onError:  (cb) => ipcRenderer.on('assistant:error',  (_e, message)  => cb(message)),

  /** Remove all streaming listeners (call before each new request to avoid leaks) */
  removeStreamListeners: () => {
    ipcRenderer.removeAllListeners('assistant:token');
    ipcRenderer.removeAllListeners('assistant:done');
    ipcRenderer.removeAllListeners('assistant:error');
  },

  /**
   * Speak text via main-process PowerShell SAPI (high-quality Windows voices).
   * Returns a Promise that resolves when speech completes.
   * @param {string} text
   */
  speak:     (text) => ipcRenderer.invoke('assistant:speak', text),

  /** Stop any in-progress SAPI speech immediately */
  stopSpeak: ()     => ipcRenderer.send('assistant:speak-stop'),

  /** Close this window */
  close: () => ipcRenderer.send('assistant:close'),
});
