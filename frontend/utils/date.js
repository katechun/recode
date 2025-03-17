/**
 * 格式化日期字符串，使其在所有平台上都能被正确解析
 * @param {string} dateString - 原始日期字符串
 * @return {string} 格式化后的日期字符串
 */
function formatDateString(dateString) {
  if (!dateString) return '';
  
  // 如果是 yyyy-MM-dd HH:mm:ss 格式，转换为 ISO 格式
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(dateString)) {
    return dateString.replace(' ', 'T');
  }
  
  // 如果是 yyyy-MM-dd HH:mm 格式，转换为 ISO 格式
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(dateString)) {
    return dateString.replace(' ', 'T') + ':00';
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
  
  const formattedDate = formatDateString(dateString);
  return new Date(formattedDate);
}

module.exports = {
  formatDateString,
  createDate
}; 