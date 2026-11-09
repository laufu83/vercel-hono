// api/index.ts
import 'dotenv/config'

import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { handleOptionsCors } from "./utils/cors";
import vod from './routes/vod'


const app = new Hono().basePath('/api')
// 全局OPTIONS跨域预检
app.options('*', (c) => {
  return handleOptionsCors()
})
app.route('/vod', vod)

// 健康测试接口：增加数据库连通性检测
app.get('/health', async (c) => {
  let dbStatus = "ok";
 
  return c.json({
    code: 0,
    msg: '服务运行正常',
    timestamp: Date.now(),
    env: process.env.NODE_ENV || 'development',
    database: dbStatus
  })
})

// 兜底 404
app.notFound((c) => c.json({ code: 404, msg: '接口不存在' }, 404))

// 仅本地开发启动端口监听
if (process.env.NODE_ENV !== 'production') {
  const PORT = Number(process.env.PORT) || 3000
  serve({
    fetch: app.fetch,
    port: PORT
  })
  console.log(`服务已启动，监听端口: ${PORT}`)
}
// CommonJS 导出适配Vercel
// module.exports = app;
export default app