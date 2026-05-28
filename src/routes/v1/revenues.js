const express = require('express');
const RevenueController = require('../../controllers/RevenueController');
const { requirePermission } = require('../../middleware/auth');
const { PERMISSIONS } = require('../../constants/rbac');

const router = express.Router();

// Categories
router.get('/categories', requirePermission(PERMISSIONS.REVENUES_READ), RevenueController.getCategories);
router.post('/categories', requirePermission(PERMISSIONS.REVENUES_CREATE), RevenueController.createCategory);
router.put('/categories/:id', requirePermission(PERMISSIONS.REVENUES_UPDATE), RevenueController.updateCategory);
router.delete('/categories/:id', requirePermission(PERMISSIONS.REVENUES_DELETE), RevenueController.deleteCategory);

// Stats
router.get('/stats', requirePermission(PERMISSIONS.REVENUES_READ), RevenueController.getRevenueStats);

// Revenues
router.get('/', requirePermission(PERMISSIONS.REVENUES_READ), RevenueController.getRevenues);
router.get('/:id', requirePermission(PERMISSIONS.REVENUES_READ), RevenueController.getRevenueById);
router.post('/', requirePermission(PERMISSIONS.REVENUES_CREATE), RevenueController.createRevenue);
router.put('/:id', requirePermission(PERMISSIONS.REVENUES_UPDATE), RevenueController.updateRevenue);
router.delete('/:id', requirePermission(PERMISSIONS.REVENUES_DELETE), RevenueController.deleteRevenue);

module.exports = router;
