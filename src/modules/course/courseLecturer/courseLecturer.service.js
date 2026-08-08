const CourseLecturer = require('./courseLecturer.model');
const CourseOnline = require('../courseOnline/courseOnline.model');
const CourseOffline = require('../courseOffline/courseOffline.model');
const CourseChallenge = require('../courseChallenge/courseChallenge.model');
const { generateMonotonicId, ID_PREFIXES } = require('../../../core/utils/id');
const createHttpError = require("http-errors");
const { computeChanges } = require('../../../core/utils/diff');
const { getStartOfDayVN, getEndOfDayVN } = require('../../../core/utils/date');

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
          const start = getStartOfDayVN(date);
          const end = getEndOfDayVN(date);
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

  async checkLecturerInUse(id, force) {
    const onlineCourses = await CourseOnline.find({ "lecturers.lecturerId": id, isDeleted: { $ne: true } }, { id: 1, title: 1 }).lean();
    const offlineCourses = await CourseOffline.find({ "lecturers.lecturerId": id, isDeleted: { $ne: true } }, { id: 1, title: 1 }).lean();
    const challengeCourses = await CourseChallenge.find({ "lecturers.lecturerId": id, isDeleted: { $ne: true } }, { id: 1, title: 1 }).lean();

    const references = [
      ...onlineCourses.map((c) => ({ type: "Khóa học Online", id: c.id, name: c.title })),
      ...offlineCourses.map((c) => ({ type: "Khóa học Offline", id: c.id, name: c.title })),
      ...challengeCourses.map((c) => ({ type: "Khóa học Thử thách", id: c.id, name: c.title })),
    ];

    if (references.length > 0) {
      if (!force) {
        throw createHttpError(
          409,
          `Giảng viên này đang được gán vào ${references.length} khóa học.`,
          {
            code: "RESOURCE_IN_USE",
            references,
          }
        );
      } else {
        await CourseOnline.updateMany(
          { "lecturers.lecturerId": id },
          { $pull: { lecturers: { lecturerId: id } } }
        );
        await CourseOffline.updateMany(
          { "lecturers.lecturerId": id },
          { $pull: { lecturers: { lecturerId: id } } }
        );
        await CourseChallenge.updateMany(
          { "lecturers.lecturerId": id },
          { $pull: { lecturers: { lecturerId: id } } }
        );
      }
    }
  }

  async updateLecturer(id, data, force = false) {
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

    if (oldState.isActive !== false && lecturer.isActive === false) {
      await this.checkLecturerInUse(id, force);
    }

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

    await this.checkLecturerInUse(id, force);

    lecturer.isDeleted = true;
    lecturer.deletedAt = new Date();
    lecturer.slug = `${lecturer.slug}-deleted-${Date.now()}`;
    await lecturer.save();

    return lecturer;
  }
}

module.exports = new CourseLecturerService();
