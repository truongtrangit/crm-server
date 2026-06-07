/**
 * Lọc các trường trong một object dựa vào danh sách keys cho phép
 * @param {Object} obj
 * @param {string[]} keys
 * @returns {Object}
 */
function pickFields(obj, keys) {
  if (!obj || typeof obj !== "object") return obj;
  const result = {};
  keys.forEach((key) => {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  });
  return result;
}

module.exports = { pickFields };
