const SalaryRecord = require('./salaryRecord.model');
const Staff = require('../../hr/staff/staff.model');
const { computeChanges } = require('../../../core/utils/diff');
const { STAFF_STATUS } = require('../../../core/constants/finance');

class SalaryService {
  /**
   * Sinh bảng lương cho một tháng cụ thể
   * @param {string} month - Định dạng MM/YYYY
   */
  async generateSalaryForMonth(month) {
    console.log(`Starting salary generation for month: ${month}`);

    // Parse month to get the end of the month date for probation/resigned checks
    const [m, y] = month.split('/');
    const monthYearStr = `${y}-${m}-01`;
    const startOfMonth = new Date(monthYearStr);
    const endOfMonth = new Date(
      startOfMonth.getFullYear(),
      startOfMonth.getMonth() + 1,
      0,
    );

    // Lấy tất cả staff và các bảng lương đã có trong tháng
    const [staffs, existingRecords] = await Promise.all([
      Staff.find().lean(),
      SalaryRecord.find({ month }).lean(),
    ]);

    const existingRecordMap = new Map();
    for (const record of existingRecords) {
      existingRecordMap.set(record.staffId.toString(), record);
    }

    let generatedCount = 0;
    const bulkOps = [];

    for (const staff of staffs) {
      // Bỏ qua nhân sự nghỉ việc TRƯỚC tháng sinh lương
      if (staff.status === STAFF_STATUS.RESIGNED && staff.resignationDate) {
        const resignDate = new Date(staff.resignationDate);
        if (resignDate < startOfMonth) {
          continue; // Đã nghỉ việc trước tháng này, không tính lương
        }
      }

      // Bỏ qua nhân sự chưa vào làm ở tháng sinh lương (onboardDate sau cuối tháng)
      if (staff.onboardDate) {
        const obDate = new Date(staff.onboardDate);
        if (obDate > endOfMonth) {
          continue;
        }
      }

      // Lấy lương cơ bản từ cấu hình (salaryConfigs) có effectiveDate gần nhất <= endOfMonth
      let basicSalary = 0;
      let bhxh = 0;
      let pit = 0;
      if (staff.salaryConfigs && staff.salaryConfigs.length > 0) {
        // Sắp xếp giảm dần theo ngày
        const sortedConfigs = [...staff.salaryConfigs].sort((a, b) => {
          return (
            new Date(b.effectiveDate).getTime() -
            new Date(a.effectiveDate).getTime()
          );
        });

        // Tìm cấu hình đang áp dụng
        const activeConfig = sortedConfigs.find((c) => {
          if (!c.effectiveDate) return true;
          return new Date(c.effectiveDate) <= endOfMonth;
        });

        if (activeConfig) {
          basicSalary = activeConfig.basicSalary || 0;
          bhxh = activeConfig.bhxh || 0;
          pit = activeConfig.pit || 0;
        } else {
          // Nếu không có cấu hình nào thỏa mãn, lấy cấu hình cũ nhất
          basicSalary =
            sortedConfigs[sortedConfigs.length - 1].basicSalary || 0;
          bhxh = sortedConfigs[sortedConfigs.length - 1].bhxh || 0;
          pit = sortedConfigs[sortedConfigs.length - 1].pit || 0;
        }
      }

      // Kiểm tra xem đã có record cho tháng này chưa
      const existingRecord = existingRecordMap.get(staff._id.toString());
      if (existingRecord) {
        // Nếu đã có nhưng đang pending và lương cơ bản thay đổi -> Cập nhật lại
        if (
          existingRecord.status === 'pending' &&
          (existingRecord.basicSalary !== basicSalary ||
            existingRecord.bhxh !== bhxh ||
            existingRecord.pit !== pit)
        ) {
          const actualWDS = existingRecord.actualWorkingDaySalary;
          const hasActualWDS = actualWDS !== undefined && actualWDS !== null;
          const baseForTotal = hasActualWDS ? actualWDS : basicSalary;

          const newTotal =
            baseForTotal +
            (existingRecord.allowance || 0) +
            (existingRecord.bonus || 0) +
            (existingRecord.ot || 0);
          const newFinalReceivedAmount =
            newTotal -
            (existingRecord.penalty || 0) -
            (existingRecord.deduction || 0) -
            (bhxh || existingRecord.bhxh || 0) -
            (pit || existingRecord.pit || 0);

          bulkOps.push({
            updateOne: {
              filter: { _id: existingRecord._id },
              update: {
                $set: {
                  basicSalary,
                  bhxh: bhxh || existingRecord.bhxh || 0,
                  pit: pit || existingRecord.pit || 0,
                  total: newTotal,
                  finalReceivedAmount: newFinalReceivedAmount,
                },
              },
            },
          });
          generatedCount++;
        }
        continue; // Bỏ qua việc tạo mới
      }

      // Tính tổng thực nhận mặc định
      const total = basicSalary;
      const finalReceivedAmount = total - bhxh - pit;

      // Tạo record
      bulkOps.push({
        insertOne: {
          document: {
            staffId: staff._id,
            month,
            basicSalary,
            actualWorkingDaySalary: null,
            bonus: 0,
            allowance: 0,
            penalty: 0,
            deduction: 0,
            bhxh,
            pit,
            ot: 0,
            total,
            finalReceivedAmount,
            status: 'pending',
          },
        },
      });
      generatedCount++;
    }

    if (bulkOps.length > 0) {
      await SalaryRecord.bulkWrite(bulkOps);
    }

    console.log(
      `Completed salary generation for month ${month}. Processed ${generatedCount} records.`,
    );
    return generatedCount;
  }

  /**
   * Lấy danh sách lương tháng
   */
  async getSalaries(month, search = '', departmentId = '', companyId = '') {
    const query = { month };

    // Populate staff to get name, avatar, departments
    const records = await SalaryRecord.find(query)
      .populate({
        path: 'staffId',
        populate: {
          path: 'functionalGroupId',
          model: 'FunctionalGroup',
        },
      })
      .populate('paidBy', 'name email avatar')
      .sort({ 'staffId.name': 1 })
      .lean();

    if (search || departmentId || companyId) {
      const lowerSearch = search ? search.toLowerCase() : '';
      return records.filter((r) => {
        const staff = r.staffId;
        if (!staff) return false;

        let matchSearch = true;
        if (search) {
          matchSearch =
            staff.name && staff.name.toLowerCase().includes(lowerSearch);
        }

        let matchDept = true;
        if (departmentId) {
          matchDept =
            staff.functionalGroupId &&
            (staff.functionalGroupId.id === departmentId ||
              staff.functionalGroupId._id?.toString() === departmentId);
        }

        let matchCompany = true;
        if (companyId) {
          matchCompany = staff.companies && staff.companies.includes(companyId);
        }

        return matchSearch && matchDept && matchCompany;
      });
    }

    return records;
  }

  async batchUpdateSalaries(updates) {
    const ids = updates.map((u) => u._id);
    const existingRecords = await SalaryRecord.find({ _id: { $in: ids } });
    const existingMap = new Map(
      existingRecords.map((r) => [r._id.toString(), r]),
    );

    const changesList = [];
    const bulkOps = [];

    for (const update of updates) {
      const record = existingMap.get(update._id.toString());
      if (!record) continue;

      const oldState = record.toObject();

      const basicSalary =
        update.basicSalary !== undefined
          ? update.basicSalary
          : record.basicSalary || 0;
      const allowance =
        update.allowance !== undefined
          ? update.allowance
          : record.allowance || 0;
      const bonus =
        update.bonus !== undefined ? update.bonus : record.bonus || 0;
      const ot = update.ot !== undefined ? update.ot : record.ot || 0;
      const penalty =
        update.penalty !== undefined ? update.penalty : record.penalty || 0;
      const deduction =
        update.deduction !== undefined
          ? update.deduction
          : record.deduction || 0;
      const bhxh = update.bhxh !== undefined ? update.bhxh : record.bhxh || 0;
      const pit = update.pit !== undefined ? update.pit : record.pit || 0;

      const actualWorkingDaySalary =
        update.actualWorkingDaySalary !== undefined
          ? update.actualWorkingDaySalary
          : record.actualWorkingDaySalary;

      const hasActualWDS =
        actualWorkingDaySalary !== undefined && actualWorkingDaySalary !== null;
      const baseForTotal = hasActualWDS ? actualWorkingDaySalary : basicSalary;

      const total = baseForTotal + allowance + bonus + ot;
      const finalReceivedAmount = total - penalty - deduction - bhxh - pit;

      record.basicSalary = basicSalary;
      record.actualWorkingDaySalary = actualWorkingDaySalary;
      record.allowance = allowance;
      record.bonus = bonus;
      record.ot = ot;
      record.penalty = penalty;
      record.deduction = deduction;
      record.bhxh = bhxh;
      record.pit = pit;
      record.total = total;
      record.finalReceivedAmount = finalReceivedAmount;

      const newState = record.toObject();
      const changes = computeChanges(oldState, newState);
      if (Object.keys(changes).length > 0) {
        changesList.push({
          recordId: record._id.toString(),
          month: record.month,
          changes,
        });
      }

      bulkOps.push({
        updateOne: {
          filter: { _id: record._id },
          update: {
            $set: {
              basicSalary,
              actualWorkingDaySalary,
              allowance,
              bonus,
              ot,
              penalty,
              deduction,
              bhxh,
              pit,
              total,
              finalReceivedAmount,
            },
          },
        },
      });
    }

    if (bulkOps.length > 0) {
      await SalaryRecord.bulkWrite(bulkOps);
    }

    return changesList;
  }

  /**
   * Thanh toán lương
   */
  async paySalary(id, paymentMethod, userId) {
    const record = await SalaryRecord.findById(id);
    if (!record) {
      throw new Error('Salary record not found');
    }

    if (record.status === 'paid') {
      throw new Error('Salary already paid');
    }

    record.status = 'paid';
    record.paymentMethod = paymentMethod;
    record.paidAt = new Date();
    record.paidBy = userId;

    await record.save();
    return record;
  }

  /**
   * Lấy lịch sử nhận lương của 1 nhân sự
   */
  async getStaffSalaryHistory(staffId) {
    return await SalaryRecord.find({ staffId, status: 'paid' })
      .sort({ month: -1 })
      .populate('paidBy', 'name email avatar')
      .lean();
  }
}

module.exports = new SalaryService();
