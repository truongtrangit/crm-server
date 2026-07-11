const mongoose = require("mongoose");
const { COURSE_STATUS, PAYMENT_METHODS, LESSON_ACCESS_LEVEL } = require("../../../core/constants/appData");

const lecturerSchema = new mongoose.Schema(
  {
    lecturerId: {
      type: String,
      required: true,
      ref: "CourseLecturer",
    },
    isMain: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false, toJSON: { virtuals: true }, toObject: { virtuals: true } },
);

lecturerSchema.virtual("details", {
  ref: "CourseLecturer",
  localField: "lecturerId",
  foreignField: "id",
  justOne: true,
});

const lessonSchema = new mongoose.Schema(
  {
    id: { type: String },
    title: { type: String, required: true },
    duration: { type: Number, default: 0 },
    accessLevel: { type: String, enum: Object.values(LESSON_ACCESS_LEVEL), default: LESSON_ACCESS_LEVEL.PAID },
    videoUrl: { type: String, default: "" }, // Mặc dù offline không có video học, vẫn giữ cho đồng bộ data structure
    attachments: [
      {
        name: { type: String },
        url: { type: String },
      },
    ],
    description: { type: String, default: "" },
  },
  { _id: false }
);

const chapterSchema = new mongoose.Schema(
  {
    id: { type: String },
    title: { type: String, required: true },
    lessons: { type: [lessonSchema], default: [] },
  },
  { _id: false }
);

const pricingPackageSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  originalPrice: { type: Number, default: 0, min: 0 },
  discountRate: { type: Number, default: 0, min: 0 },
  paymentTypes: { type: [{ type: String, enum: Object.values(PAYMENT_METHODS) }], default: [PAYMENT_METHODS.MAIN_CREDIT] },
  gifts: { type: [String], default: [] },
  hasRefundPolicy: { type: Boolean, default: false }
}, { _id: false });

const courseOfflineSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      unique: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
      required: true,
    },
    category: {
      type: [{
        type: String,
        ref: "CourseCategory",
      }],
      default: [],
    },
    status: {
      type: String,
      enum: Object.values(COURSE_STATUS),
      default: COURSE_STATUS.DRAFT,
    },
    type: {
      type: String,
      default: "offline",
    },
    isBestseller: {
      type: Boolean,
      default: false,
    },
    headline: {
      type: String,
      default: "",
    },
    subheadline: {
      type: String,
      default: "",
    },
    packages: {
      type: [pricingPackageSchema],
      default: [],
    },
    minPrice: {
      type: Number,
      default: 0,
      index: true,
    },
    maxPrice: {
      type: Number,
      default: 0,
      index: true,
    },
    covers: {
      type: [String],
      default: [],
    },
    previewVideo: {
      type: [String],
      default: [],
    },
    benefits: {
      type: [String],
      default: [],
    },
    tools: {
      type: [String],
      default: [],
    },
    requirements: {
      type: [String],
      default: [],
    },
    hashtags: {
      type: [{
        type: String,
        ref: "CourseHashtag",
      }],
      default: [],
    },
    targetAudience: {
      type: String,
      default: "",
    },
    description: {
      type: String, // Rich HTML
      default: "",
    },
    location: {
      type: String,
      default: "", // Vị trí tỉnh thành, vd: Hà Nội (Cầu Giấy)
    },
    address: {
      type: String,
      default: "", // Địa chỉ cụ thể
    },
    startDate: {
      type: Date,
      default: null, // Ngày khai giảng
    },
    registrationDeadline: {
      type: Date,
      default: null, // Hạn đăng ký
    },
    schedule: {
      type: String,
      default: "", // Lịch học, VD: Thứ 7, Chủ Nhật
    },
    maxStudents: {
      type: Number,
      default: 0, // Số học viên tối đa
    },
    lecturers: {
      type: [lecturerSchema],
      default: [],
    },
    curriculum: {
      type: [chapterSchema],
      default: [],
    },
    createdBy: {
      type: String, // req.user.id
      required: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

courseOfflineSchema.virtual("categoryDetails", {
  ref: "CourseCategory",
  localField: "category",
  foreignField: "id",
  justOne: false,
});

courseOfflineSchema.virtual("hashtagDetails", {
  ref: "CourseHashtag",
  localField: "hashtags",
  foreignField: "id",
  justOne: false,
});

module.exports = mongoose.model("CourseOffline", courseOfflineSchema);
