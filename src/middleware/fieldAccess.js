const { hasModuleAccess } = require("../utils/rbac");

/**
 * Middleware kiểm tra quyền truy cập Module và giới hạn trường dữ liệu (Field-Level Security).
 * Nếu user không có quyền với module tương ứng, họ sẽ bị giới hạn chỉ thấy các trường cơ bản.
 *
 * @param {string} moduleId - ID của module cần check (VD: "customers.biz" hoặc "customers")
 * @param {string[]} basicFields - Danh sách các trường được phép thấy nếu không có quyền
 */
function scopeFieldAccess(moduleId, basicFields) {
  return async (req, res, next) => {
    try {
      const hasAccess = await hasModuleAccess(req.user, moduleId);
      if (!hasAccess) {
        req.scopedFields = basicFields;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { scopeFieldAccess };
