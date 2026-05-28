const express = require('express');
const RevenueController = require('../../controllers/RevenueController');
const { requirePermission } = require('../../middleware/auth');
const { PERMISSIONS } = require('../../constants/rbac');

const router = express.Router();

// Categories
router.get('/categories', requirePermission(PERMISSIONS.FINANCE_READ), RevenueController.getCategories);
router.post('/categories', requirePermission(PERMISSIONS.FINANCE_CREATE), RevenueController.createCategory);
router.put('/categories/:id', requirePermission(PERMISSIONS.FINANCE_UPDATE), RevenueController.updateCategory);
router.delete('/categories/:id', requirePermission(PERMISSIONS.FINANCE_DELETE), RevenueController.deleteCategory);

// Stats
router.get('/stats', requirePermission(PERMISSIONS.FINANCE_READ), RevenueController.getRevenueStats);

// Revenues
router.get('/', requirePermission(PERMISSIONS.FINANCE_READ), RevenueController.getRevenues);
router.get('/:id', requirePermission(PERMISSIONS.FINANCE_READ), RevenueController.getRevenueById);
router.post('/', requirePermission(PERMISSIONS.FINANCE_CREATE), RevenueController.createRevenue);
router.put('/:id', requirePermission(PERMISSIONS.FINANCE_UPDATE), RevenueController.updateRevenue);
router.delete('/:id', requirePermission(PERMISSIONS.FINANCE_DELETE), RevenueController.deleteRevenue);

module.exports = router;
