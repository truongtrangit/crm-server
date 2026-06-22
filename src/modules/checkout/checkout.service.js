const mongoose = require("mongoose");
const createHttpError = require("http-errors");
const CourseEnrollment = require("../course/courseChallenge/courseEnrollment.model");
const CourseChallenge = require("../course/courseChallenge/courseChallenge.model");
const Customer = require("../customer/customer/customer.model");
const SystemLogService = require("../system/log/systemLog.service");
const { ID_PREFIXES, generateMonotonicId } = require("../../core/utils/id");
const {
  COURSE_TYPES,
  PAYMENT_METHODS,
} = require("../../core/constants/appData");

class CheckoutService {
  /**
   * Process a bulk checkout of multiple courses
   * @param {string} studentId
   * @param {Array} items - [{ courseId, courseType, packageId, paymentMethod }]
   */
  async processCheckout(studentId, items) {
    if (!items || items.length === 0) {
      throw createHttpError(400, "Giỏ hàng trống");
    }

    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      // Load customer
      const customer = await Customer.findOne({ id: studentId }).session(
        session,
      );
      if (!customer) {
        throw createHttpError(404, "Không tìm thấy thông tin khách hàng");
      }

      if (!customer.isActive) {
        throw createHttpError(
          400,
          "Tài khoản đã bị khóa. Vui lòng liên hệ Admin",
        );
      }

      let totalCreditRequired = 0;
      let totalRewardCreditRequired = 0;
      const enrollmentsToCreate = [];

      // Validate each item
      for (const item of items) {
        const { courseId, courseType, packageId, paymentMethod } = item;

        // Ensure user is not already enrolled
        const existingEnrollment = await CourseEnrollment.findOne({
          courseId,
          studentId,
        }).session(session);
        if (existingEnrollment) {
          throw createHttpError(400, `Bạn đã đăng ký khóa học ${courseId} rồi`);
        }

        let course;
        switch (courseType) {
          case COURSE_TYPES.CHALLENGE:
            course = await CourseChallenge.findOne({
              id: courseId,
              isTemplate: false,
              isDeleted: { $ne: true },
            }).session(session);
            break;
          case COURSE_TYPES.ONLINE:
            break;
          case COURSE_TYPES.OFFLINE:
            break;
          default:
            throw createHttpError(
              400,
              `Loại khóa học ${courseType} chưa được hỗ trợ`,
            );
        }

        if (!course || course.status !== "published") {
          throw createHttpError(
            404,
            `Khóa học ${courseId} không tồn tại hoặc chưa mở bán`,
          );
        }

        // Find package
        const pkg =
          course.packages && course.packages.find((p) => p.id === packageId);
        if (!pkg) {
          throw createHttpError(
            400,
            `Gói giá ${packageId} không tồn tại trong khóa học ${courseId}`,
          );
        }

        // Check payment method support
        if (!pkg.paymentTypes || !pkg.paymentTypes.includes(paymentMethod)) {
          throw createHttpError(
            400,
            `Phương thức thanh toán ${paymentMethod} không được hỗ trợ cho gói ${packageId}`,
          );
        }

        const price = pkg.price || 0;

        switch (paymentMethod) {
          case PAYMENT_METHODS.CREDIT:
            totalCreditRequired += price;
            break;
          case PAYMENT_METHODS.REWARD_CREDIT:
            totalRewardCreditRequired += price;
            break;
          case PAYMENT_METHODS.FREE:
            break;
          default:
            throw createHttpError(
              400,
              `Phương thức thanh toán ${paymentMethod} không hợp lệ`,
            );
        }

        const newId = await generateMonotonicId(
          ID_PREFIXES.COURSE_CHALLENGE_ENROLLMENT,
        );
        enrollmentsToCreate.push({
          id: newId,
          courseId,
          courseType,
          studentId,
          packageId,
          paymentMethod,
          amountPaid: price,
          status: "ACTIVE",
          enrolledAt: new Date(),
          progress: [],
        });
      }

      // Check balances
      if (customer.credit < totalCreditRequired) {
        throw createHttpError(
          400,
          `Số dư Credit không đủ. Cần thêm ${totalCreditRequired - (customer.credit || 0)} Credit`,
        );
      }
      if (customer.rewardCredit < totalRewardCreditRequired) {
        throw createHttpError(
          400,
          `Số dư Credit Thưởng không đủ. Cần thêm ${totalRewardCreditRequired - (customer.rewardCredit || 0)} Credit Thưởng`,
        );
      }

      // Deduct balances
      if (totalCreditRequired > 0) {
        customer.credit -= totalCreditRequired;
      }
      if (totalRewardCreditRequired > 0) {
        customer.rewardCredit -= totalRewardCreditRequired;
      }

      await customer.save({ session });

      // Create enrollments
      await CourseEnrollment.insertMany(enrollmentsToCreate, { session });

      // Log transaction
      await SystemLogService.log(
        "create",
        "Checkout",
        studentId, // Or generate a generic transaction ID
        "checkout",
        {
          items,
          totalCreditRequired,
          totalRewardCreditRequired,
          remainingCredit: customer.credit,
          remainingRewardCredit: customer.rewardCredit,
        },
        studentId, // Actor
      );

      await session.commitTransaction();
      session.endSession();

      return {
        message: "Thanh toán và đăng ký thành công",
        enrollments: enrollmentsToCreate,
        remainingCredit: customer.credit,
        remainingRewardCredit: customer.rewardCredit,
      };
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }
}

module.exports = new CheckoutService();
