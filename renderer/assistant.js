/**
 * Desk Assistant renderer
 *
 * Flow:
 *   1. User types in input box and presses Send / Enter
 *   2. Main process streams AiDE SSE tokens back via IPC
 *   3. Tokens accumulated, markdown rendered as clean HTML
 *   4. Full response spoken via main-process PowerShell SAPI TTS
 *      (uses high-quality Windows Neural voices — much better than browser TTS)
 *      — voice output can be toggled on/off via the 🔊 button in the titlebar
 */

// ── DOM refs ─────────────────────────────────────────────────────────────────
const conversation  = document.getElementById('conversation');
const statusEl      = document.getElementById('status');
const inputBox      = document.getElementById('input-box');
const btnSend       = document.getElementById('btn-send');
const btnStop       = document.getElementById('btn-stop');
const btnClose      = document.getElementById('btn-close');
const btnTtsToggle  = document.getElementById('btn-tts-toggle');

// ── TTS enabled state (persisted in sessionStorage) ───────────────────────────
let ttsEnabled = sessionStorage.getItem('tts-enabled') !== 'false';
function syncTtsButton() {
  if (ttsEnabled) {
    btnTtsToggle.textContent = '🔊 Voice';
    btnTtsToggle.className   = 'on';
    btnTtsToggle.title       = 'Voice output ON — click to disable';
  } else {
    btnTtsToggle.textContent = '🔇 Voice';
    btnTtsToggle.className   = 'off';
    btnTtsToggle.title       = 'Voice output OFF — click to enable';
  }
}
syncTtsButton();
btnTtsToggle.addEventListener('click', () => {
  ttsEnabled = !ttsEnabled;
  sessionStorage.setItem('tts-enabled', ttsEnabled);
  if (!ttsEnabled) window.assistant.stopSpeak();
  syncTtsButton();
});

// ── Conversation history (kept for multi-turn context) ────────────────────────
const history = [];

// ── Status helper ─────────────────────────────────────────────────────────────
function setStatus(text, cls = '') {
  statusEl.textContent = text;
  statusEl.className   = cls;
}

// ── Markdown → readable HTML ──────────────────────────────────────────────────
function markdownToHtml(md) {
  if (!md) return '';

  let html = md
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>');

  // Fenced code blocks
  html = html.replace(/```[\w]*\n?([\s\S]*?)```/g, (_, code) =>
    `<pre><code>${code.trim()}</code></pre>`);

  // Inline code
  html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');

  // Headings
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm,  '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm,   '<h1>$1</h1>');

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.+?)__/g,     '<strong>$1</strong>');

  // Italic
  html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
  html = html.replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g,      '<em>$1</em>');

  // Horizontal rule
  html = html.replace(/^[-*]{3,}$/gm, '<hr>');

  // List items
  html = html.replace(/^[ \t]*[-*+] (.+)$/gm,   '<li>$1</li>');
  html = html.replace(/^[ \t]*\d+\. (.+)$/gm,   '<li>$1</li>');

  // Wrap consecutive <li> blocks
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (block) => `<ul>${block}</ul>`);

  // Paragraphs
  const blocks = html.split(/\n{2,}/);
  html = blocks.map(block => {
    block = block.trim();
    if (!block) return '';
    if (/^<(h[1-3]|ul|ol|li|pre|hr)/.test(block)) return block;
    return `<p>${block.replace(/\n/g, ' ')}</p>`;
  }).join('\n');

  return html;
}

// ── Strip markdown for TTS (so voice doesn't say "asterisk asterisk") ─────────
function stripMarkdownForTts(text) {
  return text
    .replace(/```[\w]*\n?([\s\S]*?)```/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/#{1,6} /g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/^[-*+] /gm, '')
    .replace(/^\d+\. /gm, '')
    .replace(/[-]{3,}/g, '')
    .trim();
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
  const content = document.createElement('div');
  if (role === 'ai') {
    content.className = 'ai-body';
    content.innerHTML = markdownToHtml(text);
  } else {
    content.textContent = text;
  }
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
  const content = document.createElement('div');
  content.className = 'ai-body cursor-blink';
  div.appendChild(content);
  conversation.appendChild(div);
  conversation.scrollTop = conversation.scrollHeight;
  return { div, content };
}

// ── In-progress flag ──────────────────────────────────────────────────────────
let streaming = false;

// ── Send question via IPC to main process ─────────────────────────────────────
function sendQuestion(text) {
  if (!text?.trim() || streaming) return;

  inputBox.textContent = '';

  history.push({ role: 'user', content: text });
  addMessage('user', text);

  streaming = true;
  setStatus('⏳ Thinking…', 'thinking');
  btnSend.disabled = true;
  btnStop.style.display = 'inline-block';

  const { div: aiDiv, content: aiContent } = addStreamingMessage();
  let rawText = '';

  window.assistant.removeStreamListeners();

  window.assistant.onToken((token) => {
    rawText += token;
    aiContent.innerHTML = markdownToHtml(rawText);
    conversation.scrollTop = conversation.scrollHeight;
  });

  window.assistant.onDone((full) => {
    aiContent.classList.remove('cursor-blink');
    if (full) rawText = full;
    aiContent.innerHTML = markdownToHtml(rawText);
    history.push({ role: 'assistant', content: rawText });
    speakText(rawText);
    resetInputState();
  });

  window.assistant.onError((message) => {
    aiContent.classList.remove('cursor-blink');
    aiDiv.className = 'msg error';
    aiContent.className = '';
    aiContent.textContent = `Error: ${message}`;
    setStatus(`⚠ ${message}`, 'error');
    resetInputState(false);
  });

  window.assistant.chat(history);
}

function resetInputState(showReady = true) {
  streaming = false;
  btnSend.disabled      = false;
  btnStop.style.display = 'none';
  if (showReady) setStatus('', '');
}

// ── Stop button ───────────────────────────────────────────────────────────────
btnStop.addEventListener('click', () => {
  window.assistant.stopSpeak();
  window.assistant.removeStreamListeners();
  resetInputState(false);
  setStatus('Stopped', '');
});

// ── Send button / Enter key ───────────────────────────────────────────────────
btnSend.addEventListener('click', () => {
  const text = inputBox.textContent.trim();
  if (text) sendQuestion(text);
});

inputBox.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    const text = inputBox.textContent.trim();
    if (text) sendQuestion(text);
  }
});

// ── Text-to-Speech via main process (PowerShell SAPI — high-quality voices) ──
function speakText(text) {
  if (!ttsEnabled || !text?.trim()) return;
  const clean = stripMarkdownForTts(text);
  setStatus('🔊 Speaking…', 'speaking');
  window.assistant.speak(clean).then(() => {
    setStatus('', '');
  }).catch(() => {
    setStatus('', '');
  });
}

// ── Close button ──────────────────────────────────────────────────────────────
btnClose.addEventListener('click', () => {
  window.assistant.stopSpeak();
  window.assistant.removeStreamListeners();
  window.assistant.close();
});

// ── Init: verify credentials are available ────────────────────────────────────
(async () => {
  try {
    await window.assistant.getCredentials();
    setStatus('Ready — type a question and press Send', '');
  } catch (err) {
    setStatus(`⚠ ${err.message}`, 'error');
    btnSend.disabled = true;
  }
})();
