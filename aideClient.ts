export interface AiDEClientConfig {
  baseUrl: string
  token: string
  timeoutMs?: number
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AideRequest {
  system?: string
  messages: ChatMessage[]
}

export interface StreamCallbacks {
  onToken: (token: string) => void
  onDone: (fullText: string) => void
  onError: (error: Error) => void
  /** Optional external AbortSignal — aborting it stops the stream cleanly. */
  signal?: AbortSignal
}

/** Extended error that carries request context for display in the UI error log. */
export class AiDEError extends Error {
  readonly requestUrl: string
  readonly requestPayload: Record<string, unknown>

  constructor(message: string, requestUrl: string, requestPayload: Record<string, unknown>) {
    super(message)
    this.name = 'AiDEError'
    this.requestUrl = requestUrl
    this.requestPayload = requestPayload
  }
}

const DEFAULT_BASE_URL = '/aide-api'
const DEFAULT_TIMEOUT_MS = 60_000

export function buildConfig(token: string, baseUrl?: string): AiDEClientConfig {
  return {
    baseUrl: baseUrl ?? DEFAULT_BASE_URL,
    token,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  }
}

/**
 * Calls the AiDE /chat endpoint using the OpenAI-compatible messages format.
 * Streams the response via SSE (server-sent events) and delivers tokens
 * one-by-one via onToken callbacks.
 */
export async function streamChatCompletion(
  config: AiDEClientConfig,
  request: AideRequest,
  callbacks: StreamCallbacks,
): Promise<void> {
  const endpoint = `${config.baseUrl}/chat`
  const resolvedEndpoint = new URL(endpoint, window.location.href).href

  // Build OpenAI-compatible messages array
  const messages: ChatMessage[] = request.system
    ? [{ role: 'system', content: request.system }, ...request.messages]
    : [...request.messages]

  const payload: Record<string, unknown> = { messages, stream: true }

  const timeoutController = new AbortController()
  const timer = setTimeout(
    () => timeoutController.abort(),
    config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  )

  // Combine internal timeout signal with optional external abort signal
  const externalSignal = callbacks.signal
  const fetchSignal: AbortSignal = externalSignal
    ? (typeof AbortSignal.any === 'function'
        ? AbortSignal.any([timeoutController.signal, externalSignal])
        : (() => {
            const merged = new AbortController()
            const abort = () => merged.abort()
            timeoutController.signal.addEventListener('abort', abort, { once: true })
            externalSignal.addEventListener('abort', abort, { once: true })
            return merged.signal
          })())
    : timeoutController.signal

  let response: Response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.token}`,
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify(payload),
      signal: fetchSignal,
    })
  } catch (err) {
    clearTimeout(timer)
    // If aborted by the external signal, treat as clean stop
    if (callbacks.signal?.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
      callbacks.onDone('')
      return
    }
    const message = err instanceof Error ? err.message : String(err)
    callbacks.onError(new AiDEError(message, resolvedEndpoint, payload))
    return
  }

  clearTimeout(timer)

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    callbacks.onError(
      new AiDEError(
        `AiDE API error: HTTP ${response.status} ${response.statusText} — ${body}`,
        resolvedEndpoint,
        payload,
      ),
    )
    return
  }

  if (!response.body) {
    callbacks.onError(
      new AiDEError('AiDE API returned no response body', resolvedEndpoint, payload),
    )
    return
  }

  // Parse the SSE stream
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let fullText = ''
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      // Keep the last (possibly incomplete) line in the buffer
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed === 'data: [DONE]') continue
        if (!trimmed.startsWith('data:')) continue

        const jsonStr = trimmed.slice('data:'.length).trim()
        try {
          const chunk = JSON.parse(jsonStr) as {
            choices?: Array<{ delta?: { content?: string } }>
          }
          const content = chunk.choices?.[0]?.delta?.content
          if (content) {
            fullText += content
            callbacks.onToken(content)
          }
        } catch {
          // Non-JSON SSE line — skip
        }
      }
    }
  } catch (err) {
    // If aborted by the external signal, treat accumulated text as clean stop
    if (callbacks.signal?.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
      callbacks.onDone(fullText)
      return
    }
    const message = err instanceof Error ? err.message : String(err)
    callbacks.onError(new AiDEError(message, resolvedEndpoint, payload))
    return
  }

  callbacks.onDone(fullText)
}
