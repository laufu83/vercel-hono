// src/utils/res.ts
/**
 * 统一响应结构
 */
export interface ApiResponse<T = any> {
  code: number
  msg: string
  data: T
  timestamp?: number
  requestId?: string
}

export interface PageData<T = any> {
  list: T[]
  total: number
  page: number
  limit: number
  pagecount: number
}

export interface ResponseOptions {
  headers?: Record<string, string>
  status?: number
  timestamp?: boolean
  requestId?: string
}

/**
 * 生成请求 ID
 */
function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * 成功响应
 */
export function successResponse<T = any>(
  data: T = {} as T,
  options: ResponseOptions = {}
): Response {
  const { headers = {}, status = 200, timestamp = true, requestId } = options
  
  const response: ApiResponse<T> = {
    code: 0,
    msg: 'success',
    data,
  }
  
  if (timestamp) {
    response.timestamp = Date.now()
  }
  
  if (requestId) {
    response.requestId = requestId
  }
  
  return new Response(JSON.stringify(response), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  })
}

/**
 * 错误响应
 */
export function errorResponse(
  code: number,
  msg: string,
  data: unknown = null,
  options: ResponseOptions = {}
): Response {
  const { headers = {}, status = code >= 400 && code < 600 ? code : 500, timestamp = true, requestId } = options
  
  const response: ApiResponse = {
    code,
    msg,
    data,
  }
  
  if (timestamp) {
    response.timestamp = Date.now()
  }
  
  if (requestId) {
    response.requestId = requestId
  }
  
  return new Response(JSON.stringify(response), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  })
}

/**
 * 分页响应
 */
export function pageResponse<T = any>(
  list: T[],
  total: number,
  page: number,
  limit: number,
  options: ResponseOptions = {}
): Response {
  const pagecount = Math.ceil(total / limit) || 0
  
  const data: PageData<T> = {
    list,
    total,
    page,
    limit,
    pagecount,
  }
  
  return successResponse(data, options)
}

// ========== 快捷错误响应 ==========
export const badRequest = (msg: string = '请求参数错误', data: unknown = null) =>
  errorResponse(400, msg, data, { status: 400 })

export const unauthorized = (msg: string = '未授权，请先登录') =>
  errorResponse(401, msg, null, { status: 401 })

export const forbidden = (msg: string = '权限不足') =>
  errorResponse(403, msg, null, { status: 403 })

export const notFound = (msg: string = '资源不存在') =>
  errorResponse(404, msg, null, { status: 404 })

export const conflict = (msg: string = '资源冲突') =>
  errorResponse(409, msg, null, { status: 409 })

export const validationError = (msg: string = '数据验证失败', data: unknown = null) =>
  errorResponse(422, msg, data, { status: 422 })

export const tooManyRequests = (msg: string = '请求过于频繁，请稍后再试') =>
  errorResponse(429, msg, null, { status: 429 })

export const serverError = (msg: string = '服务器内部错误') =>
  errorResponse(500, msg, null, { status: 500 })

// ========== 工具函数 ==========
export const isSuccess = (response: ApiResponse): boolean => response.code === 0
export const isError = (response: ApiResponse): boolean => response.code !== 0