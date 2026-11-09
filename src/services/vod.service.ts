// src/services/vod.service.ts
import type { PoolClient } from 'pg'
import { buildFilters, getPagination } from '../utils/query-builder.js'

export interface VodItem {
  vod_id: number
  type_id: number
  type_name: string
  vod_name: string
  vod_sub: string
  vod_class: string
  vod_pic: string
  vod_actor: string
  vod_director: string
  vod_time: string
  vod_area: string
  vod_lang: string
  vod_year: string
  vod_remarks: string
  vod_score: string
  vod_content: string
  vod_play_url: string
}

export interface VodListResult {
  list: VodItem[]
  total: number
  page: number
  limit: number
  pagecount: number
}

export class VodService {
  constructor(private client: PoolClient) {}

  async getList(params: {
    page?: number
    size?: number
    pid?: string|number
    type?: string|number
    year?: string
    area?: string
    lang?: string
    class?: string
    sort?: string
    order?: 'ASC' | 'DESC'
  }): Promise<VodListResult> {
    const { page = 1, size = 10, sort = 'vod_time', order = 'DESC' } = params
    const { limit, offset } = getPagination(page, size)
    const filters = buildFilters(params)

    // 构建查询
    const whereClause = filters.sql
    const queryParams = [...filters.params]
    let paramIndex = queryParams.length + 1

    // 数据查询
    const dataQuery = `
      SELECT vod_id,type_id,  type_name, vod_name, vod_sub, vod_class, vod_pic, 
             vod_actor, vod_director, vod_time, vod_area, vod_lang, 
             vod_year, vod_remarks, vod_score, vod_content
      FROM vod
      WHERE ${whereClause}
      ORDER BY ${sort} ${order}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `
    const dataResult = await this.client.query(dataQuery, [...queryParams, limit, offset])

    // 总数查询
    const countQuery = `
      SELECT COUNT(*) as total
      FROM vod
      WHERE ${whereClause}
    `
    const countResult = await this.client.query(countQuery, queryParams)
    const total = parseInt(countResult.rows[0]?.total || '0')
    const pagecount = Math.ceil(total / limit)

    return {
      list: dataResult.rows,
      total,
      page,
      limit,
      pagecount
    }
  }

  async getDetail(id: number): Promise<VodItem | null> {
    const result = await this.client.query(
      `SELECT vod_id,type_id, type_name, vod_name, vod_sub, vod_class, vod_pic, 
              vod_actor, vod_director, vod_time, vod_area, vod_lang, 
              vod_year, vod_remarks, vod_score, vod_content, vod_play_url
       FROM vod 
       WHERE vod_id = $1`,
      [id]
    )
    return result.rows[0] || null
  }

  async search(keyword: string, year: string, page: number = 1, size: number = 10): Promise<VodListResult> {
    const { limit, offset } = getPagination(page, size)
    // 判断是否包含汉字
    const hasChinese = /[\u4e00-\u9fa5]/.test(keyword)
    let baseWhere: string
    const params: any[] = []

    if (hasChinese) {
      // 含汉字：原有多字段模糊搜索
      params.push(`%${keyword}%`)
      baseWhere = `(vod_name ILIKE $1 OR vod_actor ILIKE $1 OR vod_director ILIKE $1)`
    } else {
      // 无汉字：vod_name_letter 右匹配 kw%
      params.push(`${keyword}%`)
      baseWhere = `(vod_name ILIKE $1 OR vod_name_letter ILIKE $1)`
    }

    let whereSql = baseWhere

    // year不为空才追加条件
    if (year && year.trim() !== '') {
      params.push(year.trim())
      whereSql += ` AND vod_year = $${params.length}`
    }

    const dataQuery = `
      SELECT vod_id,type_id,  type_name, vod_name, vod_sub, vod_class, vod_pic, 
             vod_actor, vod_director, vod_time, vod_area, vod_lang, 
             vod_year, vod_remarks, vod_score, vod_content
      FROM vod
      WHERE ${whereSql}
      ORDER BY vod_time DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `
    const dataResult = await this.client.query(dataQuery, [...params, limit, offset])

    const countQuery = `
      SELECT COUNT(*) as total
      FROM vod
      WHERE ${whereSql}
    `
    const countResult = await this.client.query(countQuery, params)
    const total = parseInt(countResult.rows[0]?.total || '0')
    const pagecount = Math.ceil(total / limit)

    return {
      list: dataResult.rows,
      total,
      page,
      limit,
      pagecount
    }
  }
}
