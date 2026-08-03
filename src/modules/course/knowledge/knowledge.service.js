const Knowledge = require('./knowledge.model');
const KnowledgeCategory = require('./knowledgeCategory.model');
const KnowledgeRead = require('./knowledgeRead.model');
const { generateMonotonicId, ID_PREFIXES } = require('../../../core/utils/id');
const createHttpError = require('http-errors');
const { computeChanges } = require('../../../core/utils/diff');
const { KNOWLEDGE_STATUS } = require('../../../core/constants/appData');
const slugify = require('slugify');
const mongoose = require('mongoose');
const {
  buildPaginatedResponse,
  resolvePagination,
} = require('../../../core/utils/pagination');
const { buildSearchRegex } = require('../../../core/utils/query');
const { getStartOfDayVN } = require('../../../core/utils/date');

class KnowledgeService {
  // ==========================================
  // KNOWLEDGE CORE MANAGEMENT
  // ==========================================

  async getKnowledgeList(query) {
    const {
      search,
      category,
      status,
      type,
      excludeContent,
      sortField = 'createdAt',
      sortOrder = 'desc',
    } = query || {};

    const filter = { isDeleted: false };

    if (search) {
      const searchRegex = buildSearchRegex(search);
      if (searchRegex) {
        filter.$or = [{ title: searchRegex }, { id: searchRegex }];
      }
    }

    if (category) {
      const catObj = await KnowledgeCategory.findOne({ id: category })
        .select('id')
        .lean();
      if (catObj) {
        filter.category = catObj.id;
      } else {
        filter.category = 'invalid_id_no_match';
      }
    }

    if (status) filter.status = status;

    const { page, limit, skip } = resolvePagination(query || {});
    const sort = { [sortField]: sortOrder === 'desc' ? -1 : 1 };

    let queryBuilder = Knowledge.find(filter)
      .populate('categoryDetails')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    if (excludeContent) {
      queryBuilder = queryBuilder.select('-content');
    }

    const [items, total] = await Promise.all([
      queryBuilder.lean(),
      Knowledge.countDocuments(filter),
    ]);

    return buildPaginatedResponse(items, total, page, limit);
  }

  async getKnowledgeById(id) {
    const knowledge = await Knowledge.findOne({ id, isDeleted: false })
      .populate('categoryDetails')
      .lean();

    if (!knowledge) {
      throw createHttpError(404, 'Không tìm thấy bài viết');
    }

    return knowledge;
  }

  async getKnowledgeByIdentifier(
    identifier,
    requiredStatus = null,
    customer = null,
    clientIp = null,
  ) {
    const isId = identifier.startsWith(ID_PREFIXES.KNOWLEDGE);
    const filter = { isDeleted: false };

    if (isId) {
      filter.id = identifier;
    } else {
      filter.slug = identifier;
    }

    if (requiredStatus) {
      filter.status = requiredStatus;
    }

    const knowledge = await Knowledge.findOne(filter)
      .populate('categoryDetails')
      .lean();

    if (!knowledge) {
      throw createHttpError(404, 'Không tìm thấy bài viết');
    }

    // Deduplicated view count: only count once per visitor per day
    if (requiredStatus === KNOWLEDGE_STATUS.PUBLISHED) {
      const viewerKey = customer
        ? `user:${customer.id}`
        : `ip:${clientIp || 'unknown'}`;
      const today = getStartOfDayVN();

      try {
        const result = await KnowledgeRead.updateOne(
          { knowledgeId: knowledge.id, viewerKey, viewDate: today },
          {
            $setOnInsert: {
              readAt: new Date(),
              customerId: customer?.id || null,
            },
          },
          { upsert: true },
        );

        // Only increment viewCount if this is a new unique view (upserted)
        if (result.upsertedCount > 0) {
          await Knowledge.updateOne(
            { _id: knowledge._id },
            { $inc: { viewCount: 1 } },
          );
        }
      } catch (error) {
        if (error.code !== 11000) {
          throw error;
        }
      }
    }

    // Handle Paywall Logic for public endpoints
    if (requiredStatus === KNOWLEDGE_STATUS.PUBLISHED) {
      if (knowledge.content) {
        const paywallRegex = /<hr[^>]*data-paywall[^>]*>/i;
        if (paywallRegex.test(knowledge.content)) {
          if (!customer) {
            // Not logged in -> Truncate content and set flag
            const parts = knowledge.content.split(paywallRegex);
            knowledge.content = parts[0];
            knowledge.isGated = true;
          } else {
            // Logged in -> Remove the paywall divider so they see seamless content
            knowledge.content = knowledge.content.replace(paywallRegex, '');
            knowledge.isGated = false;
          }
        } else {
          knowledge.isGated = false;
        }
      }
    }

    return knowledge;
  }

  async createKnowledge(data, user) {
    // Generate slug
    let slug =
      data.slug ||
      slugify(data.title, { lower: true, strict: true, locale: 'vi' });

    // Check slug uniqueness
    const existingSlug = await Knowledge.findOne({ slug });
    if (existingSlug) {
      slug = `${slug}-${Date.now()}`;
    }

    const id = await generateMonotonicId(ID_PREFIXES.KNOWLEDGE);

    const knowledgeData = {
      ...data,
      id,
      slug,
      createdBy: user.id,
    };

    // Publish date logic
    if (data.status === KNOWLEDGE_STATUS.PUBLISHED && !data.publishedAt) {
      knowledgeData.publishedAt = new Date();
    }

    const knowledge = new Knowledge(knowledgeData);
    await knowledge.save();

    return knowledge;
  }

  async updateKnowledge(id, data, user) {
    const knowledge = await Knowledge.findOne({ id, isDeleted: false });

    if (!knowledge) {
      throw createHttpError(404, 'Không tìm thấy bài viết');
    }

    const oldState = knowledge.toObject();

    // Check slug if updated
    if (data.slug && data.slug !== knowledge.slug) {
      const existingSlug = await Knowledge.findOne({
        slug: data.slug,
        id: { $ne: id },
      });
      if (existingSlug) {
        throw createHttpError(400, 'Đường dẫn (slug) đã tồn tại');
      }
      knowledge.slug = data.slug;
    }

    // Publish date logic
    if (
      data.status === KNOWLEDGE_STATUS.PUBLISHED &&
      knowledge.status !== KNOWLEDGE_STATUS.PUBLISHED &&
      !knowledge.publishedAt
    ) {
      knowledge.publishedAt = new Date();
    }

    const fieldsToUpdate = [
      'title',
      'description',
      'coverImage',
      'status',
      'content',
      'category',
      'author',
      'isHot',
    ];

    fieldsToUpdate.forEach((field) => {
      if (data[field] !== undefined) {
        knowledge[field] = data[field];
      }
    });

    await knowledge.save();

    const newState = knowledge.toObject();
    const changes = computeChanges(oldState, newState);

    return { knowledge, changes };
  }

  async deleteKnowledge(id, user) {
    const knowledge = await Knowledge.findOne({ id, isDeleted: false });

    if (!knowledge) {
      throw createHttpError(404, 'Không tìm thấy bài viết');
    }

    knowledge.isDeleted = true;
    knowledge.deletedAt = new Date();
    // Free up slug for future use
    knowledge.slug = `${knowledge.slug}-deleted-${Date.now()}`;

    await knowledge.save();

    return knowledge;
  }

  // ==========================================
  // PUBLIC QUERIES
  // ==========================================

  async getHotPosts(limit = 5) {
    return await Knowledge.find({
      isDeleted: false,
      status: KNOWLEDGE_STATUS.PUBLISHED,
      isHot: true,
    })
      .select('-content')
      .populate('categoryDetails')
      .sort({ publishedAt: -1 })
      .limit(limit)
      .lean();
  }

  async getRelatedPosts(identifier, limit = 4) {
    // identifier can be id (KNL-...) or slug
    const query = { isDeleted: false };
    if (mongoose.Types.ObjectId.isValid(identifier)) {
      query._id = identifier;
    } else {
      query.$or = [{ slug: identifier }, { id: identifier }];
    }

    const knowledge = await Knowledge.findOne(query);

    if (!knowledge) return [];

    return await Knowledge.find({
      id: { $ne: knowledge.id }, // exclude current post by its actual id
      isDeleted: false,
      status: KNOWLEDGE_STATUS.PUBLISHED,
      category: { $in: knowledge.category },
    })
      .select('-content')
      .populate('categoryDetails')
      .sort({ publishedAt: -1 })
      .limit(limit)
      .lean();
  }

  // ==========================================
  // CATEGORY MANAGEMENT
  // ==========================================

  async getCategories() {
    return await KnowledgeCategory.find({ isDeleted: { $ne: true } }).lean();
  }

  async createCategory(data) {
    if (!data.name) throw createHttpError(400, 'Tên danh mục là bắt buộc');

    const category = new KnowledgeCategory({
      name: data.name,
      parentId: data.parentId || null,
      icon: data.icon || null,
      logo: data.logo || null,
      color: data.color || '#0668e1',
    });

    await category.save();
    return category;
  }

  async updateCategory(id, data) {
    const category = await KnowledgeCategory.findOne({ id, isDeleted: { $ne: true } });
    if (!category) throw createHttpError(404, 'Không tìm thấy danh mục');

    if (data.parentId === id) {
      throw createHttpError(400, 'Danh mục cha không hợp lệ');
    }

    const oldState = category.toObject();

    if (data.name !== undefined) category.name = data.name;
    if (data.parentId !== undefined) category.parentId = data.parentId || null;
    if (data.icon !== undefined) category.icon = data.icon || null;
    if (data.logo !== undefined) category.logo = data.logo || null;
    if (data.color !== undefined) category.color = data.color || '#0668e1';

    await category.save();

    const newState = category.toObject();
    const changes = computeChanges(oldState, newState);

    return { category, changes };
  }

  async deleteCategory(id, force) {
    const category = await KnowledgeCategory.findOne({ id, isDeleted: { $ne: true } });
    if (!category) throw createHttpError(404, 'Không tìm thấy danh mục');

    const hasChildren = await KnowledgeCategory.exists({ parentId: id });
    if (hasChildren && !force) {
      throw createHttpError(409, 'RESOURCE_IN_USE');
    }

    if (force) {
      await KnowledgeCategory.updateMany(
        { parentId: id },
        { $set: { parentId: null } },
      );
    }

    category.isDeleted = true;
    category.deletedAt = new Date();
    await category.save();
    return category;
  }
  // ==========================================
  // READERS MANAGEMENT
  // ==========================================

  async getReaders(id, query) {
    const { page, limit, skip } = resolvePagination(query || {});
    const { search } = query || {};

    const knowledge = await Knowledge.findOne({ id, isDeleted: false });
    if (!knowledge) {
      throw createHttpError(404, 'Không tìm thấy bài viết');
    }

    const matchQuery = { knowledgeId: knowledge.id };

    // If there is search, we need to lookup customer first.
    // However, the simplest way in mongoose with pagination is to populate and then filter?
    // Mongoose populate filter only filters the populated array, it doesn't filter the root document count unless we use aggregate.
    // Let's use aggregate.

    const pipeline = [
      { $match: { knowledgeId: knowledge.id } },
      {
        $lookup: {
          from: 'customers', // Assuming the collection name is customers
          localField: 'customerId',
          foreignField: 'id',
          as: 'customer',
        },
      },
      { $unwind: '$customer' },
    ];

    if (search) {
      const searchRegex = buildSearchRegex(search);
      if (searchRegex) {
        pipeline.push({
          $match: {
            $or: [
              { 'customer.name': searchRegex },
              { 'customer.email': searchRegex },
              { 'customer.phone': searchRegex },
            ],
          },
        });
      }
    }

    // Sort by readAt descending
    pipeline.push({ $sort: { readAt: -1 } });

    // Pagination
    const facet = {
      items: [{ $skip: skip }, { $limit: Number(limit) }],
      totalCount: [{ $count: 'count' }],
    };

    pipeline.push({ $facet: facet });

    const result = await KnowledgeRead.aggregate(pipeline);

    const items = result[0].items.map((item) => ({
      _id: item._id,
      readAt: item.readAt,
      customer: {
        id: item.customer.id,
        name: item.customer.name,
        email: item.customer.email,
        phone: item.customer.phone,
        avatar: item.customer.avatar,
      },
    }));

    const total = result[0].totalCount[0] ? result[0].totalCount[0].count : 0;

    return buildPaginatedResponse(items, total, page, limit);
  }
}

module.exports = new KnowledgeService();
