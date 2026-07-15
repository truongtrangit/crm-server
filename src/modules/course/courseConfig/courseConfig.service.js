const CourseCategory = require('./courseCategory.model');
const CourseHashtag = require('./courseHashtag.model');
const { generateMonotonicId, ID_PREFIXES } = require('../../../core/utils/id');
const createHttpError = require("http-errors");
const { computeChanges } = require('../../../core/utils/diff');
const BotvnConfig = require('./botvnConfig.model');

class CourseConfigService {
  // ==========================================
  // CATEGORY MANAGEMENT
  // ==========================================

  async getCategories() {
    return await CourseCategory.find({ isDeleted: { $ne: true } }).lean();
  }

  async createCategory(data) {
    if (!data.name) {
      throw createHttpError(400, "Tên danh mục là bắt buộc");
    }

    const id = await generateMonotonicId(ID_PREFIXES.COURSE_CATEGORY);
    const category = new CourseCategory({
      id,
      name: data.name,
      parentId: data.parentId || null,
      icon: data.icon || null,
      logo: data.logo || null,
      color: data.color || "#0668e1",
    });

    await category.save();

    return category;
  }

  async updateCategory(id, data) {
    const category = await CourseCategory.findOne({ id, isDeleted: { $ne: true } });
    if (!category) {
      throw createHttpError(404, "Không tìm thấy danh mục");
    }

    if (data.parentId === id) {
      throw createHttpError(
        400,
        "Danh mục cha không hợp lệ (không thể chọn chính nó)",
      );
    }

    const oldState = category.toObject();

    if (data.name !== undefined) category.name = data.name;
    if (data.parentId !== undefined) category.parentId = data.parentId || null;
    if (data.icon !== undefined) category.icon = data.icon || null;
    if (data.logo !== undefined) category.logo = data.logo || null;
    if (data.color !== undefined) category.color = data.color || "#0668e1";

    await category.save();
    
    const newState = category.toObject();
    const changes = computeChanges(oldState, newState);

    return { category, changes };
  }

  async deleteCategory(id, force) {
    const category = await CourseCategory.findOne({ id, isDeleted: { $ne: true } });
    if (!category) {
      throw createHttpError(404, "Không tìm thấy danh mục");
    }

    // TODO: Phase 2 - Add Course check here
    // const hasCourses = await Course.exists({ categoryId: id });
    // if (hasCourses && !force) {
    //   throw createHttpError(409, "RESOURCE_IN_USE");
    // }

    const hasChildren = await CourseCategory.exists({ parentId: id });
    if (hasChildren && !force) {
      throw createHttpError(409, "RESOURCE_IN_USE");
    }

    if (force) {
      // Move children to root
      await CourseCategory.updateMany(
        { parentId: id },
        { $set: { parentId: null } },
      );

      // TODO: Phase 2 - Update courses
      // await Course.updateMany({ categoryId: id }, { $set: { categoryId: null } });
    }

    category.isDeleted = true;
    category.deletedAt = new Date();
    await category.save();

    return category;
  }

  // ==========================================
  // HASHTAG MANAGEMENT
  // ==========================================

  async getHashtags() {
    return await CourseHashtag.find({ isDeleted: { $ne: true } }).lean();
  }

  async createHashtag(data) {
    if (!data.name) {
      throw createHttpError(400, "Tên hashtag là bắt buộc");
    }

    let formattedName = data.name.trim();
    if (!formattedName.startsWith("#")) formattedName = "#" + formattedName;
    formattedName = formattedName.replace(/\s+/g, "_");

    const exists = await CourseHashtag.findOne({ name: formattedName, isDeleted: { $ne: true } });
    if (exists) {
      throw createHttpError(400, "Hashtag đã tồn tại");
    }

    const id = await generateMonotonicId(ID_PREFIXES.COURSE_HASHTAG);
    const hashtag = new CourseHashtag({
      id,
      name: formattedName,
      color: data.color || "#0668e1",
    });

    await hashtag.save();

    return hashtag;
  }

  async updateHashtag(id, data) {
    const hashtag = await CourseHashtag.findOne({ id, isDeleted: { $ne: true } });
    if (!hashtag) {
      throw createHttpError(404, "Không tìm thấy hashtag");
    }

    const oldState = hashtag.toObject();

    if (data.name !== undefined) {
      let formattedName = data.name.trim();
      if (!formattedName.startsWith("#")) formattedName = "#" + formattedName;
      formattedName = formattedName.replace(/\s+/g, "_");

      if (formattedName !== hashtag.name) {
        const exists = await CourseHashtag.findOne({ name: formattedName, isDeleted: { $ne: true } });
        if (exists) throw createHttpError(400, "Tên hashtag đã tồn tại");
      }
      hashtag.name = formattedName;
    }

    if (data.color !== undefined) hashtag.color = data.color || "#0668e1";

    await hashtag.save();

    const newState = hashtag.toObject();
    const changes = computeChanges(oldState, newState);

    return { hashtag, changes };
  }

  async deleteHashtag(id, force) {
    const hashtag = await CourseHashtag.findOne({ id, isDeleted: { $ne: true } });
    if (!hashtag) {
      throw createHttpError(404, "Không tìm thấy hashtag");
    }

    // TODO: Phase 2 - Add Course check here
    // const hasCourses = await Course.exists({ hashtags: id });
    // if (hasCourses && !force) {
    //   throw createHttpError(409, "RESOURCE_IN_USE");
    // }

    if (force) {
      // TODO: Phase 2 - Remove hashtag from courses
      // await Course.updateMany({ hashtags: id }, { $pull: { hashtags: id } });
    }

    hashtag.isDeleted = true;
    hashtag.deletedAt = new Date();
    hashtag.name = `${hashtag.name}-deleted-${Date.now()}`;
    await hashtag.save();

    return hashtag;
  }

  // ==========================================
  // BOTVN CONFIG MANAGEMENT
  // ==========================================

  async getBotvnConfig() {
    let config = await BotvnConfig.findOne();
    if (!config) {
      config = new BotvnConfig();
      await config.save();
    }
    return config.lean ? await BotvnConfig.findOne().lean() : config;
  }

  async updateBotvnConfig(data) {
    let config = await BotvnConfig.findOne();
    if (!config) {
      config = new BotvnConfig();
    }

    const oldState = config.toObject ? config.toObject() : config;

    if (data.menus !== undefined) {
      config.menus = {
        ...config.menus,
        ...data.menus,
      };
    }

    if (data.login !== undefined) {
      config.login = {
        ...config.login,
        ...data.login,
      };
    }

    if (data.maintenance !== undefined) {
      config.maintenance = {
        ...config.maintenance,
        ...data.maintenance,
      };
    }

    await config.save();
    
    const newState = config.toObject ? config.toObject() : config;
    const changes = computeChanges(oldState, newState);

    return { config, changes };
  }
}

module.exports = new CourseConfigService();
