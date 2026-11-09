// src/utils/query-builder.ts
export interface QueryParams {
  page?: string | number
  size?: string | number
  pid?: string | number
  type?: string | number
  year?: string
  area?: string
  lang?: string
  class?: string
  keyword?: string
  sort?: string
  order?: 'ASC' | 'DESC'
}

export interface FilterCondition {
  sql: string
  params: (string | number)[]
}

export function buildFilters(params: QueryParams): FilterCondition {
  const conditions: string[] = ['1=1']
  const values: (string | number)[] = []
  let paramIndex = 1

  const addCondition = (sqlTemplate: string, value: any) => {
    if (value === undefined || value === null || value === '') return
    conditions.push(sqlTemplate)
    values.push(value)
    paramIndex++
  }

  addCondition(`AND type_id_1 = $${paramIndex}`, params.pid)
  addCondition(`AND type_id = $${paramIndex}`, params.type)
  addCondition(`AND vod_year = $${paramIndex}`, params.year)
  addCondition(`AND vod_area = $${paramIndex}`, params.area)
  addCondition(`AND vod_lang = $${paramIndex}`, params.lang)

  if (params.class) {
    conditions.push(`AND vod_class ILIKE $${paramIndex}`)
    values.push(`%${params.class}%`)
    paramIndex++
  }

  if (params.keyword) {
    conditions.push(
      `AND (vod_name ILIKE $${paramIndex} OR vod_sub ILIKE $${paramIndex} OR vod_actor ILIKE $${paramIndex} OR vod_director ILIKE $${paramIndex})`
    )
    values.push(`%${params.keyword}%`)
    paramIndex++
  }

  return {
    sql: conditions.join(' '),
    params: values
  }
}

export function getPagination(page: number = 1, size: number = 10): { limit: number; offset: number } {
  const safePage = Math.max(1, page)
  const safeSize = Math.max(1, Math.min(50, size))
  return {
    limit: safeSize,
    offset: (safePage - 1) * safeSize
  }
}
