// src/routes/vod.ts
import { Hono } from 'hono'
import { successResponse, errorResponse, pageResponse, badRequest, serverError, notFound } from '../utils/res.js'
import type { PoolClient as Client } from 'pg' 
import { VodService } from '../services/vod.service.js'
import { getDbClient, closeClient } from "../db/index.js";
// ========== 创建路由 ==========
const app = new Hono()

// ========== 辅助函数 ==========

/**
 * 安全解析整数
 */
const parsePositiveInt = (value: string | undefined, defaultValue: number, max?: number): number => {
  const num = parseInt(value || String(defaultValue))
  if (isNaN(num) || num < 1) return defaultValue
  if (max && num > max) return max
  return num
}

/**
 * 数据库操作包装器 - 自动管理连接
 */
const withDb = async <T>(
  callback: (client: Client) => Promise<T>
): Promise<T> => {
  let client: Client | null = null
  try {
    client = await getDbClient()
    return await callback(client)
  } finally {
    closeClient(client)
  }
}

/**
 * 错误处理
 */
const handleError = (err: unknown, context?: string): Response => {
  console.error(`API error${context ? ` [${context}]` : ''}:`, err)
  const message = err instanceof Error ? err.message : '服务器异常'
  return serverError(message)
}

// ==========================================
// 1. 影视列表 /api/vod/list
// ==========================================
app.get('/list', async (c) => {
  try {
    const page = parsePositiveInt(c.req.query('page'), 1)
    const size = parsePositiveInt(c.req.query('size'), 10, 50)

    const params = {
      page,
      size,
      pid: c.req.query('pid') || undefined,
      type: c.req.query('type') || undefined,
      year: c.req.query('year') || undefined,
      area: c.req.query('area') || undefined,
      lang: c.req.query('lang') || undefined,
      class: c.req.query('class') || undefined,
      sort: c.req.query('sort') || 'vod_time',
      order: (c.req.query('order') as 'ASC' | 'DESC') || 'DESC',
    }

    const result = await withDb(async (client) => {
      const service = new VodService(client)
      return await service.getList(params)
    })

    return pageResponse(result.list, result.total, result.page, result.limit)
  } catch (err) {
    return handleError(err, 'getList')
  }
})

// ==========================================
// 2. 影视详情 /api/vod/detail/:id
// ==========================================
app.get('/detail/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'))
    if (!id || id <= 0) {
      return badRequest('无效的影片 ID')
    }

    const detail = await withDb(async (client) => {
      const service = new VodService(client)
      return await service.getDetail(id)
    })

    if (!detail) {
      return notFound('影片不存在')
    }

    return successResponse(detail)
  } catch (err) {
    return handleError(err, 'getDetail')
  }
})

// ==========================================
// 3. 影视搜索 /api/vod/search
// ==========================================
app.get('/search', async (c) => {
  try {
    const keyword = c.req.query('keyword') || ''
    if (!keyword || !keyword.trim()) {
      return badRequest('请输入搜索关键词')
    }

    const page = parsePositiveInt(c.req.query('page'), 1)
    const size = parsePositiveInt(c.req.query('size'), 10, 50)
    const year = c.req.query('year') || ""
    const result = await withDb(async (client) => {
      const service = new VodService(client)
      return await service.search(keyword.trim(), year, page, size)
    })

    return pageResponse(result.list, result.total, result.page, result.limit)
  } catch (err) {
    return handleError(err, 'search')
  }
})

// ==========================================
// 4. 获取分类列表 /api/vod/categories
// ==========================================
app.get('/categories', async (c) => {
  try {
    const rows = await withDb(async (client) => {
      const result = await client.query(
        `SELECT type_id, type_name, type_pid 
         FROM category 
         ORDER BY type_pid, type_id`
      )
      return result.rows
    })

    return successResponse(rows)
  } catch (err) {
    return handleError(err, 'getCategories')
  }
})
// 获取分类列表（树形结构）
app.get('/categories/tree', async (c) => {
  try {
    const rows = await withDb(async (client) => {
      const result = await client.query(
        `SELECT type_id, type_pid, type_name 
         FROM category 
         ORDER BY type_pid, type_id`
      )
      return result.rows
    })

    // 构建树形结构
    const buildTree = (items: any[], parentId: number = 0): any[] => {
      return items
        .filter(item => item.type_pid === parentId)
        .map(item => ({
          ...item,
          children: buildTree(items, item.type_id)
        }))
    }

    const tree = buildTree(rows)
    return successResponse(tree)
  } catch (err) {
    return handleError(err, 'getCategoryTree')
  }
})

// 获取一级分类
app.get('/categories/parent', async (c) => {
  try {
    const rows = await withDb(async (client) => {
      const result = await client.query(
        `SELECT type_id, type_pid, type_name 
         FROM category 
         WHERE type_pid = 0
         ORDER BY type_id`
      )
      return result.rows
    })
    return successResponse(rows)
  } catch (err) {
    return handleError(err, 'getParentCategories')
  }
})

// 获取子分类
app.get('/categories/children/:pid', async (c) => {
  try {
    const pid = parseInt(c.req.param('pid'))
    if (!pid || pid < 0) {
      return badRequest('无效的父级 ID')
    }

    const rows = await withDb(async (client) => {
      const result = await client.query(
        `SELECT type_id, type_pid, type_name 
         FROM category 
         WHERE type_pid = $1
         ORDER BY type_id`,
        [pid]
      )
      return result.rows
    })
    return successResponse(rows)
  } catch (err) {
    return handleError(err, 'getChildrenCategories')
  }
})
// ==========================================
// 5. 获取排行榜 /api/vod/rank
// ==========================================
app.get('/rank', async (c) => {
  try {
    const limit = parsePositiveInt(c.req.query('size'), 10, 100)

    const rows = await withDb(async (client) => {
      const result = await client.query(
        `SELECT vod_id,type_id,  type_name, vod_name, vod_sub, vod_class, vod_pic, 
             vod_actor, vod_director, vod_time, vod_area, vod_lang, 
             vod_year, vod_remarks, vod_score, vod_content
         FROM vod
        WHERE type_id_1=1 
          AND vod_score ~ '^[0-9.]+$' 
          AND vod_score::DECIMAL >= 5.0        
        ORDER BY vod_score::DECIMAL DESC
         LIMIT $1`,
        [limit]
      )
      return result.rows
    })

    return successResponse(rows)
  } catch (err) {
    return handleError(err, 'getRank')
  }
})

// ==========================================
// 6. 相关推荐 /api/vod/relate
// ==========================================
app.get('/relate', async (c) => {
  try {
    const typeId = parseInt(c.req.query('type_id') || '0')
    const limit = parsePositiveInt(c.req.query('size'), 5, 20)
    const excludeId = parseInt(c.req.query('exclude_id') || '0')

    if (!typeId || typeId <= 0) {
      return badRequest('请提供有效的 type_id 参数')
    }

    const rows = await withDb(async (client) => {
      const result = await client.query(
        `SELECT vod_id,type_id,  type_name, vod_name, vod_sub, vod_class, vod_pic, 
             vod_actor, vod_director, vod_time, vod_area, vod_lang, 
             vod_year, vod_remarks, vod_score, vod_content
         FROM vod
         WHERE type_id = $1 AND vod_id != $2
         ORDER BY vod_time DESC
         LIMIT $3`,
        [typeId, excludeId, limit]
      )
      return result.rows
    })

    return successResponse(rows)
  } catch (err) {
    return handleError(err, 'getRelate')
  }
})

// ==========================================
// 7. 获取统计信息 /api/vod/stats
// ==========================================
app.get('/stats', async (c) => {
  try {
    const stats = await withDb(async (client) => {
      const result = await client.query(
        `SELECT 
          COUNT(*) as total,
          COUNT(DISTINCT type_id) as type_count,
          COUNT(DISTINCT vod_year) as year_count,
          COUNT(DISTINCT vod_area) as area_count,
          AVG(CAST(vod_score AS FLOAT)) as avg_score
         FROM vod
         WHERE vod_score IS NOT NULL AND vod_score != ''`
      )
      return result.rows[0]
    })

    return successResponse(stats)
  } catch (err) {
    return handleError(err, 'getStats')
  }
})

// ==========================================
// 8. 获取年份列表 /api/vod/years
// ==========================================
app.get('/years', async (c) => {
  try {
    const rows = await withDb(async (client) => {
      const result = await client.query(
        `SELECT vod_year, COUNT(*) as count
         FROM vod
         WHERE vod_year IS NOT NULL AND vod_year != ''
         GROUP BY vod_year
         ORDER BY vod_year DESC`
      )
      return result.rows
    })

    return successResponse(rows)
  } catch (err) {
    return handleError(err, 'getYears')
  }
})

// ==========================================
// 9. 获取地区列表 /api/vod/areas
// ==========================================
app.get('/areas', async (c) => {
  try {
    const rows = await withDb(async (client) => {
      const result = await client.query(
        `SELECT vod_area, COUNT(*) as count
         FROM vod
         WHERE vod_area IS NOT NULL AND vod_area != ''
         GROUP BY vod_area
         ORDER BY count DESC`
      )
      return result.rows
    })

    return successResponse(rows)
  } catch (err) {
    return handleError(err, 'getAreas')
  }
})

// ==========================================
// 10. 批量获取影片 /api/vod/batch
// ==========================================
app.post('/batch', async (c) => {
  try {
    const body = await c.req.json()
    const ids = body.ids || []

    if (!Array.isArray(ids) || ids.length === 0) {
      return badRequest('请提供有效的影片 ID 列表')
    }

    if (ids.length > 100) {
      return badRequest('最多支持 100 个影片 ID')
    }

    // 确保所有 ID 都是数字
    const validIds = ids.filter(id => typeof id === 'number' && id > 0)
    if (validIds.length === 0) {
      return badRequest('请提供有效的数字 ID 列表')
    }

    const rows = await withDb(async (client) => {
      const placeholders = validIds.map((_, i) => `$${i + 1}`).join(',')
      const result = await client.query(
        `SELECT vod_id,type_id,  type_name, vod_name, vod_sub, vod_class, vod_pic, 
             vod_actor, vod_director, vod_time, vod_area, vod_lang, 
             vod_year, vod_remarks, vod_score, vod_content
         FROM vod
         WHERE vod_id IN (${placeholders})`,
        validIds
      )
      return result.rows
    })

    return successResponse(rows)
  } catch (err) {
    return handleError(err, 'batchGet')
  }
})

// ==========================================
// 404 处理
// ==========================================
app.notFound((c) => {
  return errorResponse(404, `接口 ${c.req.path} 不存在`)
})

// ==========================================
// 全局错误处理
// ==========================================
app.onError((err, c) => {
  console.error('Unhandled error:', err)
  return errorResponse(500, err.message || '服务器内部错误')
})

export default app
