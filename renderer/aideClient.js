/**
 * AiDE API client — ESM port of aideClient.ts.
 * Used directly in the renderer (no Node.js APIs).
 */

const DEFAULT_TIMEOUT_MS = 60_000;

export class AiDEError extends Error {
  constructor(message, requestUrl, requestPayload) {
    super(message);
    this.name = 'AiDEError';
    this.requestUrl = requestUrl;
    this.requestPayload = requestPayload;
  }
}

/**
 * Stream a chat completion from the AiDE API.
 *
 * @param {{ baseUrl: string, token: string, timeoutMs?: number }} config
 * @param {{ system?: string, messages: Array<{role: string, content: string}> }} request
 * @param {{ onToken(t:string):void, onDone(full:string):void, onError(e:Error):void, signal?: AbortSignal }} callbacks
 */
export async function streamChatCompletion(config, request, callbacks) {
  const endpoint = `${config.baseUrl}/chat`;

  const messages = request.system
    ? [{ role: 'system', content: request.system }, ...request.messages]
    : [...request.messages];

  const payload = { messages, stream: true };

  const timeoutController = new AbortController();
  const timer = setTimeout(
    () => timeoutController.abort(),
    config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  // Merge external abort signal with internal timeout signal
  const externalSignal = callbacks.signal;
  let fetchSignal;
  if (externalSignal) {
    if (typeof AbortSignal.any === 'function') {
      fetchSignal = AbortSignal.any([timeoutController.signal, externalSignal]);
    } else {
      const merged = new AbortController();
      const abort = () => merged.abort();
      timeoutController.signal.addEventListener('abort', abort, { once: true });
      externalSignal.addEventListener('abort', abort, { once: true });
      fetchSignal = merged.signal;
    }
  } else {
    fetchSignal = timeoutController.signal;
  }

  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.token}`,
        'Accept': 'application/json, text/event-stream',
      },
      body: JSON.stringify(payload),
      signal: fetchSignal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (callbacks.signal?.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
      callbacks.onDone('');
      return;
    }
    callbacks.onError(new AiDEError(err instanceof Error ? err.message : String(err), endpoint, payload));
    return;
  }

  clearTimeout(timer);

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    callbacks.onError(new AiDEError(
      `AiDE API error: HTTP ${response.status} ${response.statusText} — ${body}`,
      endpoint, payload,
    ));
    return;
  }

  if (!response.body) {
    callbacks.onError(new AiDEError('AiDE API returned no response body', endpoint, payload));
    return;
  }

  // Parse SSE stream
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (!trimmed.startsWith('data:')) continue;

        const jsonStr = trimmed.slice('data:'.length).trim();
        try {
          const chunk = JSON.parse(jsonStr);
          const content = chunk.choices?.[0]?.delta?.content;
          if (content) {
            fullText += content;
            callbacks.onToken(content);
          }
        } catch {
          // Non-JSON SSE line — skip
        }
      }
    }
  } catch (err) {
    if (callbacks.signal?.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
      callbacks.onDone(fullText);
      return;
    }
    callbacks.onError(new AiDEError(err instanceof Error ? err.message : String(err), endpoint, payload));
    return;
  }

  callbacks.onDone(fullText);
}
