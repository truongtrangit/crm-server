/**
 * Hằng số cho module Integration Config.
 *
 * Chú ý: `source` và `eventType` là free-form strings — KHÔNG dùng enum constraint.
 * Constants ở đây chỉ định nghĩa ACTION TYPES (loại hành động khi trigger).
 */

const INTEGRATION_ACTION_TYPES = Object.freeze({
  CREATE_EVENT: 'create_event',
  CREATE_LEAD: 'create_lead',
});

const INTEGRATION_CONFIG_STATUSES = Object.freeze({
  ACTIVE: 'active',
  INACTIVE: 'inactive',
});

// Tải cấu hình danh sách event hệ thống từ biến môi trường (nếu có), fallback về mặc định
let parsedSystemEvents = {
  smaxai: [
    { value: 'user_moi', label: 'Smax - User mới', variables: ['name', 'email', 'phone'] },
    { value: 'biz_moi', label: 'Smax - Biz mới', variables: ['name', 'email', 'phone', 'bizName'] },
    { value: 'can_nang_cap', label: 'Smax - Cần nâng cấp', variables: ['name', 'email', 'phone', 'bizName', 'packageName'] },
    { value: 'sap_het_han', label: 'Smax - Sắp hết hạn', variables: ['name', 'email', 'phone', 'bizName', 'expiredAt'] },
    { value: 'user_login', label: 'Smax - User đăng nhập', variables: ['name', 'email', 'phone'] },
    { value: 'order_create', label: 'Smax - Đơn hàng mới', variables: ['name', 'email', 'phone', 'amount', 'packageName'] },
    { value: 'order_active', label: 'Smax - Kích hoạt đơn hàng', variables: ['name', 'email', 'phone', 'amount', 'packageName'] },
  ],
  botvn: [
    { value: 'botvn_yeu_thich', label: 'BotVN - Yêu thích khoá học', variables: ['name', 'email', 'phone', 'courseName'] },
    { value: 'botvn_dang_ky', label: 'BotVN - Đăng ký BotVN', variables: ['name', 'email', 'phone'] },
    { value: 'botvn_mua_khoa_hoc', label: 'BotVN - Mua khoá học', variables: ['name', 'email', 'phone', 'amount', 'courseName'] },
    { value: 'botvn_chuyen_khoan', label: 'BotVN - Chuyển khoản', variables: ['name', 'email', 'phone', 'amount', 'source'] },
  ],
};

try {
  if (process.env.SYSTEM_INTEGRATION_EVENTS) {
    parsedSystemEvents = JSON.parse(process.env.SYSTEM_INTEGRATION_EVENTS);
  }
} catch (error) {
  console.error(
    'Lỗi parse SYSTEM_INTEGRATION_EVENTS từ env. Dùng cấu hình mặc định:',
    error.message,
  );
}

const SYSTEM_INTEGRATION_EVENTS = Object.freeze(parsedSystemEvents);

const SYSTEM_SOURCES = {};
const SYSTEM_EVENT_TYPES = {};

Object.keys(parsedSystemEvents).forEach((source) => {
  SYSTEM_SOURCES[source.toUpperCase()] = source;
  parsedSystemEvents[source].forEach((evt) => {
    SYSTEM_EVENT_TYPES[evt.value.toUpperCase()] = evt.value;
  });
});

Object.freeze(SYSTEM_SOURCES);
Object.freeze(SYSTEM_EVENT_TYPES);

module.exports = {
  INTEGRATION_ACTION_TYPES,
  INTEGRATION_CONFIG_STATUSES,
  SYSTEM_INTEGRATION_EVENTS,
  SYSTEM_SOURCES,
  SYSTEM_EVENT_TYPES,
};
