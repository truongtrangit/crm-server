const diff = require("microdiff");

/**
 * So sánh 2 object và trả về các trường có sự thay đổi một cách chi tiết (deep diff).
 * 
 * @param {Object} oldObj Object cũ (thường là state trước khi update).
 * @param {Object} newObj Object mới (state sau khi update).
 * @param {Array<string>|null} keysToCheck Danh sách các key ở top-level cần kiểm tra. Nếu null, sẽ kiểm tra tất cả.
 * @returns {Object} Object chứa chi tiết sự thay đổi dạng { [path]: { from, to } }
 */
function computeChanges(oldObj, newObj, keysToCheck = null) {
  const changes = {};
  
  if (!oldObj || !newObj) return changes;

  // Lọc ra các object chỉ chứa các trường cần kiểm tra để microdiff chạy nhẹ và chính xác hơn
  let oldToCompare = oldObj;
  let newToCompare = newObj;

  const ignoreKeys = ['updatedAt', 'createdAt', '_id', 'id'];

  if (keysToCheck) {
    oldToCompare = {};
    newToCompare = {};
    for (const key of keysToCheck) {
      if (!ignoreKeys.includes(key)) {
        oldToCompare[key] = oldObj[key];
        newToCompare[key] = newObj[key];
      }
    }
  } else {
    // Nếu không có keysToCheck, ta loại bỏ các trường ignoreKeys
    oldToCompare = { ...oldObj };
    newToCompare = { ...newObj };
    for (const key of ignoreKeys) {
      delete oldToCompare[key];
      delete newToCompare[key];
    }
  }

  // Sử dụng microdiff để tìm các thay đổi (hỗ trợ nested object, array)
  // Trong môi trường CJS, đôi khi cần dùng diff.default
  const microdiff = diff.default || diff;
  const differences = microdiff(oldToCompare, newToCompare);

  for (const difference of differences) {
    // path của microdiff là mảng các keys, ví dụ ['address', 'city'] -> 'address.city'
    const pathStr = difference.path.join('.');
    
    if (difference.type === 'CHANGE') {
      changes[pathStr] = { from: difference.oldValue, to: difference.value };
    } else if (difference.type === 'CREATE') {
      changes[pathStr] = { from: null, to: difference.value };
    } else if (difference.type === 'REMOVE') {
      changes[pathStr] = { from: difference.oldValue, to: null };
    }
  }

  return changes;
}

module.exports = {
  computeChanges
};
