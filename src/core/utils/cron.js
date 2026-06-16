const cron = require("node-cron");
const JobRecurringTaskService = require("../../modules/job/jobWork/jobRecurringTask.service");
const CourseVoucherService = require("../../modules/course/courseConfig/courseVoucher.service");
const logger = require("./logger");

function startCronJobs() {
  logger.info("[Cron] Starting cron jobs with node-cron...");

  // Run once immediately on server startup to catch up on missed days
  JobRecurringTaskService.runDailyCron().catch((err) => {
    logger.error(
      "[Cron] Failed to run initial JobRecurringTaskService daily cron",
      { error: err.message },
    );
  });
  CourseVoucherService.autoUpdateExpiredVouchers();

  // Run daily at midnight (00:00)
  cron.schedule("0 0 * * *", () => {
    JobRecurringTaskService.runDailyCron().catch((err) => {
      logger.error("[Cron] Failed to run JobRecurringTaskService daily cron", {
        error: err.message,
      });
    });
  });

  // Auto-expire vouchers every 15 minutes
  cron.schedule("*/15 * * * *", () => {
    CourseVoucherService.autoUpdateExpiredVouchers();
  });
}

module.exports = { startCronJobs };
