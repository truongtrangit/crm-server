const knowledgeService = require('./knowledge.service');
const { sendSuccess } = require('../../../core/utils/http');

class KnowledgeController {
  // ==========================================
  // CORE MANAGEMENT
  // ==========================================

  async getKnowledgeList(req, res) {
    const isExternalRequest = req.originalUrl.includes('/external/');
    const query = { ...req.query };
    if (isExternalRequest) {
      query.status = 'published';
    }
    const result = await knowledgeService.getKnowledgeList(query);
    return sendSuccess(res, 200, 'Lấy danh sách thành công', result);
  }

  async getKnowledgeById(req, res) {
    const result = await knowledgeService.getKnowledgeById(req.params.id);
    return sendSuccess(res, 200, 'Lấy chi tiết thành công', { knowledge: result });
  }

  async getKnowledgeByIdentifier(req, res) {
    const { identifier } = req.params;
    // For external API calls, always force status = published
    const isExternalRequest = req.originalUrl.includes('/external/');
    const status = isExternalRequest ? 'published' : (req.query.status || null);
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;

    const result = await knowledgeService.getKnowledgeByIdentifier(
      identifier,
      status,
      req.user,
      clientIp
    );
    return sendSuccess(res, 200, 'Lấy chi tiết thành công', { knowledge: result });
  }

  async createKnowledge(req, res) {
    const result = await knowledgeService.createKnowledge(req.body, req.user);
    return sendSuccess(res, 201, 'Tạo bài viết thành công', { knowledge: result });
  }

  async updateKnowledge(req, res) {
    const result = await knowledgeService.updateKnowledge(
      req.params.id,
      req.body,
      req.user,
    );
    return sendSuccess(res, 200, 'Cập nhật bài viết thành công', result);
  }

  async deleteKnowledge(req, res) {
    const result = await knowledgeService.deleteKnowledge(
      req.params.id,
      req.user,
    );
    return sendSuccess(res, 200, 'Xóa bài viết thành công', { knowledge: result });
  }

  // ==========================================
  // PUBLIC QUERIES
  // ==========================================

  async getHotPosts(req, res) {
    const limit = parseInt(req.query.limit) || 5;
    const posts = await knowledgeService.getHotPosts(limit);
    return sendSuccess(res, 200, 'Lấy danh sách hot posts thành công', { posts });
  }

  async getRelatedPosts(req, res) {
    const limit = parseInt(req.query.limit) || 4;
    const posts = await knowledgeService.getRelatedPosts(
      req.params.id,
      limit,
    );
    return sendSuccess(res, 200, 'Lấy danh sách bài viết liên quan thành công', { posts });
  }

  // ==========================================
  // CATEGORY MANAGEMENT
  // ==========================================

  async getCategories(req, res) {
    const categories = await knowledgeService.getCategories();
    return sendSuccess(res, 200, 'Lấy danh mục thành công', { categories });
  }

  async createCategory(req, res) {
    const category = await knowledgeService.createCategory(req.body);
    return sendSuccess(res, 201, 'Tạo danh mục thành công', { category });
  }

  async updateCategory(req, res) {
    const result = await knowledgeService.updateCategory(
      req.params.id,
      req.body,
    );
    return sendSuccess(res, 200, 'Cập nhật danh mục thành công', result);
  }

  async deleteCategory(req, res) {
    const force = req.query.force === 'true';
    const category = await knowledgeService.deleteCategory(
      req.params.id,
      force,
    );
    return sendSuccess(res, 200, 'Xóa danh mục thành công', { category });
  }

  // ==========================================
  // READERS MANAGEMENT
  // ==========================================

  async getReaders(req, res) {
    const result = await knowledgeService.getReaders(req.params.id, req.query);
    return sendSuccess(res, 200, 'Lấy danh sách người đọc thành công', result);
  }

}

module.exports = new KnowledgeController();
