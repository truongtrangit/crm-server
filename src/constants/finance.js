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
  COMPLETE: 'Hoàn thành',
  PENDING: 'Chờ xử lý',
  CANCELLED: 'Đã hủy'
};

const EXPENSE_STATUSES = {
  APPROVED: 'Đã duyệt chi',
  PENDING: 'Chờ duyệt',
  CANCELLED: 'Đã hủy'
};

module.exports = {
  STAFF_STATUS,
  SALARY_FORMATS,
  REVENUE_STATUSES,
  EXPENSE_STATUSES
};
