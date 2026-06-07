/**
 * Cấu hình hằng số cho module Job Hub
 */

const JOB_STATUS_TYPES = ['new', 'processing', 'processed', 'failed', 'success'];

const JOB_ACTION_TYPES = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  REORDER: 'reorder',
};

module.exports = {
  JOB_STATUS_TYPES,
  JOB_ACTION_TYPES,
};
