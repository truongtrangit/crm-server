const SalaryRecord = require('../models/SalaryRecord');
const Staff = require('../models/Staff');

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
    const endOfMonth = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 0);

    // Lấy tất cả staff
    const staffs = await Staff.find().lean();
    let generatedCount = 0;

    for (const staff of staffs) {
      // Bỏ qua nhân sự nghỉ việc TRƯỚC tháng sinh lương
      if (staff.status === 'Đã nghỉ việc' && staff.resignationDate) {
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

      // Kiểm tra xem đã có record cho tháng này chưa
      const existingRecord = await SalaryRecord.findOne({ staffId: staff._id, month });
      if (existingRecord) {
        continue; // Đã sinh rồi thì bỏ qua
      }

      // Lấy lương cơ bản từ cấu hình (salaryConfigs) có effectiveDate gần nhất <= endOfMonth
      let basicSalary = 0;
      if (staff.salaryConfigs && staff.salaryConfigs.length > 0) {
        // Sắp xếp giảm dần theo ngày
        const sortedConfigs = [...staff.salaryConfigs].sort((a, b) => {
          return new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime();
        });

        // Tìm cấu hình đang áp dụng
        const activeConfig = sortedConfigs.find(c => {
           if (!c.effectiveDate) return true;
           return new Date(c.effectiveDate) <= endOfMonth;
        });

        if (activeConfig) {
          basicSalary = activeConfig.basicSalary || 0;
        } else {
          // Nếu không có cấu hình nào thỏa mãn, lấy cấu hình cũ nhất
          basicSalary = sortedConfigs[sortedConfigs.length - 1].basicSalary || 0;
        }
      }

      // Tính tổng thực nhận mặc định
      const total = basicSalary;

      // Tạo record
      await SalaryRecord.create({
        staffId: staff._id,
        month,
        basicSalary,
        bonus: 0,
        allowance: 0,
        penalty: 0,
        deduction: 0,
        ot: 0,
        total,
        finalReceivedAmount: total,
        status: 'pending',
      });

      generatedCount++;
    }

    console.log(`Completed salary generation for month ${month}. Created ${generatedCount} records.`);
    return generatedCount;
  }

  /**
   * Lấy danh sách lương tháng
   */
  async getSalaries(month, search = '') {
    const query = { month };
    
    // Populate staff to get name, avatar, departments
    const records = await SalaryRecord.find(query)
      .populate({
        path: 'staffId',
        populate: {
          path: 'functionalGroupId',
          model: 'FunctionalGroup'
        }
      })
      .populate('paidBy', 'name email avatar')
      .sort({ 'staffId.name': 1 })
      .lean();

    // Filter by search term on staff name
    if (search) {
      const lowerSearch = search.toLowerCase();
      return records.filter(r => 
        r.staffId && r.staffId.name && r.staffId.name.toLowerCase().includes(lowerSearch)
      );
    }

    return records;
  }

  /**
   * Cập nhật hàng loạt bảng lương
   */
  async batchUpdateSalaries(updates) {
    const bulkOps = updates.map(update => {
      // Re-calculate to ensure data integrity
      const basicSalary = update.basicSalary || 0;
      const allowance = update.allowance || 0;
      const bonus = update.bonus || 0;
      const ot = update.ot || 0;
      const penalty = update.penalty || 0;
      const deduction = update.deduction || 0;
      
      const total = basicSalary + allowance + bonus - penalty + ot;
      const finalReceivedAmount = total - deduction;

      return {
        updateOne: {
          filter: { _id: update._id },
          update: {
            $set: {
              basicSalary,
              bonus,
              allowance,
              penalty,
              deduction,
              ot,
              total,
              finalReceivedAmount,
            }
          }
        }
      };
    });

    if (bulkOps.length > 0) {
      await SalaryRecord.bulkWrite(bulkOps);
    }
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
