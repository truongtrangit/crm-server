const Revenue = require("../revenue/revenue.model");
const Expense = require("../expense/expense.model");
const SalaryRecord = require("../salary/salaryRecord.model");
const Staff = require("../../hr/staff/staff.model");
const RevenueCategory = require("../revenue/revenueCategory.model");
const ExpenseCategory = require("../expense/expenseCategory.model");
const {
  REVENUE_STATUSES,
  EXPENSE_STATUSES,
} = require("../../../core/constants/finance");

class FinanceService {
  async getDashboard(year, departmentId, companyId) {
    // Determine date range for the requested year
    const startDate = new Date(`${year}-01-01T00:00:00Z`);
    const endDate = new Date(`${parseInt(year) + 1}-01-01T00:00:00Z`);

    // Fetch all categories first
    const revenueCats = await RevenueCategory.find().lean();
    const expenseCats = await ExpenseCategory.find().lean();

    // Map category ID to { id, name }
    const revCatMap = {};
    revenueCats.forEach(
      (c) => (revCatMap[c._id.toString()] = { id: c.id, name: c.name }),
    );

    const expCatMap = {};
    expenseCats.forEach(
      (c) => (expCatMap[c._id.toString()] = { id: c.id, name: c.name }),
    );

    // Initialize yearlyData
    const yearlyData = {};
    const categories = []; // { id: string, name: string, isIncome: boolean }

    // Helper to register category
    const ensureCategory = (id, name, isIncome) => {
      if (!categories.find((c) => c.name === name)) {
        categories.push({ id, name, isIncome });
        yearlyData[name] = new Array(12).fill(0);
      }
    };

    // Initialize the fixed "Lương nhân sự" category
    ensureCategory("salary", "Lương nhân sự", false);

    // Fetch Revenues
    const revFilter = {
      recordDate: { $gte: startDate, $lt: endDate },
      status: { $ne: REVENUE_STATUSES.CANCELLED },
    };
    if (companyId) {
      revFilter["companyProportions.company"] = companyId;
    }

    const revenues = await Revenue.find(revFilter).lean();

    revenues.forEach((rev) => {
      let amount = rev.amount || 0;
      if (companyId && rev.companyProportions && rev.companyProportions.length > 0) {
        const prop = rev.companyProportions.find(c => c.company === companyId);
        if (prop) amount = amount * (prop.percentage / 100);
        else amount = 0;
      } else if (companyId && (!rev.companyProportions || rev.companyProportions.length === 0)) {
        amount = 0;
      }

      if (amount > 0) {
        let catId = "empty";
        let catName = "Doanh thu khác";
        if (rev.category && revCatMap[rev.category.toString()]) {
          catId = revCatMap[rev.category.toString()].id;
          catName = revCatMap[rev.category.toString()].name;
        }
        ensureCategory(catId, catName, true);
        const month = new Date(rev.recordDate).getMonth();
        yearlyData[catName][month] += amount;
      }
    });

    // Fetch Expenses
    const expFilter = {
      recordDate: { $gte: startDate, $lt: endDate },
      status: { $ne: EXPENSE_STATUSES.CANCELLED },
    };
    if (companyId) {
      expFilter["companyProportions.company"] = companyId;
    }

    const expenses = await Expense.find(expFilter).lean();

    expenses.forEach((exp) => {
      let amount = exp.amount || 0;
      if (companyId && exp.companyProportions && exp.companyProportions.length > 0) {
        const prop = exp.companyProportions.find(c => c.company === companyId);
        if (prop) amount = amount * (prop.percentage / 100);
        else amount = 0;
      } else if (companyId && (!exp.companyProportions || exp.companyProportions.length === 0)) {
        amount = 0;
      }

      if (amount > 0) {
        let catId = "empty";
        let catName = "Chi phí khác";
        if (exp.category && expCatMap[exp.category.toString()]) {
          catId = expCatMap[exp.category.toString()].id;
          catName = expCatMap[exp.category.toString()].name;
        }
        ensureCategory(catId, catName, false);
        const month = new Date(exp.recordDate).getMonth();
        yearlyData[catName][month] += amount;
      }
    });

    // Fetch Salaries by matching month string ending with the year (e.g. "05/2026")
    const salaryQuery = { month: { $regex: year + "$" } };

    if (departmentId || companyId) {
      const staffFilter = {};
      if (departmentId) staffFilter.functionalGroupId = departmentId;
      if (companyId) staffFilter.companies = companyId;

      const matchedStaffs = await Staff.find(staffFilter).select("_id").lean();
      salaryQuery.staffId = { $in: matchedStaffs.map((s) => s._id) };
    }

    const salaries = await SalaryRecord.find(salaryQuery).lean();

    salaries.forEach((sal) => {
      // month is "MM/YYYY", so split by "/"
      const parts = sal.month.split("/");
      if (parts.length === 2) {
        const m = parseInt(parts[0], 10) - 1; // 0-indexed month
        yearlyData["Lương nhân sự"][m] += sal.total || 0; // "total" represents Gross / Thực nhận
      }
    });

    return {
      categories,
      yearlyData,
    };
  }
}

module.exports = new FinanceService();
