const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

dayjs.extend(utc);
dayjs.extend(timezone);

const VIETNAM_TZ = 'Asia/Ho_Chi_Minh';

/**
 * Returns a dayjs instance in Vietnam Timezone.
 * @param {Date|string|number} [date] - Optional date to parse
 */
function getVietnamTime(date) {
  return dayjs(date).tz(VIETNAM_TZ);
}

/**
 * Returns a native Date object representing the start of the day in Vietnam (00:00:00).
 * If no date is passed, it uses today.
 * @param {Date|string|number} [date]
 * @returns {Date}
 */
function getStartOfDayVN(date) {
  return dayjs(date).tz(VIETNAM_TZ).startOf('day').toDate();
}

/**
 * Returns a native Date object representing the end of the day in Vietnam (23:59:59.999).
 * If no date is passed, it uses today.
 * @param {Date|string|number} [date]
 * @returns {Date}
 */
function getEndOfDayVN(date) {
  return dayjs(date).tz(VIETNAM_TZ).endOf('day').toDate();
}

/**
 * Adds a specific number of hours to a date, calculated in Vietnam Timezone.
 * @param {Date|string|number} date
 * @param {number} hours
 * @returns {Date}
 */
function addHoursVN(date, hours) {
  return dayjs(date).tz(VIETNAM_TZ).add(hours, 'hour').toDate();
}

module.exports = {
  dayjs,
  VIETNAM_TZ,
  getVietnamTime,
  getStartOfDayVN,
  getEndOfDayVN,
  addHoursVN
};
