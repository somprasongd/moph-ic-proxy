// ถอด credential ออกจาก axios config ก่อนเอาไป log
// เพื่อไม่ให้ Bearer token หลุดเข้า log file
const redactConfig = (config) => {
  if (!config) {
    return config;
  }
  const headers = config.headers ? { ...config.headers } : undefined;
  if (headers && 'Authorization' in headers) {
    headers.Authorization = 'Bearer ***';
  }
  return { ...config, headers };
};

module.exports = { redactConfig };
