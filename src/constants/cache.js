/**
 * THỜI GIAN SỐNG CỦA CACHE (TTL - Time To Live) TÍNH BẰNG GIÂY
 * 
 * Sử dụng hằng số giúp quản lý tập trung và phân bổ bộ nhớ Redis hợp lý:
 * - SHORT: Dành cho dữ liệu nghiệp vụ (Users, Customers). Dữ liệu này thường xuyên thay đổi, 
 *          tạo ra nhiều version rác. Cần TTL ngắn để Redis tự động giải phóng RAM sớm.
 * - LONG: Dành cho cấu hình hệ thống (Funnels, Configs, Functions). Cực kỳ hiếm khi thay đổi,
 *         Nên đặt TTL dài để tăng tỷ lệ Cache Hit tối đa, tiết kiệm CPU và DB I/O.
 */
const CACHE_TTL = {
  SHORT: 1800,   // 30 phút
  MEDIUM: 14400, // 4 giờ
  LONG: 86400,   // 24 giờ
};

module.exports = { CACHE_TTL };
