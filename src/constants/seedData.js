/**
 * seedData.js — Bộ dữ liệu mẫu CRM (phiên bản đầy đủ, đa dạng)
 *
 * Bao gồm:
 *   organizations · users · customers · events (đủ 5 nhóm, đa dạng trạng thái)
 *   actions · results · reasons · actionChains (đa dạng logic nhánh)
 *
 * Trạng thái Event được phủ đầy đủ:
 *   - Có assignee / chưa có assignee (unassigned)
 *   - Đã đồng bộ nhân viên / chưa đồng bộ (syncStatus)
 *   - Nhiều loại nhóm (user_moi, biz_moi, can_nang_cap, sap_het_han, chuyen_khoan)
 *   - Nhiều loại stage, tags, plan, service
 */

// ─── Organizations ───────────────────────────────────────────────────────────
const organizations = [
  {
    id: "1",
    parent: "Phòng Marketing",
    children: [
      { name: "Nhóm Facebook Ads",  desc: "Chạy quảng cáo đa nền tảng" },
      { name: "Nhóm Content",       desc: "Sản xuất nội dung media, bài viết" },
      { name: "Nhóm Google Ads",    desc: "SEO & quảng cáo Google" },
    ],
  },
  {
    id: "2",
    parent: "Phòng Sale",
    children: [
      { name: "Nhóm Sale Hà Nội", desc: "Telesale & chốt đơn khu vực miền Bắc" },
      { name: "Nhóm Sale HCM",    desc: "Telesale & chốt đơn khu vực miền Nam" },
      { name: "Nhóm Sale Đà Nẵng", desc: "Telesale miền Trung" },
    ],
  },
  {
    id: "3",
    parent: "Phòng Kỹ Thuật",
    children: [
      { name: "Nhóm Backend",   desc: "Phát triển API và xử lý dữ liệu" },
      { name: "Nhóm Frontend",  desc: "Phát triển giao diện người dùng" },
      { name: "Nhóm DevOps",    desc: "Hạ tầng và triển khai hệ thống" },
    ],
  },
  {
    id: "4",
    parent: "Phòng CSKH",
    children: [
      { name: "Nhóm Support L1", desc: "Hỗ trợ khách hàng mức 1 (chat, email)" },
      { name: "Nhóm Support L2", desc: "Xử lý sự cố phức tạp" },
    ],
  },
];

// ─── Users ────────────────────────────────────────────────────────────────────
const users = [
  {
    id: "USER001",
    name: "Chủ hệ thống CRM",
    email: "owner@crm.vn",
    password: "Owner@123",
    avatar: "https://i.pravatar.cc/100?img=33",
    department: [],
    group: [],
    phone: "0901 000 001",
    role: "OWNER",
  },
  {
    id: "USER002",
    name: "Quản trị CRM",
    email: "admin@crm.vn",
    password: "Admin@123",
    avatar: "https://i.pravatar.cc/100?img=47",
    department: ["Phòng Kỹ Thuật"],
    group: ["Nhóm Backend"],
    phone: "0901 000 002",
    role: "ADMIN",
  },
  {
    id: "USER003",
    name: "Phạm Thanh Sơn",
    email: "manager.sale@crm.vn",
    password: "Manager@123",
    avatar: "https://i.pravatar.cc/100?img=12",
    department: ["Phòng Sale"],
    group: ["Nhóm Sale Hà Nội"],
    phone: "0901 000 003",
    role: "MANAGER",
  },
  {
    id: "USER006",
    name: "Nguyễn Thị Mai",
    email: "manager.cskh@crm.vn",
    password: "Manager@123",
    avatar: "https://i.pravatar.cc/100?img=44",
    department: ["Phòng CSKH"],
    group: ["Nhóm Support L1"],
    phone: "0901 000 006",
    role: "MANAGER",
  },
  {
    id: "USER004",
    name: "Vũ Thu Phương",
    email: "staff1@crm.vn",
    password: "Staff@123",
    avatar: "https://i.pravatar.cc/100?img=25",
    department: ["Phòng Sale"],
    group: ["Nhóm Sale Hà Nội"],
    phone: "0901 000 004",
    role: "STAFF",
    managerId: "USER003",
  },
  {
    id: "USER005",
    name: "Lê Văn Hùng",
    email: "staff2@crm.vn",
    password: "Staff@123",
    avatar: "https://i.pravatar.cc/100?img=30",
    department: ["Phòng Sale"],
    group: ["Nhóm Sale HCM"],
    phone: "0901 000 005",
    role: "STAFF",
    managerId: "USER003",
  },
  {
    id: "USER007",
    name: "Trần Đức Anh",
    email: "staff3@crm.vn",
    password: "Staff@123",
    avatar: "https://i.pravatar.cc/100?img=60",
    department: ["Phòng Sale"],
    group: ["Nhóm Sale Đà Nẵng"],
    phone: "0901 000 007",
    role: "STAFF",
    managerId: "USER003",
  },
  {
    id: "USER008",
    name: "Hoàng Diệu Linh",
    email: "staff4@crm.vn",
    password: "Staff@123",
    avatar: "https://i.pravatar.cc/100?img=49",
    department: ["Phòng CSKH"],
    group: ["Nhóm Support L1"],
    phone: "0901 000 008",
    role: "STAFF",
    managerId: "USER006",
  },
];

// ─── Customers ───────────────────────────────────────────────────────────────
const customers = [
  {
    id: "CUST001",
    name: "Phạm Tường Vy",
    avatar: "https://i.pravatar.cc/100?img=15",
    type: "VIP Customer",
    email: "vy.pham@example.com",
    phone: "0912 345 678",
    biz: ["Torano", "Biluxury"],
    platforms: ["SmaxAi", "Botvn"],
    group: "Nhóm Sale Hà Nội",
    registeredAt: "10/10/2022",
    lastLoginAt: "30/03/2026",
    tags: ["#KHTiemNang", "#VIP"],
  },
  {
    id: "CUST002",
    name: "Minh Khôi",
    avatar: "https://i.pravatar.cc/100?img=62",
    type: "Premium",
    email: "khoi.minh@example.com",
    phone: "0999 777 888",
    biz: ["KhoiCorp"],
    platforms: ["SmaxAi"],
    group: "Nhóm Sale HCM",
    registeredAt: "20/01/2024",
    lastLoginAt: "17/04/2026",
    tags: ["#Enterprise"],
  },
  {
    id: "CUST003",
    name: "Hoàng Sơn",
    avatar: "https://i.pravatar.cc/100?img=7",
    type: "Trial",
    email: "son.hoang@example.com",
    phone: "0966 444 555",
    biz: ["HoangSonCo"],
    platforms: ["Botvn"],
    group: "Nhóm Sale HCM",
    registeredAt: "14/04/2026",
    lastLoginAt: "17/04/2026",
    tags: ["#Trial"],
  },
  {
    id: "CUST004",
    name: "Nguyễn Thị Lan",
    avatar: "https://i.pravatar.cc/100?img=5",
    type: "Regular",
    email: "lan.nguyen@example.com",
    phone: "0933 222 111",
    biz: ["LanStore"],
    platforms: ["Appvn"],
    group: "Nhóm Sale Hà Nội",
    registeredAt: "05/03/2025",
    lastLoginAt: "15/04/2026",
    tags: ["#NewUser"],
  },
  {
    id: "CUST005",
    name: "Bảo Quốc",
    avatar: "https://i.pravatar.cc/100?img=33",
    type: "Regular",
    email: "quoc.bao@example.com",
    phone: "0988 666 777",
    biz: ["QuocBiz"],
    platforms: ["SmaxAi"],
    group: "Nhóm Sale HCM",
    registeredAt: "01/01/2026",
    lastLoginAt: "16/04/2026",
    tags: ["#Follow"],
  },
  {
    id: "CUST006",
    name: "Trần Thị Hoa",
    avatar: "https://i.pravatar.cc/100?img=20",
    type: "Trial",
    email: "hoa.tran@example.com",
    phone: "0977 333 444",
    biz: ["HoaDesign"],
    platforms: ["Appvn"],
    group: "Nhóm Sale Đà Nẵng",
    registeredAt: "10/04/2026",
    lastLoginAt: "18/04/2026",
    tags: ["#Trial", "#NewUser"],
  },
  {
    id: "CUST007",
    name: "Đặng Quang Huy",
    avatar: "https://i.pravatar.cc/100?img=52",
    type: "Enterprise",
    email: "huy.dang@example.com",
    phone: "0911 222 555",
    biz: ["HuyGroup", "TechViet"],
    platforms: ["SmaxAi", "Botvn", "Appvn"],
    group: "Nhóm Sale Hà Nội",
    registeredAt: "15/06/2023",
    lastLoginAt: "18/04/2026",
    tags: ["#Enterprise", "#VIP"],
  },
  {
    id: "CUST008",
    name: "Lý Thị Thu",
    avatar: "https://i.pravatar.cc/100?img=18",
    type: "Premium",
    email: "thu.ly@example.com",
    phone: "0944 888 333",
    biz: ["ThuFashion"],
    platforms: ["Botvn"],
    group: "Nhóm Sale HCM",
    registeredAt: "22/02/2025",
    lastLoginAt: "17/04/2026",
    tags: ["#Premium"],
  },
];

// ─── Leads (legacy, giữ lại để không phá seedDatabase) ──────────────────────
const leads = [];

// ─── Tasks (legacy) ───────────────────────────────────────────────────────────
const tasks = [];

// ─── StaffFunctions ──────────────────────────────────────────────────────────
const staffFunctions = [
  {
    id: "FUNC001",
    title: "Marketing",
    desc: "Quản lý chiến dịch quảng cáo, tạo leads đầu vào.",
    type: "marketing",
  },
  {
    id: "FUNC002",
    title: "Sale (Bán hàng)",
    desc: "Tiếp nhận Lead từ Marketing, chăm sóc và chốt đơn.",
    type: "sale",
  },
  {
    id: "FUNC003",
    title: "Kỹ Thuật",
    desc: "Xây dựng và bảo trì nền tảng CRM.",
    type: "tech",
  },
  {
    id: "FUNC004",
    title: "CSKH",
    desc: "Chăm sóc và hỗ trợ sau bán hàng.",
    type: "cskh",
  },
];

// ─── Results ─────────────────────────────────────────────────────────────────
// type: "success" | "failure" | "neutral" | "skip"
const results = [
  { id: "RES001", name: "Đã liên hệ & quan tâm",    type: "success", description: "Khách hàng bắt máy và thể hiện sự quan tâm" },
  { id: "RES002", name: "Không bắt máy",             type: "failure", description: "Gọi điện nhưng khách không nghe máy" },
  { id: "RES003", name: "Hẹn gọi lại",               type: "neutral", description: "Khách hàng nhờ gọi lại sau" },
  { id: "RES004", name: "Từ chối",                   type: "failure", description: "Khách hàng từ chối dịch vụ" },
  { id: "RES005", name: "Đã gửi email giới thiệu",   type: "success", description: "Automation đã gửi email thành công" },
  { id: "RES006", name: "Đã thanh toán",             type: "success", description: "Khách hàng xác nhận đã thanh toán" },
  { id: "RES007", name: "Chưa thanh toán",           type: "failure", description: "Khách hàng chưa thực hiện thanh toán" },
  { id: "RES008", name: "Đã gia hạn",                type: "success", description: "Khách hàng đã gia hạn gói dịch vụ" },
  { id: "RES009", name: "Hứng thú - cần demo",       type: "neutral", description: "Khách hàng quan tâm nhưng muốn xem demo trước" },
  { id: "RES010", name: "Đã gửi tài liệu",           type: "success", description: "Tài liệu/proposal đã được gửi thành công" },
  { id: "RES011", name: "Đã tạo đơn hàng",           type: "success", description: "Đơn hàng được tạo thành công trong hệ thống" },
  { id: "RES012", name: "Máy bận",                   type: "failure", description: "Gọi nhưng đường dây đang bận" },
  { id: "RES013", name: "Sai số điện thoại",         type: "failure", description: "Số điện thoại không liên lạc được" },
  { id: "RES014", name: "Đã demo thành công",        type: "success", description: "Buổi demo được khách hàng đánh giá tốt" },
  { id: "RES015", name: "Cần thêm thời gian",        type: "neutral", description: "Khách hàng muốn suy nghĩ thêm" },
  { id: "RES016", name: "Đã gửi hợp đồng",           type: "success", description: "Hợp đồng đã được gửi để ký duyệt" },
];

// ─── Reasons ─────────────────────────────────────────────────────────────────
const reasons = [
  { id: "REAS001", name: "Bận việc",             description: "Khách hàng bận, không tiếp chuyện được" },
  { id: "REAS002", name: "Không có nhu cầu",     description: "Khách không có nhu cầu sử dụng dịch vụ" },
  { id: "REAS003", name: "Giá cao",              description: "Khách hàng cho rằng giá dịch vụ quá cao" },
  { id: "REAS004", name: "Cân nhắc thêm",        description: "Khách muốn suy nghĩ thêm trước khi quyết định" },
  { id: "REAS005", name: "Dùng dịch vụ khác",    description: "Đang dùng sản phẩm/dịch vụ của đối thủ" },
  { id: "REAS006", name: "Chưa có ngân sách",    description: "Khách hàng chưa có budget để thanh toán ngay" },
  { id: "REAS007", name: "Cần thêm thông tin",   description: "Khách cần tài liệu/demo trước khi quyết định" },
  { id: "REAS008", name: "Sai số tài khoản",     description: "Thông tin thanh toán không chính xác" },
  { id: "REAS009", name: "Hết hạn thẻ",          description: "Thẻ thanh toán đã hết hạn" },
  { id: "REAS010", name: "Khó khăn kỹ thuật",    description: "Gặp vấn đề kỹ thuật khi triển khai" },
  { id: "REAS011", name: "Nhân sự chưa sẵn sàng", description: "Chưa có nhân sự vận hành hệ thống" },
  { id: "REAS012", name: "Cần duyệt nội bộ",     description: "Phải chờ cấp trên duyệt ngân sách/hợp đồng" },
];

// ─── Actions ─────────────────────────────────────────────────────────────────
// type enum: "call" | "send_block_automation" | "other" | "review" | "manual_order" | "create_booking"
// category: "primary" | "secondary"
const actions = [
  {
    id: "ACT001",
    name: "Gọi điện lần 1",
    type: "call",
    category: "primary",
    reasonIds: ["REAS001", "REAS002", "REAS003", "REAS004", "REAS005"],
    description: "Cuộc gọi chào hàng/chăm sóc đầu tiên",
  },
  {
    id: "ACT002",
    name: "Gọi điện lần 2",
    type: "call",
    category: "primary",
    reasonIds: ["REAS001", "REAS002", "REAS003", "REAS004"],
    description: "Cuộc gọi tiếp theo nếu lần 1 không thành công",
  },
  {
    id: "ACT003",
    name: "Gọi điện tư vấn nâng cấp",
    type: "call",
    category: "primary",
    reasonIds: ["REAS001", "REAS003", "REAS004", "REAS006"],
    description: "Tư vấn khách hàng nâng cấp gói dịch vụ",
  },
  {
    id: "ACT004",
    name: "Gửi email giới thiệu tự động",
    type: "send_block_automation",
    category: "primary",
    reasonIds: [],
    description: "Block automation gửi email chào mừng/giới thiệu dịch vụ",
  },
  {
    id: "ACT005",
    name: "Gửi email nhắc gia hạn",
    type: "send_block_automation",
    category: "primary",
    reasonIds: [],
    description: "Block automation gửi email nhắc gia hạn dịch vụ",
  },
  {
    id: "ACT006",
    name: "Gọi điện xác nhận thanh toán",
    type: "call",
    category: "primary",
    reasonIds: ["REAS001", "REAS002", "REAS008", "REAS009"],
    description: "Gọi xác nhận khách hàng đã thanh toán",
  },
  {
    id: "ACT007",
    name: "Review hợp đồng",
    type: "review",
    category: "secondary",
    reasonIds: [],
    description: "Xem lại hợp đồng/điều khoản với khách hàng",
  },
  {
    id: "ACT008",
    name: "Gửi tài liệu & proposal",
    type: "send_block_automation",
    category: "primary",
    reasonIds: [],
    description: "Block automation gửi tài liệu giới thiệu, bảng giá và proposal",
  },
  {
    id: "ACT009",
    name: "Tạo đơn hàng thủ công",
    type: "manual_order",
    category: "secondary",
    reasonIds: [],
    description: "Nhân viên sale tạo đơn hàng thủ công sau khi chốt deal",
  },
  {
    id: "ACT010",
    name: "Gọi điện chốt deal",
    type: "call",
    category: "primary",
    reasonIds: ["REAS003", "REAS004", "REAS006", "REAS007"],
    description: "Cuộc gọi cuối cùng để chốt hợp đồng/gói dịch vụ",
  },
  {
    id: "ACT011",
    name: "Gọi điện lần 3 (khẩn)",
    type: "call",
    category: "primary",
    reasonIds: ["REAS001", "REAS002", "REAS012"],
    description: "Cuộc gọi lần 3, ưu tiên cao khi gói sắp hết hạn",
  },
  {
    id: "ACT012",
    name: "Gửi SMS nhắc nhở",
    type: "send_block_automation",
    category: "primary",
    reasonIds: [],
    description: "Block automation gửi SMS nhắc gia hạn qua Zalo/SMS",
  },
  {
    id: "ACT013",
    name: "Gọi demo sản phẩm",
    type: "call",
    category: "primary",
    reasonIds: ["REAS007", "REAS010", "REAS011"],
    description: "Gọi để giới thiệu demo trực tiếp với khách hàng",
  },
  {
    id: "ACT014",
    name: "Tạo booking demo",
    type: "create_booking",
    category: "secondary",
    reasonIds: [],
    description: "Đặt lịch buổi demo với chuyên gia kỹ thuật",
  },
  {
    id: "ACT015",
    name: "Gửi hợp đồng điện tử",
    type: "send_block_automation",
    category: "primary",
    reasonIds: [],
    description: "Gửi hợp đồng điện tử qua email để ký duyệt",
  },
  {
    id: "ACT016",
    name: "Gọi điện hỗ trợ kỹ thuật",
    type: "call",
    category: "primary",
    reasonIds: ["REAS010", "REAS011"],
    description: "Gọi hỗ trợ khách hàng gặp vấn đề kỹ thuật",
  },
];

// ─── ActionChains ─────────────────────────────────────────────────────────────
// Đây là chuỗi hành động template (cấu hình quy tắc)
// delayUnit: "immediate" | "minute" | "hour" | "day" | "week"
// delayValue: số tương ứng (null khi immediate)
// branch.nextStepType: "next_in_chain" | "close_task" | "close_chain" | ...
// branch.closeOutcome: "success" | "failure" (chỉ khi nextStepType === "close_task")
const actionChains = [

  // ─ CHAIN001: Chăm sóc khách hàng mới ──────────────────────────────────────
  {
    id: "CHAIN001",
    name: "Chăm sóc khách hàng mới",
    description: "Chuỗi chăm sóc tự động khi có user/biz mới đăng ký: gửi email → gọi điện lần 1 → dự phòng gọi lần 2",
    delayUnit:  "immediate",
    delayValue: null,
    active: true,
    steps: [
      {
        order: 1,
        actionId: "ACT004", // Gửi email giới thiệu tự động
        branches: [
          {
            resultId:     "RES005", // Đã gửi email
            order:        1,
            nextStepType: "next_in_chain",
            nextActionId: "ACT001", // → Gọi điện lần 1
            closeOutcome: null,
            delayUnit:    "hour",
            delayValue:   2,
          },
        ],
      },
      {
        order: 2,
        actionId: "ACT001", // Gọi điện lần 1
        branches: [
          {
            resultId:     "RES001", // Đã liên hệ & quan tâm
            order:        1,
            nextStepType: "close_task",
            nextActionId: null,
            closeOutcome: "success",
            delayUnit:    null,
            delayValue:   null,
          },
          {
            resultId:     "RES002", // Không bắt máy
            order:        2,
            nextStepType: "next_in_chain",
            nextActionId: "ACT002", // → Gọi điện lần 2
            closeOutcome: null,
            delayUnit:    "day",
            delayValue:   1,
          },
          {
            resultId:     "RES012", // Máy bận
            order:        3,
            nextStepType: "next_in_chain",
            nextActionId: "ACT002",
            closeOutcome: null,
            delayUnit:    "hour",
            delayValue:   3,
          },
          {
            resultId:     "RES004", // Từ chối
            order:        4,
            nextStepType: "close_task",
            nextActionId: null,
            closeOutcome: "failure",
            delayUnit:    null,
            delayValue:   null,
          },
        ],
      },
      {
        order: 3,
        actionId: "ACT002", // Gọi điện lần 2
        branches: [
          {
            resultId:     "RES001", // Đã liên hệ & quan tâm
            order:        1,
            nextStepType: "close_task",
            nextActionId: null,
            closeOutcome: "success",
            delayUnit:    null,
            delayValue:   null,
          },
          {
            resultId:     "RES002", // Không bắt máy
            order:        2,
            nextStepType: "close_task",
            nextActionId: null,
            closeOutcome: "failure",
            delayUnit:    null,
            delayValue:   null,
          },
          {
            resultId:     "RES013", // Sai số điện thoại
            order:        3,
            nextStepType: "close_task",
            nextActionId: null,
            closeOutcome: "failure",
            delayUnit:    null,
            delayValue:   null,
          },
          {
            resultId:     "RES003", // Hẹn gọi lại
            order:        4,
            nextStepType: "close_chain",
            nextActionId: null,
            closeOutcome: null,
            delayUnit:    null,
            delayValue:   null,
          },
        ],
      },
    ],
  },

  // ─ CHAIN002: Xử lý chuyển khoản ────────────────────────────────────────────
  {
    id: "CHAIN002",
    name: "Xử lý chuyển khoản",
    description: "Xác nhận và xử lý khi nhận thanh toán chuyển khoản: gọi xác nhận → gọi lại nếu thất bại",
    delayUnit:  "immediate",
    delayValue: null,
    active: true,
    steps: [
      {
        order: 1,
        actionId: "ACT006", // Gọi điện xác nhận thanh toán
        branches: [
          {
            resultId:     "RES006", // Đã thanh toán
            order:        1,
            nextStepType: "close_task",
            nextActionId: null,
            closeOutcome: "success",
            delayUnit:    null,
            delayValue:   null,
          },
          {
            resultId:     "RES007", // Chưa thanh toán
            order:        2,
            nextStepType: "next_in_chain",
            nextActionId: "ACT006", // → Gọi lại
            closeOutcome: null,
            delayUnit:    "minute",
            delayValue:   30,
          },
          {
            resultId:     "RES002", // Không bắt máy
            order:        3,
            nextStepType: "next_in_chain",
            nextActionId: "ACT006", // → Gọi lại
            closeOutcome: null,
            delayUnit:    "hour",
            delayValue:   1,
          },
          {
            resultId:     "RES008", // Sai số tài khoản (dùng chung REAS008)
            order:        4,
            nextStepType: "close_task",
            nextActionId: null,
            closeOutcome: "failure",
            delayUnit:    null,
            delayValue:   null,
          },
        ],
      },
    ],
  },

  // ─ CHAIN003: Nhắc gia hạn gói cước ─────────────────────────────────────────
  {
    id: "CHAIN003",
    name: "Nhắc gia hạn gói cước",
    description: "Tự động nhắc gia hạn khi gói cước sắp hết hạn: gửi email → gọi tư vấn → gọi lại nếu hẹn",
    delayUnit:  "immediate",
    delayValue: null,
    active: true,
    steps: [
      {
        order: 1,
        actionId: "ACT005", // Gửi email nhắc gia hạn
        branches: [
          {
            resultId:     "RES005", // Đã gửi email
            order:        1,
            nextStepType: "next_in_chain",
            nextActionId: "ACT003", // → Gọi tư vấn nâng cấp
            closeOutcome: null,
            delayUnit:    "day",
            delayValue:   1,
          },
        ],
      },
      {
        order: 2,
        actionId: "ACT003", // Gọi điện tư vấn nâng cấp
        branches: [
          {
            resultId:     "RES008", // Đã gia hạn
            order:        1,
            nextStepType: "close_task",
            nextActionId: null,
            closeOutcome: "success",
            delayUnit:    null,
            delayValue:   null,
          },
          {
            resultId:     "RES001", // Quan tâm, hỏi thêm
            order:        2,
            nextStepType: "next_in_chain",
            nextActionId: "ACT011", // → Gọi lần 3 (khẩn)
            closeOutcome: null,
            delayUnit:    "day",
            delayValue:   1,
          },
          {
            resultId:     "RES004", // Từ chối
            order:        3,
            nextStepType: "close_task",
            nextActionId: null,
            closeOutcome: "failure",
            delayUnit:    null,
            delayValue:   null,
          },
          {
            resultId:     "RES003", // Hẹn gọi lại
            order:        4,
            nextStepType: "next_in_chain",
            nextActionId: "ACT003",
            closeOutcome: null,
            delayUnit:    "day",
            delayValue:   2,
          },
        ],
      },
      {
        order: 3,
        actionId: "ACT011", // Gọi điện lần 3 (khẩn)
        branches: [
          {
            resultId:     "RES008", // Đã gia hạn
            order:        1,
            nextStepType: "close_task",
            nextActionId: null,
            closeOutcome: "success",
            delayUnit:    null,
            delayValue:   null,
          },
          {
            resultId:     "RES002", // Không bắt máy
            order:        2,
            nextStepType: "close_task",
            nextActionId: null,
            closeOutcome: "failure",
            delayUnit:    null,
            delayValue:   null,
          },
          {
            resultId:     "RES004", // Từ chối
            order:        3,
            nextStepType: "close_task",
            nextActionId: null,
            closeOutcome: "failure",
            delayUnit:    null,
            delayValue:   null,
          },
        ],
      },
    ],
  },

  // ─ CHAIN004: Chuyển đổi Trial → Trả phí (5 bước) ──────────────────────────
  {
    id: "CHAIN004",
    name: "Chuyển đổi Trial → Trả phí",
    description: "Chuỗi 5 bước chuyển đổi khách hàng từ Trial sang trả phí: gửi tài liệu → gọi tư vấn → gọi chốt deal → tạo đơn → xác nhận",
    delayUnit:  "day",
    delayValue: 1,
    active: true,
    steps: [
      {
        order: 1,
        actionId: "ACT008", // Gửi tài liệu & proposal
        branches: [
          {
            resultId:     "RES010", // Đã gửi tài liệu
            order:        1,
            nextStepType: "next_in_chain",
            nextActionId: "ACT001", // → Gọi điện lần 1
            closeOutcome: null,
            delayUnit:    "hour",
            delayValue:   4,
          },
        ],
      },
      {
        order: 2,
        actionId: "ACT001", // Gọi điện lần 1
        branches: [
          {
            resultId:     "RES009", // Hứng thú - cần demo
            order:        1,
            nextStepType: "next_in_chain",
            nextActionId: "ACT013", // → Gọi demo
            closeOutcome: null,
            delayUnit:    "day",
            delayValue:   1,
          },
          {
            resultId:     "RES001", // Đã liên hệ & quan tâm
            order:        2,
            nextStepType: "next_in_chain",
            nextActionId: "ACT010", // → Gọi chốt deal
            closeOutcome: null,
            delayUnit:    "day",
            delayValue:   2,
          },
          {
            resultId:     "RES002", // Không bắt máy
            order:        3,
            nextStepType: "next_in_chain",
            nextActionId: "ACT002", // → Gọi điện lần 2
            closeOutcome: null,
            delayUnit:    "hour",
            delayValue:   3,
          },
          {
            resultId:     "RES004", // Từ chối
            order:        4,
            nextStepType: "close_task",
            nextActionId: null,
            closeOutcome: "failure",
            delayUnit:    null,
            delayValue:   null,
          },
        ],
      },
      {
        order: 3,
        actionId: "ACT013", // Gọi demo sản phẩm
        branches: [
          {
            resultId:     "RES014", // Đã demo thành công
            order:        1,
            nextStepType: "next_in_chain",
            nextActionId: "ACT010", // → Gọi chốt deal
            closeOutcome: null,
            delayUnit:    "day",
            delayValue:   1,
          },
          {
            resultId:     "RES015", // Cần thêm thời gian
            order:        2,
            nextStepType: "next_in_chain",
            nextActionId: "ACT010",
            closeOutcome: null,
            delayUnit:    "day",
            delayValue:   3,
          },
          {
            resultId:     "RES004", // Từ chối sau demo
            order:        3,
            nextStepType: "close_task",
            nextActionId: null,
            closeOutcome: "failure",
            delayUnit:    null,
            delayValue:   null,
          },
        ],
      },
      {
        order: 4,
        actionId: "ACT010", // Gọi chốt deal
        branches: [
          {
            resultId:     "RES006", // Đã thanh toán (chốt thành công)
            order:        1,
            nextStepType: "next_in_chain",
            nextActionId: "ACT009", // → Tạo đơn hàng thủ công
            closeOutcome: null,
            delayUnit:    "immediate",
            delayValue:   0,
          },
          {
            resultId:     "RES003", // Hẹn gọi lại
            order:        2,
            nextStepType: "next_in_chain",
            nextActionId: "ACT010", // → Gọi lại chốt deal
            closeOutcome: null,
            delayUnit:    "day",
            delayValue:   2,
          },
          {
            resultId:     "RES004", // Từ chối
            order:        3,
            nextStepType: "close_task",
            nextActionId: null,
            closeOutcome: "failure",
            delayUnit:    null,
            delayValue:   null,
          },
        ],
      },
      {
        order: 5,
        actionId: "ACT009", // Tạo đơn hàng thủ công
        branches: [
          {
            resultId:     "RES011", // Đã tạo đơn hàng
            order:        1,
            nextStepType: "close_task",
            nextActionId: null,
            closeOutcome: "success",
            delayUnit:    null,
            delayValue:   null,
          },
        ],
      },
    ],
  },

  // ─ CHAIN005: Doanh nghiệp mới (từ Biz) ─────────────────────────────────────
  {
    id: "CHAIN005",
    name: "Hỗ trợ doanh nghiệp mới",
    description: "Chuỗi hỗ trợ onboarding doanh nghiệp mới: gửi SMS/email → gọi hỗ trợ → tạo booking demo",
    delayUnit:  "immediate",
    delayValue: null,
    active: true,
    steps: [
      {
        order: 1,
        actionId: "ACT012", // Gửi SMS nhắc nhở
        branches: [
          {
            resultId:     "RES005", // Đã gửi
            order:        1,
            nextStepType: "next_in_chain",
            nextActionId: "ACT016", // → Gọi hỗ trợ kỹ thuật
            closeOutcome: null,
            delayUnit:    "hour",
            delayValue:   1,
          },
        ],
      },
      {
        order: 2,
        actionId: "ACT016", // Gọi điện hỗ trợ kỹ thuật
        branches: [
          {
            resultId:     "RES001", // Đã liên hệ
            order:        1,
            nextStepType: "next_in_chain",
            nextActionId: "ACT014", // → Tạo booking demo
            closeOutcome: null,
            delayUnit:    "day",
            delayValue:   1,
          },
          {
            resultId:     "RES002", // Không bắt máy
            order:        2,
            nextStepType: "next_in_chain",
            nextActionId: "ACT001", // → Gọi điện lần 1
            closeOutcome: null,
            delayUnit:    "hour",
            delayValue:   2,
          },
          {
            resultId:     "RES004", // Từ chối
            order:        3,
            nextStepType: "close_task",
            nextActionId: null,
            closeOutcome: "failure",
            delayUnit:    null,
            delayValue:   null,
          },
        ],
      },
      {
        order: 3,
        actionId: "ACT014", // Tạo booking demo
        branches: [
          {
            resultId:     "RES014", // Đã demo thành công
            order:        1,
            nextStepType: "close_task",
            nextActionId: null,
            closeOutcome: "success",
            delayUnit:    null,
            delayValue:   null,
          },
          {
            resultId:     "RES003", // Hẹn lại
            order:        2,
            nextStepType: "next_in_chain",
            nextActionId: "ACT014",
            closeOutcome: null,
            delayUnit:    "day",
            delayValue:   2,
          },
        ],
      },
    ],
  },

  // ─ CHAIN006: Xử lý nâng cấp cần thiết (inactive — đang tắt) ───────────────
  {
    id: "CHAIN006",
    name: "Nâng cấp Enterprise",
    description: "Chuỗi tư vấn và chốt deal nâng cấp lên gói Enterprise (hiện tắt - đang review)",
    delayUnit:  "day",
    delayValue: 2,
    active: false,  // ← INACTIVE chain (dùng để test filter)
    steps: [
      {
        order: 1,
        actionId: "ACT008", // Gửi tài liệu Enterprise
        branches: [
          {
            resultId:     "RES010",
            order:        1,
            nextStepType: "next_in_chain",
            nextActionId: "ACT003",
            closeOutcome: null,
            delayUnit:    "day",
            delayValue:   1,
          },
        ],
      },
      {
        order: 2,
        actionId: "ACT003", // Gọi tư vấn nâng cấp
        branches: [
          {
            resultId:     "RES001",
            order:        1,
            nextStepType: "next_in_chain",
            nextActionId: "ACT015", // → Gửi hợp đồng
            closeOutcome: null,
            delayUnit:    "day",
            delayValue:   1,
          },
          {
            resultId:     "RES004",
            order:        2,
            nextStepType: "close_task",
            nextActionId: null,
            closeOutcome: "failure",
            delayUnit:    null,
            delayValue:   null,
          },
        ],
      },
      {
        order: 3,
        actionId: "ACT015", // Gửi hợp đồng điện tử
        branches: [
          {
            resultId:     "RES016", // Đã gửi hợp đồng
            order:        1,
            nextStepType: "next_in_chain",
            nextActionId: "ACT006", // → Xác nhận thanh toán
            closeOutcome: null,
            delayUnit:    "day",
            delayValue:   2,
          },
        ],
      },
      {
        order: 4,
        actionId: "ACT006", // Gọi xác nhận thanh toán
        branches: [
          {
            resultId:     "RES006", // Đã thanh toán
            order:        1,
            nextStepType: "next_in_chain",
            nextActionId: "ACT009",
            closeOutcome: null,
            delayUnit:    "immediate",
            delayValue:   null,
          },
          {
            resultId:     "RES007", // Chưa thanh toán
            order:        2,
            nextStepType: "next_in_chain",
            nextActionId: "ACT006",
            closeOutcome: null,
            delayUnit:    "day",
            delayValue:   1,
          },
        ],
      },
      {
        order: 5,
        actionId: "ACT009", // Tạo đơn hàng
        branches: [
          {
            resultId:     "RES011",
            order:        1,
            nextStepType: "close_task",
            nextActionId: null,
            closeOutcome: "success",
            delayUnit:    null,
            delayValue:   null,
          },
        ],
      },
    ],
  },
];

// ─── Events ───────────────────────────────────────────────────────────────────
// Đa dạng:
//   - 5 group: user_moi, biz_moi, can_nang_cap, sap_het_han, chuyen_khoan
//   - Có assignee / Chưa có assignee (assigneeId: null, assignee: {name:"", ...})
//   - Timeline đa dạng (phone, email, note, event)
// ─────────────────────────────────────────────────────────────────────────────
const now = new Date();
const fmt = (d) => d.toLocaleString("vi-VN");
const daysAgo = (n) => {
  const d = new Date(now); d.setDate(d.getDate() - n); return fmt(d);
};
const hoursAgo = (n) => {
  const d = new Date(now); d.setHours(d.getHours() - n); return fmt(d);
};

const events = [

  // ════════════════════════════════════════════════════
  // GROUP: user_moi (4 events)
  // ════════════════════════════════════════════════════

  // EVT001: user_moi — có assignee — đã đồng bộ
  {
    id: "EVT001",
    name: "Đăng ký tài khoản mới",
    sub: "Hệ thống tự động",
    group: "user_moi",
    customer: {
      name: "Phạm Tường Vy",
      avatar: "https://i.pravatar.cc/100?img=15",
      role: "Giám đốc - Công ty TNHH Torano",
      email: "vy.pham@example.com",
      phone: "0912 345 678",
      source: "Facebook Ads",
      address: "Tầng 3, Tòa nhà AB, Quận 1, TP. HCM",
    },
    customerId: "CUST001",
    biz: { id: "#BIZ001", tags: ["Trial", "SmaxAi"] },
    assignee: { name: "Vũ Thu Phương", avatar: "https://i.pravatar.cc/100?img=25", role: "Nhân viên Sales" },
    assigneeId: "USER004",
    stage: "Đăng ký thành công",
    source: "CRM",
    tags: ["#UserMoi", "#Trial"],
    plan: { name: "TRIAL", cycle: "Dùng thử", price: "0 đ", daysLeft: 14, expiryDate: "02/05/2026" },
    services: [],
    quotas: [{ name: "Truy cập User", used: 1, total: 3, color: "blue" }],
    timeline: [
      { type: "event", title: "Tài khoản được tạo tự động", time: daysAgo(2), content: null, duration: null, createdBy: "System" },
      { type: "phone", title: "Gọi điện chào mừng", time: daysAgo(1), content: "Khách hàng bắt máy, hài lòng với sản phẩm", duration: "5 phút", createdBy: "Vũ Thu Phương" },
      { type: "note", title: "Ghi chú nội bộ", time: hoursAgo(3), content: "Khách quan tâm gói Basic, hẹn demo tuần sau", duration: null, createdBy: "Vũ Thu Phương" },
    ],
  },

  // EVT002: user_moi — có assignee — đã đồng bộ — timeline phong phú
  {
    id: "EVT002",
    name: "Hoàn tất hồ sơ cá nhân",
    sub: "Người dùng tự thao tác",
    group: "user_moi",
    customer: {
      name: "Nguyễn Thị Lan",
      avatar: "https://i.pravatar.cc/100?img=5",
      role: "Chủ cửa hàng - LanStore",
      email: "lan.nguyen@example.com",
      phone: "0933 222 111",
      source: "Google Ads",
      address: "89 Trần Phú, Hà Đông, Hà Nội",
    },
    customerId: "CUST004",
    biz: { id: "#BIZ002", tags: ["Trial", "Appvn"] },
    assignee: { name: "Lê Văn Hùng", avatar: "https://i.pravatar.cc/100?img=30", role: "Nhân viên Sales" },
    assigneeId: "USER005",
    stage: "Đã hoàn tất hồ sơ",
    source: "CRM",
    tags: ["#NewUser", "#HoSoHoanTat"],
    plan: { name: "TRIAL", cycle: "Dùng thử", price: "0 đ", daysLeft: 7, expiryDate: "25/04/2026" },
    services: [],
    quotas: [{ name: "Truy cập User", used: 1, total: 3, color: "blue" }],
    timeline: [
      { type: "event",  title: "Hồ sơ cá nhân hoàn tất",         time: daysAgo(3), content: null, duration: null, createdBy: "System" },
      { type: "email",  title: "Email chào mừng đã gửi",          time: daysAgo(3), content: "Automation gửi email giới thiệu dịch vụ thành công", duration: null, createdBy: "System" },
      { type: "phone",  title: "Gọi điện lần 1",                  time: daysAgo(2), content: "Không bắt máy — thử lại sau", duration: null, createdBy: "Lê Văn Hùng" },
      { type: "phone",  title: "Gọi điện lần 2",                  time: daysAgo(1), content: "Bắt máy, khách hàng hỏi về gói Basic", duration: "3 phút", createdBy: "Lê Văn Hùng" },
      { type: "note",   title: "Ghi chú: cần gửi bảng giá",       time: hoursAgo(5), content: "Khách muốn so sánh các gói, cần gửi file bảng giá 2026", duration: null, createdBy: "Lê Văn Hùng" },
    ],
  },

  // EVT003: user_moi — CHƯA có assignee
  {
    id: "EVT003",
    name: "Người dùng mới từ Google Ads",
    sub: "Tự đăng ký",
    group: "user_moi",
    customer: {
      name: "Trần Thị Hoa",
      avatar: "https://i.pravatar.cc/100?img=20",
      role: "Freelancer - HoaDesign",
      email: "hoa.tran@example.com",
      phone: "0977 333 444",
      source: "Google Ads",
      address: "Đà Nẵng",
    },
    customerId: "CUST006",
    biz: { id: "#BIZ007", tags: ["Trial"] },
    assignee: { name: "", avatar: "", role: "" },   // ← CHƯA ĐƯỢC GÁN
    assigneeId: null,
    stage: "Chờ phân công",
    source: "Google Ads",
    tags: ["#UserMoi", "#ChuaGan"],
    plan: { name: "TRIAL", cycle: "Dùng thử", price: "0 đ", daysLeft: 14, expiryDate: "02/05/2026" },
    services: [],
    quotas: [{ name: "Truy cập User", used: 1, total: 3, color: "blue" }],
    timeline: [
      { type: "event", title: "Tài khoản tự động tạo từ Google Ads", time: hoursAgo(2), content: null, duration: null, createdBy: "System" },
    ],
  },

  // EVT004: user_moi — CHƯA có assignee, CHƯA đồng bộ nhân viên hệ thống (customer ID chưa map)
  {
    id: "EVT004",
    name: "Đăng ký nhanh qua landing page",
    sub: "Landing page campaign tháng 4",
    group: "user_moi",
    customer: {
      name: "Nguyễn Văn Bình",   // KH chưa có trong CRM customer list
      avatar: "",
      role: "Chủ doanh nghiệp",
      email: "binh.nguyen.new@example.com",
      phone: "0812 999 000",
      source: "Landing Page",
      address: "TP. HCM",
    },
    customerId: null,             // ← CHƯA sync — customerId chưa có
    biz: { id: "", tags: ["Trial"] },
    assignee: { name: "", avatar: "", role: "" },   // ← CHƯA ĐƯỢC GÁN
    assigneeId: null,
    stage: "Chưa xử lý",
    source: "Landing Page",
    tags: ["#UserMoi", "#ChuaGan", "#ChuaSync"],
    plan: { name: "TRIAL", cycle: "Dùng thử", price: "0 đ", daysLeft: 14, expiryDate: "02/05/2026" },
    services: [],
    quotas: [],
    timeline: [
      { type: "event", title: "Đăng ký qua landing page campaign tháng 4", time: hoursAgo(1), content: null, duration: null, createdBy: "System" },
    ],
  },

  // ════════════════════════════════════════════════════
  // GROUP: biz_moi (3 events)
  // ════════════════════════════════════════════════════

  // EVT005: biz_moi — có assignee — timeline bình thường
  {
    id: "EVT005",
    name: "Tạo doanh nghiệp thành công",
    sub: "Hệ thống tự động",
    group: "biz_moi",
    customer: {
      name: "Hoàng Sơn",
      avatar: "https://i.pravatar.cc/100?img=7",
      role: "CEO - HoangSon Corp",
      email: "son.hoang@example.com",
      phone: "0966 444 555",
      source: "Facebook",
      address: "123 Nguyễn Trãi, Quận 5, TP. HCM",
    },
    customerId: "CUST003",
    biz: { id: "#BIZ003", tags: ["Trial", "FB"] },
    assignee: { name: "Vũ Thu Phương", avatar: "https://i.pravatar.cc/100?img=25", role: "Nhân viên Sales" },
    assigneeId: "USER004",
    stage: "Tạo biz thành công",
    source: "CRM",
    tags: ["#BizMoi", "#Trial"],
    plan: { name: "TRIAL", cycle: "Dùng thử", price: "0 đ", daysLeft: 14, expiryDate: "02/05/2026" },
    services: [],
    quotas: [{ name: "Truy cập User", used: 1, total: 3, color: "blue" }],
    timeline: [
      { type: "event", title: "Biz được tạo từ hệ thống", time: daysAgo(1), content: null, duration: null, createdBy: "System" },
      { type: "email", title: "Email chào mừng doanh nghiệp mới", time: daysAgo(1), content: "Gửi email onboarding tự động thành công", duration: null, createdBy: "System" },
      { type: "phone", title: "Gọi điện onboarding", time: hoursAgo(4), content: "Khách tiếp nhận, sẽ thử nghiệm tuần này", duration: "7 phút", createdBy: "Vũ Thu Phương" },
    ],
  },

  // EVT006: biz_moi — có assignee — Doanh nghiệp lớn (Enterprise)
  {
    id: "EVT006",
    name: "Kết nối kênh chat đầu tiên",
    sub: "Tự động kích hoạt",
    group: "biz_moi",
    customer: {
      name: "Đặng Quang Huy",
      avatar: "https://i.pravatar.cc/100?img=52",
      role: "Giám đốc IT - HuyGroup",
      email: "huy.dang@example.com",
      phone: "0911 222 555",
      source: "Zalo",
      address: "Hà Nội",
    },
    customerId: "CUST007",
    biz: { id: "#BIZ008", tags: ["Basic", "Zalo"] },
    assignee: { name: "Phạm Thanh Sơn", avatar: "https://i.pravatar.cc/100?img=12", role: "Manager" },
    assigneeId: "USER003",
    stage: "Kết nối thành công",
    source: "CRM",
    tags: ["#BizMoi", "#Enterprise", "#ZaloOA"],
    plan: { name: "BASIC", cycle: "Thanh toán theo tháng", price: "990.000 đ", daysLeft: 25, expiryDate: "12/05/2026" },
    services: [{ name: "Zalo OA Integration", active: true }],
    quotas: [
      { name: "Truy cập User", used: 3, total: 5, color: "blue" },
      { name: "Bot Message", used: 1200, total: 5000, color: "blue" },
    ],
    timeline: [
      { type: "event", title: "Kết nối Zalo OA thành công", time: daysAgo(2), content: null, duration: null, createdBy: "System" },
      { type: "phone", title: "Gọi điện chào mừng Doanh nghiệp", time: daysAgo(1), content: "CEO bắt máy, muốn nâng cấp lên Premium", duration: "12 phút", createdBy: "Phạm Thanh Sơn" },
      { type: "note",  title: "Tiềm năng Enterprise",  time: hoursAgo(2), content: "Khách đang dùng SmaxAi + Botvn, muốn thêm Appvn, đề xuất gói Bundle", duration: null, createdBy: "Phạm Thanh Sơn" },
    ],
  },

  // EVT007: biz_moi — CHƯA có assignee — khách từ website
  {
    id: "EVT007",
    name: "Doanh nghiệp mới tự đăng ký website",
    sub: "Đăng ký trực tiếp",
    group: "biz_moi",
    customer: {
      name: "Lý Thị Thu",
      avatar: "https://i.pravatar.cc/100?img=18",
      role: "Chủ - ThuFashion",
      email: "thu.ly@example.com",
      phone: "0944 888 333",
      source: "Website",
      address: "Quận Bình Thạnh, TP. HCM",
    },
    customerId: "CUST008",
    biz: { id: "#BIZ009", tags: ["Trial"] },
    assignee: { name: "", avatar: "", role: "" },   // ← CHƯA ĐƯỢC GÁN
    assigneeId: null,
    stage: "Chờ phân công",
    source: "Website",
    tags: ["#BizMoi", "#ChuaGan"],
    plan: { name: "TRIAL", cycle: "Dùng thử", price: "0 đ", daysLeft: 14, expiryDate: "02/05/2026" },
    services: [],
    quotas: [],
    timeline: [
      { type: "event", title: "Doanh nghiệp tạo qua website", time: hoursAgo(6), content: null, duration: null, createdBy: "System" },
    ],
  },

  // ════════════════════════════════════════════════════
  // GROUP: can_nang_cap (3 events)
  // ════════════════════════════════════════════════════

  // EVT008: can_nang_cap — có assignee — nhiều cảnh báo quota
  {
    id: "EVT008",
    name: "Dung lượng lưu trữ sắp đầy",
    sub: "Cảnh báo tự động",
    group: "can_nang_cap",
    customer: {
      name: "Phạm Tường Vy",
      avatar: "https://i.pravatar.cc/100?img=15",
      role: "Giám đốc - Công ty TNHH Torano",
      email: "vy.pham@example.com",
      phone: "0912 345 678",
      source: "Direct",
      address: "TP. HCM",
    },
    customerId: "CUST001",
    biz: { id: "#BIZ001", tags: ["Basic", "SmaxAi"] },
    assignee: { name: "Phạm Thanh Sơn", avatar: "https://i.pravatar.cc/100?img=12", role: "Manager" },
    assigneeId: "USER003",
    stage: "Cảnh báo nâng cấp",
    source: "CRM",
    tags: ["#UpgradeNeeded", "#StorageFull"],
    plan: { name: "BASIC", cycle: "Thanh toán theo tháng", price: "990.000 đ", daysLeft: 12, expiryDate: "30/04/2026" },
    services: [
      { name: "Livechat Support", active: true },
      { name: "Zalo OA Integration", active: false },
    ],
    quotas: [
      { name: "Truy cập User",        used: 4,   total: 5,    color: "orange" },
      { name: "Dung lượng lưu trữ",   used: 920, total: 1000, color: "red" },
      { name: "Bot Message / tháng",  used: 4800, total: 5000, color: "red" },
    ],
    timeline: [
      { type: "event", title: "Cảnh báo dung lượng đạt 92%",            time: daysAgo(3), content: null, duration: null, createdBy: "System" },
      { type: "phone", title: "Gọi tư vấn nâng cấp",                    time: daysAgo(2), content: "Khách hàng đang cân nhắc nâng lên Premium", duration: "8 phút", createdBy: "Phạm Thanh Sơn" },
      { type: "email", title: "Email bảng so sánh gói",                  time: daysAgo(1), content: "Đã gửi email so sánh gói Basic vs Premium vs Enterprise", duration: null, createdBy: "System" },
      { type: "note",  title: "Khách muốn biết thêm về gói Enterprise",  time: hoursAgo(2), content: "CEO Vy hỏi về batch processing và API rate limit của gói cao nhất", duration: null, createdBy: "Phạm Thanh Sơn" },
    ],
  },

  // EVT009: can_nang_cap — có assignee — Trial hết hạn
  {
    id: "EVT009",
    name: "Hết hạn gói Trial — Cần nâng cấp",
    sub: "Hệ thống gửi thông báo",
    group: "can_nang_cap",
    customer: {
      name: "Nguyễn Thị Lan",
      avatar: "https://i.pravatar.cc/100?img=5",
      role: "Chủ cửa hàng - LanStore",
      email: "lan.nguyen@example.com",
      phone: "0933 222 111",
      source: "Google Ads",
      address: "Hà Nội",
    },
    customerId: "CUST004",
    biz: { id: "#BIZ002", tags: ["Trial"] },
    assignee: { name: "Vũ Thu Phương", avatar: "https://i.pravatar.cc/100?img=25", role: "Nhân viên Sales" },
    assigneeId: "USER004",
    stage: "Hết hạn Trial",
    source: "CRM",
    tags: ["#TrialExpired", "#CanNangCap"],
    plan: { name: "TRIAL", cycle: "Dùng thử", price: "0 đ", daysLeft: 0, expiryDate: "10/04/2026" },
    services: [],
    quotas: [{ name: "Truy cập User", used: 3, total: 3, color: "red" }],
    timeline: [
      { type: "event", title: "Gói Trial đã hết hạn",        time: daysAgo(8), content: null, duration: null, createdBy: "System" },
      { type: "email", title: "Email nhắc nâng cấp lần 1",   time: daysAgo(7), content: "Gửi email tự động — reminder lần 1", duration: null, createdBy: "System" },
      { type: "phone", title: "Gọi tư vấn nâng cấp",         time: daysAgo(5), content: "Không bắt máy", duration: null, createdBy: "Vũ Thu Phương" },
      { type: "phone", title: "Gọi tư vấn lần 2",            time: daysAgo(3), content: "Khách hẹn gọi lại cuối tuần", duration: "2 phút", createdBy: "Vũ Thu Phương" },
      { type: "note",  title: "Theo dõi cuối tuần",          time: daysAgo(3), content: "Khách nói có ngân sách Q2, sẽ call lại thứ Hai", duration: null, createdBy: "Vũ Thu Phương" },
    ],
  },

  // EVT010: can_nang_cap — CHƯA có assignee — cảnh báo user quota
  {
    id: "EVT010",
    name: "Vượt giới hạn số lượng user",
    sub: "Hệ thống cảnh báo",
    group: "can_nang_cap",
    customer: {
      name: "Bảo Quốc",
      avatar: "https://i.pravatar.cc/100?img=33",
      role: "Chủ doanh nghiệp - QuocBiz",
      email: "quoc.bao@example.com",
      phone: "0988 666 777",
      source: "Zalo",
      address: "TP. HCM",
    },
    customerId: "CUST005",
    biz: { id: "#BIZ004", tags: ["Basic"] },
    assignee: { name: "", avatar: "", role: "" },   // ← CHƯA ĐƯỢC GÁN
    assigneeId: null,
    stage: "Chờ phân công",
    source: "CRM",
    tags: ["#UserQuotaFull", "#ChuaGan"],
    plan: { name: "BASIC", cycle: "Thanh toán theo tháng", price: "990.000 đ", daysLeft: 18, expiryDate: "06/05/2026" },
    services: [{ name: "Livechat Support", active: true }],
    quotas: [
      { name: "Truy cập User", used: 5, total: 5, color: "red" },
    ],
    timeline: [
      { type: "event", title: "Cảnh báo vượt giới hạn user (5/5)", time: hoursAgo(3), content: null, duration: null, createdBy: "System" },
    ],
  },

  // ════════════════════════════════════════════════════
  // GROUP: sap_het_han (3 events)
  // ════════════════════════════════════════════════════

  // EVT011: sap_het_han — có assignee — còn 7 ngày
  {
    id: "EVT011",
    name: "Gói cước sắp hết hạn — còn 7 ngày",
    sub: "Thông báo tự động",
    group: "sap_het_han",
    customer: {
      name: "Minh Khôi",
      avatar: "https://i.pravatar.cc/100?img=62",
      role: "CEO - KhoiCorp",
      email: "khoi.minh@example.com",
      phone: "0999 777 888",
      source: "Direct",
      address: "Hà Nội",
    },
    customerId: "CUST002",
    biz: { id: "#BIZ005", tags: ["Enterprise", "TPBank"] },
    assignee: { name: "Phạm Thanh Sơn", avatar: "https://i.pravatar.cc/100?img=12", role: "Manager" },
    assigneeId: "USER003",
    stage: "Còn 7 ngày",
    source: "CRM",
    tags: ["#SapHetHan", "#Enterprise"],
    plan: { name: "ENTERPRISE", cycle: "Thanh toán theo năm", price: "19.990.000 đ", daysLeft: 7, expiryDate: "25/04/2026" },
    services: [
      { name: "Zalo OA Integration", active: true },
      { name: "Livechat Support",    active: true },
      { name: "Email Marketing",     active: true },
    ],
    quotas: [{ name: "Truy cập User", used: 12, total: 50, color: "blue" }],
    timeline: [
      { type: "event", title: "Thông báo sắp hết hạn — 7 ngày",        time: daysAgo(1), content: null, duration: null, createdBy: "System" },
      { type: "email", title: "Email nhắc gia hạn tự động",            time: daysAgo(1), content: "Automation gửi email nhắc gia hạn Enterprise", duration: null, createdBy: "System" },
      { type: "phone", title: "Gọi tư vấn gia hạn",                   time: hoursAgo(5), content: "CEO đang họp, hẹn gọi lại chiều mai", duration: "1 phút", createdBy: "Phạm Thanh Sơn" },
    ],
  },

  // EVT012: sap_het_han — có assignee — còn 2 ngày (khẩn cấp)
  {
    id: "EVT012",
    name: "Gói cước sắp hết hạn — còn 2 ngày",
    sub: "Cảnh báo khẩn cấp",
    group: "sap_het_han",
    customer: {
      name: "Hoàng Sơn",
      avatar: "https://i.pravatar.cc/100?img=7",
      role: "CEO - HoangSon Corp",
      email: "son.hoang@example.com",
      phone: "0966 444 555",
      source: "Facebook",
      address: "TP. HCM",
    },
    customerId: "CUST003",
    biz: { id: "#BIZ003", tags: ["Trial"] },
    assignee: { name: "Lê Văn Hùng", avatar: "https://i.pravatar.cc/100?img=30", role: "Nhân viên Sales" },
    assigneeId: "USER005",
    stage: "Còn 2 ngày — Khẩn",
    source: "CRM",
    tags: ["#Urgent", "#SapHetHan"],
    plan: { name: "TRIAL", cycle: "Dùng thử", price: "0 đ", daysLeft: 2, expiryDate: "20/04/2026" },
    services: [],
    quotas: [{ name: "Truy cập User", used: 3, total: 3, color: "red" }],
    timeline: [
      { type: "event", title: "Cảnh báo khẩn — còn 2 ngày hết hạn",   time: daysAgo(1), content: null, duration: null, createdBy: "System" },
      { type: "email", title: "Email nhắc khẩn cấp",                   time: daysAgo(1), content: "Gửi email cảnh báo lần cuối", duration: null, createdBy: "System" },
      { type: "phone", title: "Gọi điện lần 1",                        time: hoursAgo(8), content: "Không bắt máy", duration: null, createdBy: "Lê Văn Hùng" },
      { type: "phone", title: "Gọi điện lần 2",                        time: hoursAgo(2), content: "Máy bận", duration: null, createdBy: "Lê Văn Hùng" },
      { type: "note",  title: "Ưu tiên gọi lại ngay",                  time: hoursAgo(1), content: "2 lần gọi không liên lạc được, cần escalate lên Manager", duration: null, createdBy: "Lê Văn Hùng" },
    ],
  },

  // EVT013: sap_het_han — CHƯA có assignee — khách lớn (Đặng Quang Huy)
  {
    id: "EVT013",
    name: "Gói Premium sắp hết hạn — còn 14 ngày",
    sub: "Nhắc gia hạn trước 14 ngày",
    group: "sap_het_han",
    customer: {
      name: "Đặng Quang Huy",
      avatar: "https://i.pravatar.cc/100?img=52",
      role: "Giám đốc IT - HuyGroup",
      email: "huy.dang@example.com",
      phone: "0911 222 555",
      source: "Direct",
      address: "Hà Nội",
    },
    customerId: "CUST007",
    biz: { id: "#BIZ008", tags: ["Premium", "Direct"] },
    assignee: { name: "", avatar: "", role: "" },   // ← CHƯA ĐƯỢC GÁN
    assigneeId: null,
    stage: "Còn 14 ngày",
    source: "CRM",
    tags: ["#SapHetHan", "#ChuaGan", "#VIP"],
    plan: { name: "PREMIUM", cycle: "Thanh toán theo năm", price: "5.990.000 đ", daysLeft: 14, expiryDate: "02/05/2026" },
    services: [
      { name: "Zalo OA Integration", active: true },
      { name: "Livechat Support",    active: true },
    ],
    quotas: [
      { name: "Truy cập User",  used: 8, total: 20, color: "blue" },
      { name: "Email / tháng",  used: 5000, total: 10000, color: "blue" },
    ],
    timeline: [
      { type: "event", title: "Hệ thống nhắc gia hạn — còn 14 ngày", time: hoursAgo(4), content: null, duration: null, createdBy: "System" },
    ],
  },

  // ════════════════════════════════════════════════════
  // GROUP: chuyen_khoan (4 events)
  // ════════════════════════════════════════════════════

  // EVT014: chuyen_khoan — có assignee — đã xác nhận
  {
    id: "EVT014",
    name: "Xác nhận thanh toán thành công",
    sub: "Đơn hàng #DH2026-001",
    group: "chuyen_khoan",
    customer: {
      name: "Minh Khôi",
      avatar: "https://i.pravatar.cc/100?img=62",
      role: "CEO - KhoiCorp",
      email: "khoi.minh@example.com",
      phone: "0999 777 888",
      source: "TPBank",
      address: "Hà Nội",
    },
    customerId: "CUST002",
    biz: { id: "#BIZ005", tags: ["Enterprise", "TPBank"] },
    assignee: { name: "Phạm Thanh Sơn", avatar: "https://i.pravatar.cc/100?img=12", role: "Manager" },
    assigneeId: "USER003",
    stage: "Đã xác nhận",
    source: "TPBank",
    tags: ["#Paid", "#Enterprise"],
    plan: { name: "ENTERPRISE", cycle: "Thanh toán theo năm", price: "19.990.000 đ", daysLeft: 365, expiryDate: "18/04/2027" },
    services: [
      { name: "Zalo OA Integration", active: true },
      { name: "Livechat Support",    active: true },
      { name: "Email Marketing",     active: true },
    ],
    quotas: [{ name: "Truy cập User", used: 12, total: 50, color: "blue" }],
    timeline: [
      { type: "event", title: "Nhận thanh toán đơn #DH2026-001 — TPBank",  time: daysAgo(1), content: "Số tiền: 19.990.000 đ", duration: null, createdBy: "System" },
      { type: "phone", title: "Gọi xác nhận thanh toán",                   time: daysAgo(1), content: "Khách xác nhận đã chuyển khoản thành công", duration: "3 phút", createdBy: "Phạm Thanh Sơn" },
      { type: "note",  title: "Đã kích hoạt gói Enterprise",               time: hoursAgo(20), content: "Tất cả service đã được bật. Gửi email welcome Enterprise.", duration: null, createdBy: "System" },
    ],
  },

  // EVT015: chuyen_khoan — có assignee — chờ xác nhận
  {
    id: "EVT015",
    name: "Thanh toán chuyển khoản mới",
    sub: "Đơn hàng #DH2026-002",
    group: "chuyen_khoan",
    customer: {
      name: "Bảo Quốc",
      avatar: "https://i.pravatar.cc/100?img=33",
      role: "Chủ doanh nghiệp - QuocBiz",
      email: "quoc.bao@example.com",
      phone: "0988 666 777",
      source: "VCB",
      address: "TP. HCM",
    },
    customerId: "CUST005",
    biz: { id: "#BIZ006", tags: ["Premium", "VCB"] },
    assignee: { name: "Lê Văn Hùng", avatar: "https://i.pravatar.cc/100?img=30", role: "Nhân viên Sales" },
    assigneeId: "USER005",
    stage: "Chờ xác nhận",
    source: "VCB",
    tags: ["#WaitingConfirm", "#ChuyenKhoan"],
    plan: { name: "PREMIUM", cycle: "Thanh toán theo tháng", price: "2.990.000 đ", daysLeft: 30, expiryDate: "18/05/2026" },
    services: [{ name: "Livechat Support", active: true }],
    quotas: [{ name: "Truy cập User", used: 3, total: 10, color: "blue" }],
    timeline: [
      { type: "event", title: "Nhận thanh toán chuyển khoản qua VCB",     time: hoursAgo(3), content: "Số tiền: 2.990.000 đ — Đơn hàng #DH2026-002", duration: null, createdBy: "System" },
      { type: "phone", title: "Gọi điện xác nhận",                        time: hoursAgo(2), content: "Không bắt máy — thử lại", duration: null, createdBy: "Lê Văn Hùng" },
    ],
  },

  // EVT016: chuyen_khoan — CHƯA có assignee — cần xử lý gấp
  {
    id: "EVT016",
    name: "Chuyển khoản nhưng chưa có đơn hàng",
    sub: "Cần xác minh nội dung CK",
    group: "chuyen_khoan",
    customer: {
      name: "Lý Thị Thu",
      avatar: "https://i.pravatar.cc/100?img=18",
      role: "Chủ - ThuFashion",
      email: "thu.ly@example.com",
      phone: "0944 888 333",
      source: "BIDV",
      address: "TP. HCM",
    },
    customerId: "CUST008",
    biz: { id: "", tags: [] },
    assignee: { name: "", avatar: "", role: "" },   // ← CHƯA ĐƯỢC GÁN
    assigneeId: null,
    stage: "Chờ xác minh",
    source: "BIDV",
    tags: ["#ChuaGan", "#CKChuaCoOrder", "#Urgent"],
    plan: { name: "TRIAL", cycle: "Dùng thử", price: "0 đ", daysLeft: 14, expiryDate: "02/05/2026" },
    services: [],
    quotas: [],
    timeline: [
      { type: "event", title: "Nhận chuyển khoản BIDV — chưa có đơn hàng khớp", time: hoursAgo(1), content: "Số tiền: 990.000 đ — nội dung CK: ThuFashion Basic", duration: null, createdBy: "System" },
    ],
  },

  // EVT017: chuyen_khoan — CHƯA có assignee, CHƯA đồng bộ — customer ID null
  {
    id: "EVT017",
    name: "Thanh toán từ khách hàng chưa trong hệ thống",
    sub: "Đơn hàng #DH2026-003",
    group: "chuyen_khoan",
    customer: {
      name: "Công ty ABC Corp",   // Chưa trong CRM
      avatar: "",
      role: "Chủ doanh nghiệp",
      email: "contact@abccorp.vn",
      phone: "0900 111 222",
      source: "MBBank",
      address: "Hà Nội",
    },
    customerId: null,             // ← CHƯA sync
    biz: { id: "", tags: [] },
    assignee: { name: "", avatar: "", role: "" },   // ← CHƯA ĐƯỢC GÁN
    assigneeId: null,
    stage: "Chưa xử lý",
    source: "MBBank",
    tags: ["#ChuaGan", "#ChuaSync", "#ChuyenKhoan"],
    plan: { name: "TRIAL", cycle: "Dùng thử", price: "0 đ", daysLeft: 0, expiryDate: "" },
    services: [],
    quotas: [],
    timeline: [
      { type: "event", title: "Nhận chuyển khoản từ KH chưa trong hệ thống", time: hoursAgo(0), content: "Số tiền: 1.990.000 đ — MBBank — Cần tạo KH và gán đơn", duration: null, createdBy: "System" },
    ],
  },
];

module.exports = {
  organizations,
  users,
  customers,
  leads,
  tasks,
  staffFunctions,
  events,
  results,
  reasons,
  actions,
  actionChains,
};
