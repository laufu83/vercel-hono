// src/db/index.ts
import { Pool, type PoolClient } from 'pg'

let pool: Pool | null = null

const getPool = (): Pool => {
  if (pool) return pool
  pool = new Pool({
    host: process.env.PG_HOST,
    port: process.env.PG_PORT ? Number(process.env.PG_PORT) : undefined,
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    database: process.env.PG_DATABASE,
    ssl:   
      process.env.PG_SSL === 'true'
        ? { rejectUnauthorized: false }
        : undefined,
    max: 5,                     // Serverless 单实例连接数，不要设太大
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  })
  return pool
}

/**
 * 获取数据库连接客户端 PoolClient
 * 兼容 VodService 直接调用 .query()
 */
export const getDbClient = async (): Promise<PoolClient> => {
  return await getPool().connect()
}

/**
 * 归还连接到连接池（不是断开连接）
 */
export const closeClient = async (client: PoolClient | null): Promise<void> => {
  if (!client) return
  try {
    client.release()
  } catch (e) {
    console.error('release pg client error:', e)
  }
}

export { getPool }
