import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { defineConfig, loadEnv, type Plugin } from 'vite'

/**
 * /api/tts — server-side ElevenLabs text-to-speech for dev and `vite preview`.
 * GET  -> { enabled } (false when no key/voice). POST { text } -> audio/mpeg.
 * The key is read from the server environment (repo-root or web/ .env, or process.env);
 * it is never prefixed VITE_ and never reaches the browser.
 */
function tts(mode: string): Plugin {
  const env = { ...loadEnv(mode, '..', ''), ...loadEnv(mode, process.cwd(), ''), ...process.env }
  const key = env.ELEVENLABS_API_KEY
  const voice = env.ELEVENLABS_VOICE_ID
  const model = env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2'
  const cache = new Map<string, Buffer>() // text -> mp3, so repeat plays cost no credits
  const sendMp3 = (res: ServerResponse, buf: Buffer) => {
    res.statusCode = 200
    res.setHeader('content-type', 'audio/mpeg')
    res.setHeader('cache-control', 'no-store')
    res.end(buf)
  }

  const handle = async (req: IncomingMessage, res: ServerResponse) => {
    const json = (code: number, body: unknown) => {
      res.statusCode = code
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify(body))
    }
    if (req.method === 'GET') return json(200, { enabled: Boolean(key && voice) })
    if (req.method !== 'POST') return json(405, { error: 'method' })
    if (!key || !voice) return json(503, { error: 'tts disabled' })
    let raw = ''
    for await (const chunk of req) { raw += chunk; if (raw.length > 4096) return json(413, { error: 'too large' }) }
    let text = ''
    try { text = String(JSON.parse(raw).text ?? '').trim() } catch { return json(400, { error: 'bad json' }) }
    if (!text || text.length > 300) return json(400, { error: 'text must be 1-300 chars' })
    const hit = cache.get(text)
    if (hit) return sendMp3(res, hit)
    try {
      const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}`, {
        method: 'POST',
        headers: { 'xi-api-key': key, 'content-type': 'application/json', accept: 'audio/mpeg' },
        body: JSON.stringify({ text, model_id: model }),
      })
      if (!r.ok) return json(502, { error: `elevenlabs ${r.status}` })
      const buf = Buffer.from(await r.arrayBuffer())
      if (cache.size > 50) cache.clear()
      cache.set(text, buf)
      sendMp3(res, buf)
    } catch {
      json(502, { error: 'elevenlabs unreachable' })
    }
  }

  const mount = (server: { middlewares: { use: (p: string, h: (req: IncomingMessage, res: ServerResponse) => void) => void } }) =>
  {
    // block body: returning connect's app would make Vite call it as a post hook
    server.middlewares.use('/api/tts', (req, res) => { void handle(req, res) })
  }
  return { name: 'botbet-tts', configureServer: mount, configurePreviewServer: mount }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // GitHub Pages serves the site under /BotBet/; local dev and preview stay at /
  base: process.env.GITHUB_PAGES ? '/BotBet/' : '/',
  plugins: [react(), tts(mode)],
}))
