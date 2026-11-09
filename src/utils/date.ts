/**
 * 通用北京时间格式化工具 (UTC+8)
 * 输出格式：YYYY-MM-DD HH:mm:ss
 */
export function formatCNDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '';

  const date = new Date(dateStr);
  // 转为北京时间 UTC+8
  const utc8Time = date.getTime() + 8 * 60 * 60 * 1000;
  const utc8Date = new Date(utc8Time);

  return utc8Date.toISOString().slice(0, 19).replace('T', ' ');
}