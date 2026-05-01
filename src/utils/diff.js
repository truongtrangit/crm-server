/**
 * So sánh 2 object và trả về các trường có sự thay đổi (dựa trên JSON.stringify).
 * 
 * @param {Object} oldObj Object cũ (thường là state trước khi update).
 * @param {Object} newObj Object mới (state sau khi update).
 * @param {Array<string>|null} keysToCheck Danh sách các key cần kiểm tra. Nếu null, sẽ kiểm tra dựa trên keys của oldObj.
 * @returns {Object} Object chứa chi tiết sự thay đổi dạng { [key]: { from, to } }
 */
function computeChanges(oldObj, newObj, keysToCheck = null) {
  const changes = {};
  
  if (!oldObj || !newObj) return changes;

  const keys = keysToCheck || Object.keys(oldObj);

  for (const key of keys) {
    // Bỏ qua các trường hệ thống không cần track diff
    if (['updatedAt', 'createdAt', '_id', 'id'].includes(key)) continue;

    if (JSON.stringify(oldObj[key]) !== JSON.stringify(newObj[key])) {
      changes[key] = {
        from: oldObj[key],
        to: newObj[key]
      };
    }
  }

  return changes;
}

module.exports = {
  computeChanges
};
