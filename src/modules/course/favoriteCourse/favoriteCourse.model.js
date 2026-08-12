const mongoose = require('mongoose');
const { COURSE_TYPES } = require('../../../core/constants/appData');

const favoriteCourseSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    customerId: { type: String, required: true },
    courseId: { type: String, required: true },
    courseType: {
      type: String,
      enum: Object.values(COURSE_TYPES),
      required: true,
    },
    addedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    versionKey: false,
    id: false,
  },
);

// Mỗi customer chỉ favorite 1 course 1 lần
favoriteCourseSchema.index(
  { customerId: 1, courseId: 1 },
  { unique: true },
);

// Lấy danh sách favorite của 1 customer, sort mới nhất
favoriteCourseSchema.index({ customerId: 1, addedAt: -1 });

// Analytics: đếm bao nhiêu user yêu thích 1 course
favoriteCourseSchema.index({ courseId: 1 });

module.exports = mongoose.model('FavoriteCourse', favoriteCourseSchema);
