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
  SHORT: 600,   // 10 phút
  MEDIUM: 1800, // 30 phút
  LONG: 3600,   // 60 phút
};

module.exports = { CACHE_TTL };
