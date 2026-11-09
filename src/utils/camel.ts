/**
 * 下划线命名 转 驼峰命名（递归）
 * 支持对象、数组、深层嵌套
 */
export function snakeToCamel<T>(obj: T): T {
  // 如果是 null 或 非对象，直接返回
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  // 如果是数组，递归处理每一项
  if (Array.isArray(obj)) {
    return obj.map(snakeToCamel) as T;
  }

  // 把 obj 安全转成普通对象 👇 这行修复了 TS 报错
  const input = obj as Record<string, unknown>;

  // 对象：转换 key
  return Object.keys(input).reduce((camelObj, key) => {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    // 👇 这里不再报错
    (camelObj as Record<string, unknown>)[camelKey] = snakeToCamel(input[key]);
    return camelObj;
  }, {} as T);
}