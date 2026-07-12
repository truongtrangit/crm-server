const { computeChanges } = require('../../core/utils/diff');
const { escapeRegex } = require('../../core/utils/query');
const { generateMonotonicId } = require('../../core/utils/id');
const { createHttpError } = require('../../core/utils/http');

class FinanceCategoryBaseService {
  constructor(CategoryModel, MainModel, categoryIdPrefix, recordName) {
    this.CategoryModel = CategoryModel;
    this.MainModel = MainModel;
    this.categoryIdPrefix = categoryIdPrefix;
    this.recordName = recordName; // e.g. "doanh thu" or "phiếu chi"
  }

  async getCategories(query = {}) {
    const filter = {};
    if (query.search) {
      filter.name = { $regex: escapeRegex(query.search), $options: 'i' };
    }
    if (query.isActive !== undefined) {
      filter.isActive = query.isActive === 'true' || query.isActive === true;
    }
    return this.CategoryModel.find(filter)
      .populate('parentId', 'id name')
      .sort({ createdAt: -1 })
      .lean();
  }

  async createCategory(data) {
    const id = await generateMonotonicId(this.categoryIdPrefix);
    const category = new this.CategoryModel({
      name: data.name,
      description: data.description,
      isActive: data.isActive,
      id,
    });
    await category.save();

    if (data.subCategories && Array.isArray(data.subCategories)) {
      const bulkOps = [];
      for (const sub of data.subCategories) {
        if (!sub.name || sub.name === '') continue;
        const subIdStr = await generateMonotonicId(this.categoryIdPrefix);
        bulkOps.push({
          insertOne: {
            document: {
              name: sub.name,
              isActive: sub.isActive !== undefined ? sub.isActive : true,
              id: subIdStr,
              parentId: category._id,
              createdAt: new Date(),
              updatedAt: new Date()
            }
          }
        });
      }
      if (bulkOps.length > 0) {
        await this.CategoryModel.bulkWrite(bulkOps);
      }
    }

    return category;
  }

  async updateCategory(id, data) {
    const category = await this.CategoryModel.findOne({ id });
    if (!category) {
      throw createHttpError(404, 'Không tìm thấy danh mục');
    }

    const oldState = category.toObject();
    if (data.name !== undefined) category.name = data.name;
    if (data.description !== undefined) category.description = data.description;
    if (data.isActive !== undefined) category.isActive = data.isActive;

    await category.save();

    if (data.subCategories && Array.isArray(data.subCategories)) {
      const existingSubs = await this.CategoryModel.find({
        parentId: category._id,
      }).lean();
      const subIdsToKeep = data.subCategories
        .filter((s) => s.id)
        .map((s) => s.id);

      const bulkOps = [];

      // 1. Prepare Deletions
      const subsToDelete = existingSubs.filter(
        (ex) => !subIdsToKeep.includes(ex.id),
      );
      if (subsToDelete.length > 0) {
        const idsToDelete = subsToDelete.map((ex) => ex._id);
        const usedCategoryIds = await this.MainModel.distinct('category', {
          category: { $in: idsToDelete },
        });

        if (usedCategoryIds.length > 0) {
          const usedNames = subsToDelete
            .filter((ex) =>
              usedCategoryIds.some((uc) => uc.toString() === ex._id.toString()),
            )
            .map((ex) => ex.name);
          throw createHttpError(
            400,
            `Danh mục con "${usedNames.join(', ')}" đang được sử dụng trong ${this.recordName}, không thể xóa`,
          );
        }

        bulkOps.push({
          deleteMany: {
            filter: { _id: { $in: idsToDelete } },
          },
        });
      }

      // 2. Prepare Updates & Inserts
      for (const sub of data.subCategories) {
        if (!sub.name) continue;
        if (sub.id) {
          bulkOps.push({
            updateOne: {
              filter: { id: sub.id, parentId: category._id },
              update: {
                $set: {
                  name: sub.name,
                  isActive: sub.isActive !== undefined ? sub.isActive : true,
                  updatedAt: new Date(),
                },
              },
            },
          });
        } else {
          const subIdStr = await generateMonotonicId(this.categoryIdPrefix);
          bulkOps.push({
            insertOne: {
              document: {
                name: sub.name,
                isActive: sub.isActive !== undefined ? sub.isActive : true,
                id: subIdStr,
                parentId: category._id,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            },
          });
        }
      }

      // 3. Execute Bulk Write
      if (bulkOps.length > 0) {
        await this.CategoryModel.bulkWrite(bulkOps);
      }
    }

    const newState = category.toObject();
    const changes = computeChanges(oldState, newState);
    return { category, changes };
  }

  async deleteCategory(id, force = false) {
    const category = await this.CategoryModel.findOne({ id }).lean();
    if (!category) {
      throw createHttpError(404, 'Không tìm thấy danh mục');
    }

    const subCategories = await this.CategoryModel.find({ parentId: category._id }).lean();
    const allIds = [category._id, ...subCategories.map((s) => s._id)];

    const isUsed = await this.MainModel.exists({ category: { $in: allIds } });
    if (isUsed && !force) {
      throw createHttpError(
        400,
        `Danh mục đang được sử dụng trong ${this.recordName}, không thể xóa`,
        { code: 'RESOURCE_IN_USE' },
      );
    }

    if (isUsed && force) {
      // Remove category reference from all records using this category
      await this.MainModel.updateMany(
        { category: { $in: allIds } },
        { $set: { category: null } },
      );
    }

    await this.CategoryModel.deleteMany({ _id: { $in: allIds } });
    return category;
  }
}

module.exports = FinanceCategoryBaseService;
