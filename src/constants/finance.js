/**
 * Finance & HR Constants
 */

const STAFF_STATUS = {
  ACTIVE: 'Đang làm việc',
  INACTIVE: 'Đã nghỉ việc'
};

const SALARY_FORMATS = {
  GROSS: 'Gross',
  NET: 'Net',
  CUSTOM: 'Deal riêng'
};

const REVENUE_STATUSES = {
  COMPLETE: 'completed',
  PENDING: 'pending',
  CANCELLED: 'cancelled'
};

const EXPENSE_STATUSES = {
  APPROVED: 'approved',
  PENDING: 'pending',
  CANCELLED: 'cancelled'
};

module.exports = {
  STAFF_STATUS,
  SALARY_FORMATS,
  REVENUE_STATUSES,
  EXPENSE_STATUSES
};
