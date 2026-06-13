const express = require('express');
const ExpenseController = require('../../modules/finance/expense/expense.controller');
const { requirePermission } = require('../../core/middleware/auth');
const { PERMISSIONS } = require('../../core/constants/rbac');

const router = express.Router();

// Categories
router.get('/categories', requirePermission(PERMISSIONS.EXPENSES_CONFIG), ExpenseController.getCategories);
router.post('/categories', requirePermission(PERMISSIONS.EXPENSES_CONFIG), ExpenseController.createCategory);
router.put('/categories/:id', requirePermission(PERMISSIONS.EXPENSES_CONFIG), ExpenseController.updateCategory);
router.delete('/categories/:id', requirePermission(PERMISSIONS.EXPENSES_CONFIG), ExpenseController.deleteCategory);

// Expected Expenses
router.get('/expected', requirePermission(PERMISSIONS.EXPENSES_CONFIG), ExpenseController.getExpectedExpenses);
router.post('/expected', requirePermission(PERMISSIONS.EXPENSES_CONFIG), ExpenseController.createExpectedExpense);
router.put('/expected/:id', requirePermission(PERMISSIONS.EXPENSES_CONFIG), ExpenseController.updateExpectedExpense);
router.delete('/expected/:id', requirePermission(PERMISSIONS.EXPENSES_CONFIG), ExpenseController.deleteExpectedExpense);

// Stats
router.get('/stats', requirePermission(PERMISSIONS.EXPENSES_READ), ExpenseController.getExpenseStats);

// Expenses
router.get('/', requirePermission(PERMISSIONS.EXPENSES_READ), ExpenseController.getExpenses);
router.get('/:id', requirePermission(PERMISSIONS.EXPENSES_READ), ExpenseController.getExpenseById);
router.post('/', requirePermission(PERMISSIONS.EXPENSES_CREATE), ExpenseController.createExpense);
router.put('/:id', requirePermission(PERMISSIONS.EXPENSES_UPDATE), ExpenseController.updateExpense);
router.delete('/:id', requirePermission(PERMISSIONS.EXPENSES_DELETE), ExpenseController.deleteExpense);

module.exports = router;
