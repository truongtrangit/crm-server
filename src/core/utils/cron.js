const JobRecurringTaskService = require('../../modules/job/jobWork/jobRecurringTask.service');
const logger = require('./logger');

function startCronJobs() {
  logger.info("[Cron] Starting cron jobs...");
  
  // Run once immediately on server startup to catch up on missed days
  JobRecurringTaskService.runDailyCron().catch(err => {
    logger.error("[Cron] Failed to run initial JobRecurringTaskService daily cron", { error: err.message });
  });

  // Then run every 24 hours
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  setInterval(() => {
    JobRecurringTaskService.runDailyCron().catch(err => {
      logger.error("[Cron] Failed to run JobRecurringTaskService daily cron", { error: err.message });
    });
  }, ONE_DAY_MS);
}

module.exports = { startCronJobs };
