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

  // ==========================================
  // UTILITIES
  // ==========================================

  async getYoutubeDuration(req, res) {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ success: false, message: "URL is required" });
    }
    try {
      if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
        return sendSuccess(res, 200, "Not a youtube URL", { duration: 0 });
      }
      const response = await fetch(url);
      const html = await response.text();
      const match = html.match(/"lengthSeconds":"(\d+)"/);
      let durationMinutes = 0;
      if (match && match[1]) {
        durationMinutes = Math.ceil(parseInt(match[1], 10) / 60);
      }
      return sendSuccess(res, 200, "Get youtube duration success", { duration: durationMinutes });
    } catch (error) {
      console.error("Error fetching youtube duration:", error);
      return sendSuccess(res, 200, "Failed to get duration", { duration: 0 });
    }
  }

  // ==========================================
  // BOTVN CONFIGURATION
  // ==========================================

  async getBotvnConfig(req, res) {
    const config = await CourseConfigService.getBotvnConfig();
    return sendSuccess(res, 200, "Lấy cấu hình BotVN thành công", { config });
  }

  async updateBotvnConfig(req, res) {
    const { config, changes } = await CourseConfigService.updateBotvnConfig(req.body);
    
    SystemLogService.log({
      action: "update",
      resource: RESOURCES.COURSES,
      resourceId: "botvn_config",
      resourceName: "Cấu hình BotVN",
      description: "Cập nhật cấu hình chung BotVN",
      metadata: { changes },
      req,
    });

    return sendSuccess(res, 200, "Cập nhật cấu hình BotVN thành công", { config });
  }
}

module.exports = new CourseConfigController();
