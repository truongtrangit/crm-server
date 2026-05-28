const Revenue = require("../models/Revenue");
const Expense = require("../models/Expense");
const SalaryRecord = require("../models/SalaryRecord");
const RevenueCategory = require("../models/RevenueCategory");
const ExpenseCategory = require("../models/ExpenseCategory");

class FinanceService {
  async getDashboard(year) {
    // Determine date range for the requested year
    const startDate = new Date(parseInt(year), 0, 1);
    const endDate = new Date(parseInt(year) + 1, 0, 1);

    // Fetch all categories first
    const revenueCats = await RevenueCategory.find().lean();
    const expenseCats = await ExpenseCategory.find().lean();

    // Map category ID to { id, name }
    const revCatMap = {};
    revenueCats.forEach(c => revCatMap[c._id.toString()] = { id: c.id, name: c.name });

    const expCatMap = {};
    expenseCats.forEach(c => expCatMap[c._id.toString()] = { id: c.id, name: c.name });

    // Initialize yearlyData
    const yearlyData = {};
    const categories = []; // { id: string, name: string, isIncome: boolean }

    // Helper to register category
    const ensureCategory = (id, name, isIncome) => {
      if (!categories.find(c => c.name === name)) {
        categories.push({ id, name, isIncome });
        yearlyData[name] = new Array(12).fill(0);
      }
    };

    // Initialize the fixed "Lương nhân sự" category
    ensureCategory("salary", "Lương nhân sự", false);

    // Fetch Revenues
    const revenues = await Revenue.find({
      recordDate: { $gte: startDate, $lt: endDate },
      status: { $ne: "Đã hủy" }
    }).lean();

    revenues.forEach(rev => {
      let catId = "empty";
      let catName = "Doanh thu khác";
      if (rev.category && revCatMap[rev.category.toString()]) {
        catId = revCatMap[rev.category.toString()].id;
        catName = revCatMap[rev.category.toString()].name;
      }
      ensureCategory(catId, catName, true);
      const month = new Date(rev.recordDate).getMonth();
      yearlyData[catName][month] += (rev.amount || 0);
    });

    // Fetch Expenses
    const expenses = await Expense.find({
      recordDate: { $gte: startDate, $lt: endDate },
      status: { $ne: "Đã hủy" }
    }).lean();

    expenses.forEach(exp => {
      let catId = "empty";
      let catName = "Chi phí khác";
      if (exp.category && expCatMap[exp.category.toString()]) {
        catId = expCatMap[exp.category.toString()].id;
        catName = expCatMap[exp.category.toString()].name;
      }
      ensureCategory(catId, catName, false);
      const month = new Date(exp.recordDate).getMonth();
      yearlyData[catName][month] += (exp.amount || 0);
    });

    // Fetch Salaries by matching month string ending with the year (e.g. "05/2026")
    const salaries = await SalaryRecord.find({
      month: { $regex: year + "$" }
    }).lean();

    salaries.forEach(sal => {
      // month is "MM/YYYY", so split by "/"
      const parts = sal.month.split("/");
      if (parts.length === 2) {
        const m = parseInt(parts[0], 10) - 1; // 0-indexed month
        yearlyData["Lương nhân sự"][m] += (sal.total || 0); // "total" represents Gross / Thực nhận
      }
    });

    return {
      categories,
      yearlyData
    };
  }
}

module.exports = new FinanceService();
