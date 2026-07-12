const mongoose = require('mongoose');
const createHttpError = require('http-errors');
const CourseEnrollment = require('../course/courseChallenge/courseEnrollment.model');
const CourseChallenge = require('../course/courseChallenge/courseChallenge.model');
const CourseOnline = require('../course/courseOnline/courseOnline.model');
const CourseOffline = require('../course/courseOffline/courseOffline.model');
const Customer = require('../customer/customer/customer.model');
const SystemLogService = require('../system/log/systemLog.service');
const {
  ID_PREFIXES,
  generateMonotonicId,
  generateMonotonicIdsBatch,
} = require('../../core/utils/id');
const CreditTransaction = require('../customer/credit/creditTransaction.model');
const {
  COURSE_TYPES,
  PAYMENT_METHODS,
  COURSE_ENROLLMENT_STATUS,
  CREDIT_TRANSACTION_TYPES,
  CREDIT_TYPES,
  CREDIT_SOURCES,
  CREDIT_TRANSACTION_STATUS,
} = require('../../core/constants/appData');

class CheckoutService {
  /**
   * Process a bulk checkout of multiple courses
   * @param {string} studentId
   * @param {Array} items - [{ courseId, courseType, packageId, paymentMethod }]
   */
  async processCheckout(studentId, items) {
    if (!items || items.length === 0) {
      throw createHttpError(400, 'Giỏ hàng trống');
    }

    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      // Load customer
      const customer = await Customer.findOne({ id: studentId }).session(
        session,
      );
      if (!customer) {
        throw createHttpError(404, 'Không tìm thấy thông tin khách hàng');
      }

      if (!customer.isActive) {
        throw createHttpError(
          400,
          'Tài khoản đã bị khóa. Vui lòng liên hệ Admin',
        );
      }

      // --- BATCH DATA LOADING (Fix N+1 query problem) ---
      const challengeQueries = [];
      const onlineQueries = [];
      const offlineQueries = [];
      const allCourseIds = [];

      for (const item of items) {
        allCourseIds.push(item.courseId);
        const orQ = [{ id: item.courseId }];
        if (mongoose.Types.ObjectId.isValid(item.courseId)) {
          orQ.push({ _id: item.courseId });
        }

        if (item.courseType === COURSE_TYPES.CHALLENGE)
          challengeQueries.push(...orQ);
        else if (item.courseType === COURSE_TYPES.ONLINE)
          onlineQueries.push(...orQ);
        else if (item.courseType === COURSE_TYPES.OFFLINE)
          offlineQueries.push(...orQ);
      }

      const [challenges, onlines, offlines] = await Promise.all([
        challengeQueries.length
          ? CourseChallenge.find({
              $or: challengeQueries,
              isTemplate: false,
              isDeleted: { $ne: true },
            })
              .lean()
              .session(session)
          : [],
        onlineQueries.length
          ? CourseOnline.find({ $or: onlineQueries, isDeleted: { $ne: true } })
              .lean()
              .session(session)
          : [],
        offlineQueries.length
          ? CourseOffline.find({
              $or: offlineQueries,
              isDeleted: { $ne: true },
            })
              .lean()
              .session(session)
          : [],
      ]);

      const courseMap = new Map();
      const populateMap = (arr) =>
        arr.forEach((c) => {
          courseMap.set(c.id, c);
          if (c._id) courseMap.set(c._id.toString(), c);
        });
      populateMap(challenges);
      populateMap(onlines);
      populateMap(offlines);

      // Check existing enrollments
      const existingEnrollments = await CourseEnrollment.find({
        studentId,
        courseId: { $in: allCourseIds },
      })
        .lean()
        .session(session);
      const enrolledSet = new Set(existingEnrollments.map((e) => e.courseId));

      // Fetch active enrollments count for offline courses to check maxStudents
      const offlineCanonicalIds = offlines.map((c) => c.id);
      const offlineEnrollments =
        offlineCanonicalIds.length > 0
          ? await CourseEnrollment.find({
              courseId: { $in: offlineCanonicalIds },
              status: COURSE_ENROLLMENT_STATUS.ACTIVE,
            })
              .select('courseId')
              .lean()
              .session(session)
          : [];

      const countMap = new Map();
      for (const enr of offlineEnrollments) {
        countMap.set(enr.courseId, (countMap.get(enr.courseId) || 0) + 1);
      }

      // Pre-generate IDs
      const newIds = await generateMonotonicIdsBatch(
        ID_PREFIXES.COURSE_CHALLENGE_ENROLLMENT,
        items.length,
      );
      // ---------------------------------------------------

      let totalMainCreditRequired = 0;
      let totalRewardCreditRequired = 0;
      let totalEduCreditRequired = 0;
      const enrollmentsToCreate = [];
      const courseTitles = [];

      // Validate each item (In-memory loop)
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        let { courseId, courseType, packageId, paymentMethod } = item;

        const course = courseMap.get(courseId);

        if (!course || course.status !== 'published') {
          throw createHttpError(
            404,
            `Khóa học ${courseId} không tồn tại hoặc chưa mở bán`,
          );
        }

        if (
          courseType === COURSE_TYPES.OFFLINE &&
          course.registrationDeadline &&
          new Date(course.registrationDeadline).getTime() < Date.now()
        ) {
          throw createHttpError(
            400,
            `Khóa học ${course.title || courseId} đã hết hạn đăng ký`,
          );
        }

        // Reassign courseId to the canonical string ID from the document
        courseId = course.id;
        courseTitles.push(course.title || course.name || course.id);

        // Block if offline course is full
        if (courseType === COURSE_TYPES.OFFLINE && course.maxStudents > 0) {
          const registeredStudents = countMap.get(course.id) || 0;
          if (registeredStudents >= course.maxStudents) {
            throw createHttpError(
              400,
              `Khóa học ${course.id} đã đủ số lượng học viên tối đa`,
            );
          }
          // Increment locally in case multiple items map to same course
          countMap.set(course.id, registeredStudents + 1);
        }

        // Ensure user is not already enrolled
        if (enrolledSet.has(courseId)) {
          throw createHttpError(400, `Bạn đã đăng ký khóa học ${courseId} rồi`);
        }
        enrolledSet.add(courseId); // Mark enrolled locally to prevent duplicates in same cart

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
          case PAYMENT_METHODS.MAIN_CREDIT:
            totalMainCreditRequired += price;
            break;
          case PAYMENT_METHODS.REWARD_CREDIT:
            totalRewardCreditRequired += price;
            break;
          case PAYMENT_METHODS.EDU_CREDIT:
            if (!customer.isEduAccount) {
              throw createHttpError(
                400,
                `Phương thức thanh toán ${paymentMethod} chỉ dành cho tài khoản giáo dục`,
              );
            }
            totalEduCreditRequired += price;
            break;
          case PAYMENT_METHODS.FREE:
            break;
          default:
            throw createHttpError(
              400,
              `Phương thức thanh toán ${paymentMethod} không hợp lệ`,
            );
        }

        enrollmentsToCreate.push({
          id: newIds[i],
          courseId,
          courseType,
          studentId,
          packageId,
          paymentMethod,
          amountPaid: price,
          status: COURSE_ENROLLMENT_STATUS.ACTIVE,
          enrolledAt: new Date(),
          progress: [],
        });
      }

      const currentCredit = customer.mainCredit || 0;
      const currentRewardCredit = customer.rewardCredit || 0;
      const currentEduCredit = customer.eduCredit || 0;

      // Check balances
      if (currentCredit < totalMainCreditRequired) {
        throw createHttpError(
          400,
          `Số dư Credit không đủ. Cần thêm ${totalMainCreditRequired - currentCredit} Credit`,
        );
      }
      if (currentRewardCredit < totalRewardCreditRequired) {
        throw createHttpError(
          400,
          `Số dư Credit Thưởng không đủ. Cần thêm ${totalRewardCreditRequired - currentRewardCredit} Credit Thưởng`,
        );
      }
      if (currentEduCredit < totalEduCreditRequired) {
        throw createHttpError(
          400,
          `Số dư Credit Giáo dục không đủ. Cần thêm ${totalEduCreditRequired - currentEduCredit} Credit Giáo dục`,
        );
      }

      // Deduct balances and log transactions
      const transactionsToCreate = [];
      const transactionGroupId = await generateMonotonicId('TXG');
      const coursesStr = courseTitles.join(', ');

      if (totalMainCreditRequired > 0) {
        customer.mainCredit = currentCredit - totalMainCreditRequired;
        transactionsToCreate.push({
          userId: customer.id,
          amount: totalMainCreditRequired,
          creditType: CREDIT_TYPES.MAIN,
          transactionType: CREDIT_TRANSACTION_TYPES.OUT,
          source: CREDIT_SOURCES.COURSE_PURCHASE,
          reference: transactionGroupId,
          transactionGroupId,
          status: CREDIT_TRANSACTION_STATUS.SUCCESS,
          description: `Thanh toán ${totalMainCreditRequired} Credit chính cho: ${coursesStr}`,
        });
      }
      if (totalRewardCreditRequired > 0) {
        customer.rewardCredit = currentRewardCredit - totalRewardCreditRequired;
        transactionsToCreate.push({
          userId: customer.id,
          amount: totalRewardCreditRequired,
          creditType: CREDIT_TYPES.REWARD,
          transactionType: CREDIT_TRANSACTION_TYPES.OUT,
          source: CREDIT_SOURCES.COURSE_PURCHASE,
          reference: transactionGroupId,
          transactionGroupId,
          status: CREDIT_TRANSACTION_STATUS.SUCCESS,
          description: `Thanh toán ${totalRewardCreditRequired} Credit thưởng cho: ${coursesStr}`,
        });
      }
      if (totalEduCreditRequired > 0) {
        customer.eduCredit = currentEduCredit - totalEduCreditRequired;
        transactionsToCreate.push({
          userId: customer.id,
          amount: totalEduCreditRequired,
          creditType: CREDIT_TYPES.EDU,
          transactionType: CREDIT_TRANSACTION_TYPES.OUT,
          source: CREDIT_SOURCES.COURSE_PURCHASE,
          reference: transactionGroupId,
          transactionGroupId,
          status: CREDIT_TRANSACTION_STATUS.SUCCESS,
          description: `Thanh toán ${totalEduCreditRequired} Credit GD cho: ${coursesStr}`,
        });
      }

      await customer.save({ session });
      if (transactionsToCreate.length > 0) {
        await CreditTransaction.insertMany(transactionsToCreate, { session });
      }

      // Create enrollments
      await CourseEnrollment.insertMany(enrollmentsToCreate, { session });

      // Log transaction
      await SystemLogService.log(
        'create',
        'Checkout',
        studentId, // Or generate a generic transaction ID
        'checkout',
        {
          items,
          totalMainCreditRequired,
          totalRewardCreditRequired,
          totalEduCreditRequired,
          remainingCredit: customer.mainCredit,
          remainingRewardCredit: customer.rewardCredit,
          remainingEduCredit: customer.eduCredit,
        },
        studentId, // Actor
      );

      await session.commitTransaction();
      session.endSession();

      return {
        message: 'Thanh toán và đăng ký thành công',
        enrollments: enrollmentsToCreate,
        remainingCredit: customer.mainCredit,
        remainingRewardCredit: customer.rewardCredit,
        remainingEduCredit: customer.eduCredit,
      };
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }
}

module.exports = new CheckoutService();
