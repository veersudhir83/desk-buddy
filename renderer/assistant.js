/**
 * Desk Assistant renderer
 *
 * Flow:
 *   1. User presses mic button → SpeechRecognition captures voice → transcript appears in box
 *   2. User presses Send (or recognition auto-submits) → messages sent to main via IPC
 *   3. Main process (Node.js fetch, no Chromium pipe limits) streams AiDE SSE tokens back via IPC
 *   4. Tokens displayed in conversation + full text spoken via SpeechSynthesis on default speaker
 */

// ── DOM refs ─────────────────────────────────────────────────────────────────
const conversation   = document.getElementById('conversation');
const statusEl       = document.getElementById('status');
const btnMic         = document.getElementById('btn-mic');
const transcriptBox  = document.getElementById('transcript-box');
const btnSend        = document.getElementById('btn-send');
const btnStop        = document.getElementById('btn-stop');
const btnClose       = document.getElementById('btn-close');

// ── Conversation history (kept for multi-turn context) ────────────────────────
const history = [];

// ── Status helper ─────────────────────────────────────────────────────────────
function setStatus(text, cls = '') {
  statusEl.textContent = text;
  statusEl.className   = cls;
}

// ── Conversation UI helpers ───────────────────────────────────────────────────
function addMessage(role, text) {
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  if (role !== 'error') {
    const lbl = document.createElement('div');
    lbl.className = 'label';
    lbl.textContent = role === 'user' ? 'YOU' : 'ASSISTANT';
    div.appendChild(lbl);
  }
  const content = document.createElement('span');
  content.textContent = text;
  div.appendChild(content);
  conversation.appendChild(div);
  conversation.scrollTop = conversation.scrollHeight;
  return content;
}

function addStreamingMessage() {
  const div = document.createElement('div');
  div.className = 'msg ai';
  const lbl = document.createElement('div');
  lbl.className = 'label';
  lbl.textContent = 'ASSISTANT';
  div.appendChild(lbl);
  const content = document.createElement('span');
  content.className = 'cursor-blink';
  div.appendChild(content);
  conversation.appendChild(div);
  conversation.scrollTop = conversation.scrollHeight;
  return { div, content };
}

// ── Speech Recognition (mic → text) ──────────────────────────────────────────
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let recognising = false;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.continuous     = false;
  recognition.interimResults = true;
  recognition.lang            = 'en-US';
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    recognising = true;
    btnMic.classList.add('active');
    btnMic.title = 'Listening… click to stop';
    setStatus('🎤 Listening…', 'listening');
  };

  recognition.onresult = (e) => {
    let interim = '';
    let finalText = '';
    for (const result of e.results) {
      if (result.isFinal) finalText += result[0].transcript;
      else                interim  += result[0].transcript;
    }
    transcriptBox.textContent = finalText || interim;
    if (finalText) {
      stopRecognition();
      sendQuestion(finalText.trim());
    }
  };

  recognition.onerror = (e) => {
    console.warn('[assistant] SpeechRecognition error:', e.error);
    stopRecognition();
    if (e.error !== 'aborted') setStatus(`Mic error: ${e.error}`, 'error');
    else setStatus('', '');
  };

  recognition.onend = () => {
    recognising = false;
    btnMic.classList.remove('active');
    btnMic.title = 'Click to speak';
    if (statusEl.classList.contains('listening')) setStatus('', '');
  };
} else {
  btnMic.disabled = true;
  btnMic.title    = 'Speech recognition not available';
}

function startRecognition() {
  if (!recognition || recognising) return;
  transcriptBox.textContent = '';
  recognition.start();
}

function stopRecognition() {
  if (!recognition || !recognising) return;
  recognition.stop();
}

btnMic.addEventListener('click', () => {
  if (recognising) stopRecognition();
  else             startRecognition();
});

// ── In-progress flag ──────────────────────────────────────────────────────────
let streaming = false;

// ── Send question via IPC to main process ─────────────────────────────────────
function sendQuestion(text) {
  if (!text?.trim() || streaming) return;

  transcriptBox.textContent = '';

  // Add user message to history + UI
  history.push({ role: 'user', content: text });
  addMessage('user', text);

  // Disable inputs, show stop
  streaming = true;
  setStatus('⏳ Thinking…', 'thinking');
  btnSend.disabled = true;
  btnMic.disabled  = true;
  btnStop.style.display = 'inline-block';

  // Streaming bubble
  const { div: aiDiv, content: aiContent } = addStreamingMessage();
  let fullText = '';

  // Remove stale listeners from any previous request
  window.assistant.removeStreamListeners();

  // Wire up new listeners
  window.assistant.onToken((token) => {
    fullText += token;
    aiContent.textContent = fullText;
    conversation.scrollTop = conversation.scrollHeight;
  });

  window.assistant.onDone((full) => {
    aiContent.classList.remove('cursor-blink');
    if (full) fullText = full;
    history.push({ role: 'assistant', content: fullText });
    speakText(fullText);
    resetInputState();
  });

  window.assistant.onError((message) => {
    aiContent.classList.remove('cursor-blink');
    aiDiv.className = 'msg error';
    aiContent.textContent = `Error: ${message}`;
    setStatus(`⚠ ${message}`, 'error');
    resetInputState(false);
  });

  // Send full history to main (user message already pushed above)
  window.assistant.chat(history);
}

function resetInputState(showReady = true) {
  streaming = false;
  btnSend.disabled      = false;
  btnMic.disabled       = !recognition;
  btnStop.style.display = 'none';
  if (showReady) setStatus('', '');
}

// ── Stop button — cancel TTS; IPC stream can't be cancelled from renderer
// (main will finish but we ignore remaining tokens by removing listeners) ─────
btnStop.addEventListener('click', () => {
  window.speechSynthesis?.cancel();
  window.assistant.removeStreamListeners();
  resetInputState(false);
  setStatus('Stopped', '');
});

// ── Send button / Enter key ───────────────────────────────────────────────────
btnSend.addEventListener('click', () => {
  const text = transcriptBox.textContent.trim();
  if (text) sendQuestion(text);
});

transcriptBox.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    const text = transcriptBox.textContent.trim();
    if (text) sendQuestion(text);
  }
});

// ── Text-to-Speech ─────────────────────────────────────────────────────────────
function speakText(text) {
  if (!window.speechSynthesis || !text?.trim()) return;
  window.speechSynthesis.cancel();

  // Split into sentences for low-latency start
  const sentences = text.match(/[^.!?\n]+[.!?\n]*/g) ?? [text];
  setStatus('🔊 Speaking…', 'speaking');

  let i = 0;
  function speakNext() {
    if (i >= sentences.length) { setStatus('', ''); return; }
    const utt = new SpeechSynthesisUtterance(sentences[i++].trim());
    utt.rate   = 1.05;
    utt.pitch  = 1.0;
    utt.volume = 1.0;
    utt.onend   = speakNext;
    utt.onerror = (e) => { if (e.error !== 'interrupted') console.warn('[TTS]', e.error); speakNext(); };
    window.speechSynthesis.speak(utt);
  }
  speakNext();
}

// ── Close button ──────────────────────────────────────────────────────────────
btnClose.addEventListener('click', () => {
  window.speechSynthesis?.cancel();
  window.assistant.removeStreamListeners();
  window.assistant.close();
});

// ── Init: verify credentials are available ────────────────────────────────────
(async () => {
  try {
    await window.assistant.getCredentials();
    setStatus('Ready — press 🎤 or type a question', '');
  } catch (err) {
    setStatus(`⚠ ${err.message}`, 'error');
    btnMic.disabled  = true;
    btnSend.disabled = true;
  }
})();
