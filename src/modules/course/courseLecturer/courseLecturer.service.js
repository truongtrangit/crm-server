const CourseLecturer = require('./courseLecturer.model');
const { generateMonotonicId, ID_PREFIXES } = require('../../../core/utils/id');
const createHttpError = require("http-errors");
const { computeChanges } = require('../../../core/utils/diff');

class CourseLecturerService {
  async getLecturers(queryParams = {}) {
    const { search, createdAt } = queryParams;
    const query = { isDeleted: { $ne: true } };

    if (search) {
      const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      query.$or = [
        { name: searchRegex },
        { slug: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
        { title: searchRegex },
      ];
    }

    if (createdAt) {
      if (typeof createdAt === 'object') {
        // e.g. { $gte: '2026-06-01', $lte: '2026-06-09' }
        query.createdAt = createdAt;
      } else {
        const date = new Date(createdAt);
        if (!isNaN(date)) {
          const start = new Date(date.setHours(0, 0, 0, 0));
          const end = new Date(date.setHours(23, 59, 59, 999));
          query.createdAt = { $gte: start, $lte: end };
        }
      }
    }

    return await CourseLecturer.find(query).sort({ createdAt: -1 }).lean();
  }

  async getLecturerById(id) {
    const lecturer = await CourseLecturer.findOne({ id, isDeleted: { $ne: true } }).lean();
    if (!lecturer) {
      throw createHttpError(404, "Không tìm thấy giảng viên");
    }
    return lecturer;
  }

  async createLecturer(data, user) {
    const id = await generateMonotonicId(ID_PREFIXES.COURSE_LECTURER);

    const lecturer = new CourseLecturer({
      id,
      ...data,
      createdBy: user.id,
    });

    await lecturer.save();
    return lecturer;
  }

  async updateLecturer(id, data) {
    const lecturer = await CourseLecturer.findOne({ id, isDeleted: { $ne: true } });
    if (!lecturer) {
      throw createHttpError(404, "Không tìm thấy giảng viên");
    }

    const oldState = lecturer.toObject();

    const allowedFields = [
      "name",
      "email",
      "phone",
      "title",
      "bio",
      "shortDescription",
      "slug",
      "password",
      "tags",
      "avatar",
      "rating",
      "socialLinks",
      "isActive",
      "isVerified",
      "isFeatured",
    ];

    allowedFields.forEach((field) => {
      if (data[field] !== undefined) {
        lecturer[field] = data[field];
      }
    });

    await lecturer.save();

    const newState = lecturer.toObject();
    const changes = computeChanges(oldState, newState);

    return { lecturer, changes };
  }

  async deleteLecturer(id, force = false) {
    const lecturer = await CourseLecturer.findOne({ id, isDeleted: { $ne: true } });
    if (!lecturer) {
      throw createHttpError(404, "Không tìm thấy giảng viên");
    }

    // TODO: Phase 2 - Add Course check here
    // const hasCourses = await Course.exists({ lecturerId: id });
    // if (hasCourses && !force) {
    //   throw createHttpError(409, "RESOURCE_IN_USE");
    // }

    // if (force) {
    //   await Course.updateMany({ lecturerId: id }, { $set: { lecturerId: null } });
    // }

    lecturer.isDeleted = true;
    lecturer.deletedAt = new Date();
    lecturer.slug = `${lecturer.slug}-deleted-${Date.now()}`;
    await lecturer.save();

    return lecturer;
  }
}

module.exports = new CourseLecturerService();
