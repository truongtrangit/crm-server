const express = require('express');
const SalaryController = require('../../controllers/SalaryController');
const { requirePermission } = require('../../middleware/auth');
const { PERMISSIONS } = require('../../constants/rbac');

const router = express.Router();

router.get('/', requirePermission(PERMISSIONS.SALARIES_READ), SalaryController.getSalaries);
router.post('/generate', requirePermission(PERMISSIONS.SALARIES_CREATE), SalaryController.generateSalary);
router.put('/batch-update', requirePermission(PERMISSIONS.SALARIES_UPDATE), SalaryController.batchUpdate);
router.post('/:id/pay', requirePermission(PERMISSIONS.SALARIES_UPDATE), SalaryController.paySalary);
router.get('/staff/:staffId', requirePermission(PERMISSIONS.SALARIES_READ), SalaryController.getStaffHistory);

module.exports = router;
