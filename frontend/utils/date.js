/**
 * 格式化日期字符串，使其在所有平台上都能被正确解析
 * @param {string} dateString - 原始日期字符串
 * @return {string} 格式化后的日期字符串，格式为"YYYY-MM-DD HH:MM:SS"
 */
function formatDateString(dateString) {
  if (!dateString) return '';

  // 如果是ISO格式，转换为标准格式
  if (dateString.includes('T')) {
    dateString = dateString.replace('T', ' ');
  }

  // 如果是 yyyy-MM-dd HH:mm:ss 格式，已经是标准格式，直接返回
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(dateString)) {
    return dateString;
  }

  // 如果是 yyyy-MM-dd HH:mm 格式，添加秒
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(dateString)) {
    return dateString + ':00';
  }

  // 如果是日期对象，转换为标准格式
  if (dateString instanceof Date) {
    const year = dateString.getFullYear();
    const month = String(dateString.getMonth() + 1).padStart(2, '0');
    const day = String(dateString.getDate()).padStart(2, '0');
    const hours = String(dateString.getHours()).padStart(2, '0');
    const minutes = String(dateString.getMinutes()).padStart(2, '0');
    const seconds = String(dateString.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  // 处理不规则格式，尝试转换为标准格式
  try {
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }
  } catch (e) {
    console.error('日期转换失败:', e);
  }

  return dateString;
}

/**
 * 创建跨平台兼容的日期对象
 * @param {string} dateString - 日期字符串
 * @return {Date} 日期对象
 */
function createDate(dateString) {
  if (!dateString) return new Date();

  // 如果是标准格式 (YYYY-MM-DD HH:MM:SS)，转为 ISO 格式以保证在iOS上也能正常解析
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(dateString)) {
    dateString = dateString.replace(' ', 'T');
  }

  return new Date(dateString);
}

module.exports = {
  formatDateString,
  createDate
}; 