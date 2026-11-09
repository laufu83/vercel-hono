import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import vod from './routes/vod.js'

const app = new Hono().basePath('/api')

app.route('/vod', vod)
app.get('/health', (c) => c.json({ code: 0, message: 'ok' }))

const port = 3000
console.log(`✅ Local dev server: http://localhost:${port}/api/health`)
serve({
  fetch: app.fetch,
  port
})
