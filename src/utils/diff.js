const diff = require("microdiff");

/**
 * Đệ quy chuyển đổi ObjectId/Date sang string và loại bỏ các trường không cần thiết (id, _id, createdAt, updatedAt)
 */
function cleanObject(
  obj,
  ignoreKeys = ["updatedAt", "createdAt", "_id", "id"],
) {
  if (obj === null || obj === undefined) return obj;

  let clone;
  try {
    clone = JSON.parse(JSON.stringify(obj));
  } catch (e) {
    return obj;
  }

  function recurse(current) {
    if (typeof current !== "object" || current === null) return;

    if (Array.isArray(current)) {
      for (const item of current) {
        recurse(item);
      }
      return;
    }

    for (const key of Object.keys(current)) {
      if (ignoreKeys.includes(key)) {
        delete current[key];
      } else {
        recurse(current[key]);
      }
    }
  }

  recurse(clone);
  return clone;
}

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

  const ignoreKeys = ["updatedAt", "createdAt", "_id", "id"];

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

  // Làm sạch và chuẩn hóa kiểu dữ liệu đệ quy (ObjectId -> string, loại bỏ metadata ở mọi cấp)
  oldToCompare = cleanObject(oldToCompare, ignoreKeys);
  newToCompare = cleanObject(newToCompare, ignoreKeys);

  // Sử dụng microdiff để tìm các thay đổi (hỗ trợ nested object, array)
  // Trong môi trường CJS, đôi khi cần dùng diff.default
  const microdiff = diff.default || diff;
  const differences = microdiff(oldToCompare, newToCompare);

  for (const difference of differences) {
    // path của microdiff là mảng các keys, ví dụ ['address', 'city'] -> 'address.city'
    const pathStr = difference.path.join(".");

    if (difference.type === "CHANGE") {
      changes[pathStr] = { from: difference.oldValue, to: difference.value };
    } else if (difference.type === "CREATE") {
      changes[pathStr] = { from: null, to: difference.value };
    } else if (difference.type === "REMOVE") {
      changes[pathStr] = { from: difference.oldValue, to: null };
    }
  }

  return changes;
}

/**
 * Tạo mô tả tiếng Việt thân thiện từ danh sách thay đổi.
 * Ví dụ: " (Tên ("A" -> "B"), Trạng thái ("trống" -> "Khóa"))"
 */
function formatChangesText(changes, fieldLabels = {}) {
  if (!changes || Object.keys(changes).length === 0) return "";

  const parts = [];
  for (const [path, diff] of Object.entries(changes)) {
    const firstKey = path.split(".")[0];
    const label = fieldLabels[firstKey] || firstKey;

    let displayPath = label;
    if (path !== firstKey) {
      displayPath = `${label} (${path})`;
    }

    const fromVal =
      diff.from === null || diff.from === undefined || diff.from === ""
        ? "trống"
        : typeof diff.from === "object"
          ? JSON.stringify(diff.from)
          : `"${diff.from}"`;
    const toVal =
      diff.to === null || diff.to === undefined || diff.to === ""
        ? "trống"
        : typeof diff.to === "object"
          ? JSON.stringify(diff.to)
          : `"${diff.to}"`;
    parts.push(`${displayPath} (${fromVal} -> ${toVal})`);
  }

  return ` (${parts.join(", ")})`;
}

module.exports = {
  computeChanges,
  formatChangesText,
};
