const CourseConfigService = require('./courseConfig.service');
const SystemLogService = require('../../system/log/systemLog.service');
const { RESOURCES } = require('../../../core/constants/rbac');
const { sendSuccess } = require('../../../core/utils/http');

class CourseConfigController {
  // ==========================================
  // CATEGORIES
  // ==========================================

  async getCategories(req, res) {
    const categories = await CourseConfigService.getCategories();
    return sendSuccess(res, 200, "Lấy danh sách danh mục thành công", {
      categories,
    });
  }

  async createCategory(req, res) {
    const category = await CourseConfigService.createCategory(req.body);
    SystemLogService.log({
      action: "create",
      resource: RESOURCES.COURSES,
      resourceId: category.id,
      resourceName: category.name,
      description: `Tạo danh mục khóa học mới: "${category.name}"`,
      metadata: { newItem: category },
      req,
    });
    return sendSuccess(res, 201, "Tạo danh mục thành công", { category });
  }

  async updateCategory(req, res) {
    const { category, changes } = await CourseConfigService.updateCategory(
      req.params.id,
      req.body,
    );
    SystemLogService.log({
      action: "update",
      resource: RESOURCES.COURSES,
      resourceId: req.params.id,
      resourceName: category.name,
      description: `Cập nhật danh mục khóa học: "${category.name}"`,
      metadata: { changes },
      req,
    });
    return sendSuccess(res, 200, "Cập nhật danh mục thành công", { category });
  }

  async deleteCategory(req, res) {
    const force = req.query.force === "true";
    const category = await CourseConfigService.deleteCategory(
      req.params.id,
      force,
    );
    SystemLogService.log({
      action: force ? "force_delete" : "delete",
      resource: RESOURCES.COURSES,
      resourceId: req.params.id,
      resourceName: category ? category.name : req.params.id,
      description: `Xóa danh mục khóa học: "${category ? category.name : req.params.id}"${force ? " (Force)" : ""}`,
      metadata: { deletedItem: category },
      req,
    });
    return sendSuccess(res, 200, "Xóa danh mục thành công");
  }

  // ==========================================
  // HASHTAGS
  // ==========================================

  async getHashtags(req, res) {
    const hashtags = await CourseConfigService.getHashtags();
    return sendSuccess(res, 200, "Lấy danh sách hashtag thành công", {
      hashtags,
    });
  }

  async createHashtag(req, res) {
    const hashtag = await CourseConfigService.createHashtag(req.body);
    SystemLogService.log({
      action: "create",
      resource: RESOURCES.COURSES,
      resourceId: hashtag.id,
      resourceName: hashtag.name,
      description: `Tạo hashtag mới: "${hashtag.name}"`,
      metadata: { newItem: hashtag },
      req,
    });
    return sendSuccess(res, 201, "Tạo hashtag thành công", { hashtag });
  }

  async updateHashtag(req, res) {
    const { hashtag, changes } = await CourseConfigService.updateHashtag(
      req.params.id,
      req.body,
    );
    SystemLogService.log({
      action: "update",
      resource: RESOURCES.COURSES,
      resourceId: req.params.id,
      resourceName: hashtag.name,
      description: `Cập nhật hashtag: "${hashtag.name}"`,
      metadata: { changes },
      req,
    });
    return sendSuccess(res, 200, "Cập nhật hashtag thành công", { hashtag });
  }

  async deleteHashtag(req, res) {
    const force = req.query.force === "true";
    const hashtag = await CourseConfigService.deleteHashtag(
      req.params.id,
      force,
    );
    SystemLogService.log({
      action: force ? "force_delete" : "delete",
      resource: RESOURCES.COURSES,
      resourceId: req.params.id,
      resourceName: hashtag ? hashtag.name : req.params.id,
      description: `Xóa hashtag: "${hashtag ? hashtag.name : req.params.id}"${force ? " (Force)" : ""}`,
      metadata: { deletedItem: hashtag },
      req,
    });
    return sendSuccess(res, 200, "Xóa hashtag thành công");
  }
}

module.exports = new CourseConfigController();
