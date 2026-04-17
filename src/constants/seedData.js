/**
 * seedData.js — Bộ dữ liệu mẫu CRM
 *
 * Bao gồm:
 *   organizations · users · customers · events (đủ 5 nhóm)
 *   actions · results · reasons · actionChains
 *
 * Giữ ít, đủ để test đầy đủ các luồng chính.
 */

// ─── Organizations ───────────────────────────────────────────────────────────
const organizations = [
  {
    id: "1",
    parent: "Phòng Marketing",
    children: [
      { name: "Nhóm Facebook Ads",  desc: "Chạy quảng cáo đa nền tảng" },
      { name: "Nhóm Content",       desc: "Sản xuất nội dung media, bài viết" },
    ],
  },
  {
    id: "2",
    parent: "Phòng Sale",
    children: [
      { name: "Nhóm Sale Hà Nội", desc: "Telesale & chốt đơn khu vực miền Bắc" },
      { name: "Nhóm Sale HCM",    desc: "Telesale & chốt đơn khu vực miền Nam" },
    ],
  },
  {
    id: "3",
    parent: "Phòng Kỹ Thuật",
    children: [
      { name: "Nhóm Backend",  desc: "Phát triển API và xử lý dữ liệu" },
      { name: "Nhóm Frontend", desc: "Phát triển giao diện người dùng" },
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
    tags: ["#KHTiemNang"],
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
  // ── Mới thêm ──
  { id: "RES009", name: "Hứng thú - cần demo",       type: "neutral", description: "Khách hàng quan tâm nhưng muốn xem demo trước" },
  { id: "RES010", name: "Đã gửi tài liệu",           type: "success", description: "Tài liệu/proposal đã được gửi thành công" },
  { id: "RES011", name: "Đã tạo đơn hàng",           type: "success", description: "Đơn hàng được tạo thành công trong hệ thống" },
];

// ─── Reasons ─────────────────────────────────────────────────────────────────
const reasons = [
  { id: "REAS001", name: "Bận việc",             description: "Khách hàng bận, không tiếp chuyện được" },
  { id: "REAS002", name: "Không có nhu cầu",     description: "Khách không có nhu cầu sử dụng dịch vụ" },
  { id: "REAS003", name: "Giá cao",              description: "Khách hàng cho rằng giá dịch vụ quá cao" },
  { id: "REAS004", name: "Cân nhắc thêm",        description: "Khách muốn suy nghĩ thêm trước khi quyết định" },
  { id: "REAS005", name: "Dùng dịch vụ khác",    description: "Đang dùng sản phẩm/dịch vụ của đối thủ" },
  // ── Mới thêm ──
  { id: "REAS006", name: "Chưa có ngân sách",    description: "Khách hàng chưa có budget để thanh toán ngay" },
  { id: "REAS007", name: "Cần thêm thông tin",   description: "Khách cần tài liệu/demo trước khi quyết định" },
  { id: "REAS008", name: "Sai số tài khoản",     description: "Thông tin thanh toán không chính xác" },
  { id: "REAS009", name: "Hết hạn thẻ",          description: "Thẻ thanh toán đã hết hạn" },
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
  // ── Mới thêm ──
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
];

// ─── ActionChains ─────────────────────────────────────────────────────────────
// Đây là chuỗi hành động template (cấu hình quy tắc)
// delay (chain-level): "immediate" | "1h" | "4h" | "1d" | "3d" | "7d"
// branch.nextStepType: "next_in_chain" | "close_task" | "close_chain" | ...
// branch.closeOutcome: "success" | "failure" (chỉ khi nextStepType === "close_task")
// branch.delayUnit: "immediate" | "minute" | "hour" | "day" | "week"
const actionChains = [
  // ─ Chuỗi 1: Chăm sóc khách hàng mới ────────────────────────────────────
  {
    id: "CHAIN001",
    name: "Chăm sóc khách hàng mới",
    description: "Chuỗi chăm sóc tự động khi có user/biz mới đăng ký",
    delay: "immediate",
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
            resultId:     "RES003", // Hẹn gọi lại
            order:        3,
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

  // ─ Chuỗi 2: Xử lý chuyển khoản ─────────────────────────────────────────
  {
    id: "CHAIN002",
    name: "Xử lý chuyển khoản",
    description: "Xác nhận và xử lý khi nhận thanh toán chuyển khoản",
    delay: "immediate",
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
        ],
      },
    ],
  },

  // ─ Chuỗi 3: Gia hạn sắp hết hạn ────────────────────────────────────────
  {
    id: "CHAIN003",
    name: "Nhắc gia hạn gói cước",
    description: "Tự động nhắc gia hạn khi gói cước sắp hết hạn",
    delay: "immediate",
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
            resultId:     "RES004", // Từ chối
            order:        2,
            nextStepType: "close_task",
            nextActionId: null,
            closeOutcome: "failure",
            delayUnit:    null,
            delayValue:   null,
          },
          {
            resultId:     "RES003", // Hẹn gọi lại
            order:        3,
            nextStepType: "next_in_chain",
            nextActionId: "ACT003",
            closeOutcome: null,
            delayUnit:    "day",
            delayValue:   2,
          },
        ],
      },
    ],
  },
];

// ─── Events ───────────────────────────────────────────────────────────────────
// group: "user_moi" | "biz_moi" | "can_nang_cap" | "sap_het_han" | "chuyen_khoan"
const now = new Date();
const fmt = (d) => d.toLocaleString("vi-VN");

const events = [
  // ── user_moi (2) ──────────────────────────────────────────────────────────
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
    tags: ["#UserMoi"],
    plan: { name: "TRIAL", cycle: "Dùng thử", price: "0 đ", daysLeft: 14, expiryDate: "28/04/2026" },
    services: [],
    quotas: [{ name: "Truy cập User", used: 1, total: 3, color: "blue" }],
    timeline: [
      { type: "event", title: "Tài khoản được tạo tự động", time: fmt(now), content: null, duration: null, createdBy: "System" },
    ],
  },
  {
    id: "EVT002",
    name: "Hoàn tất hồ sơ cá nhân",
    sub: "Người dùng tự thao tác",
    group: "user_moi",
    customer: {
      name: "Nguyễn Thị Lan",
      avatar: "https://i.pravatar.cc/100?img=5",
      role: "Khách hàng",
      email: "lan.nguyen@example.com",
      phone: "0933 222 111",
      source: "Google Ads",
      address: "TP. Hà Nội",
    },
    customerId: "CUST004",
    biz: { id: "#BIZ002", tags: ["Trial", "Appvn"] },
    assignee: { name: "Lê Văn Hùng", avatar: "https://i.pravatar.cc/100?img=30", role: "Nhân viên Sales" },
    assigneeId: "USER005",
    stage: "Đã hoàn tất hồ sơ",
    tags: ["#NewUser"],
    plan: { name: "TRIAL", cycle: "Dùng thử", price: "0 đ", daysLeft: 7, expiryDate: "21/04/2026" },
    services: [],
    quotas: [{ name: "Truy cập User", used: 1, total: 3, color: "blue" }],
    timeline: [
      { type: "event", title: "Hồ sơ cá nhân hoàn tất", time: fmt(now), content: null, duration: null, createdBy: "System" },
    ],
  },

  // ── biz_moi (2) ───────────────────────────────────────────────────────────
  {
    id: "EVT003",
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
      address: "TP. HCM",
    },
    customerId: "CUST003",
    biz: { id: "#BIZ003", tags: ["Trial", "FB"] },
    assignee: { name: "Vũ Thu Phương", avatar: "https://i.pravatar.cc/100?img=25", role: "Nhân viên Sales" },
    assigneeId: "USER004",
    stage: "Tạo biz thành công",
    tags: ["#BizMoi"],
    plan: { name: "TRIAL", cycle: "Dùng thử", price: "0 đ", daysLeft: 14, expiryDate: "28/04/2026" },
    services: [],
    quotas: [{ name: "Truy cập User", used: 1, total: 3, color: "blue" }],
    timeline: [
      { type: "event", title: "Biz được tạo từ hệ thống", time: fmt(now), content: null, duration: null, createdBy: "System" },
    ],
  },
  {
    id: "EVT004",
    name: "Kết nối kênh chat đầu tiên",
    sub: "Tự động kích hoạt",
    group: "biz_moi",
    customer: {
      name: "Bảo Quốc",
      avatar: "https://i.pravatar.cc/100?img=33",
      role: "Khách hàng",
      email: "quoc.bao@example.com",
      phone: "0988 666 777",
      source: "Zalo",
      address: "TP. HCM",
    },
    customerId: "CUST005",
    biz: { id: "#BIZ004", tags: ["Basic", "Zalo"] },
    assignee: { name: "Lê Văn Hùng", avatar: "https://i.pravatar.cc/100?img=30", role: "Nhân viên Sales" },
    assigneeId: "USER005",
    stage: "Kết nối thành công",
    tags: ["#Connected"],
    plan: { name: "BASIC", cycle: "Thanh toán theo tháng", price: "990.000 đ", daysLeft: 28, expiryDate: "15/05/2026" },
    services: [{ name: "Zalo OA Integration", active: true }],
    quotas: [{ name: "Truy cập User", used: 2, total: 5, color: "blue" }],
    timeline: [
      { type: "event", title: "Kết nối Zalo OA thành công", time: fmt(now), content: null, duration: null, createdBy: "System" },
    ],
  },

  // ── can_nang_cap (2) ──────────────────────────────────────────────────────
  {
    id: "EVT005",
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
    tags: ["#UpgradeNeeded"],
    plan: { name: "BASIC", cycle: "Thanh toán theo tháng", price: "990.000 đ", daysLeft: 12, expiryDate: "29/04/2026" },
    services: [{ name: "Livechat Support", active: true }],
    quotas: [
      { name: "Truy cập User", used: 4, total: 5, color: "orange" },
      { name: "Dung lượng lưu trữ", used: 920, total: 1000, color: "red" },
    ],
    timeline: [
      { type: "event", title: "Cảnh báo dung lượng đạt 92%", time: fmt(now), content: null, duration: null, createdBy: "System" },
    ],
  },
  {
    id: "EVT006",
    name: "Hết hạn gói Trial",
    sub: "Hệ thống gửi thông báo",
    group: "can_nang_cap",
    customer: {
      name: "Nguyễn Thị Lan",
      avatar: "https://i.pravatar.cc/100?img=5",
      role: "Khách hàng",
      email: "lan.nguyen@example.com",
      phone: "0933 222 111",
      source: "Google Ads",
      address: "TP. Hà Nội",
    },
    customerId: "CUST004",
    biz: { id: "#BIZ002", tags: ["Trial"] },
    assignee: { name: "Vũ Thu Phương", avatar: "https://i.pravatar.cc/100?img=25", role: "Nhân viên Sales" },
    assigneeId: "USER004",
    stage: "Hết hạn Trial",
    tags: ["#TrialExpired"],
    plan: { name: "TRIAL", cycle: "Dùng thử", price: "0 đ", daysLeft: 0, expiryDate: "10/04/2026" },
    services: [],
    quotas: [{ name: "Truy cập User", used: 3, total: 3, color: "red" }],
    timeline: [
      { type: "event", title: "Gói Trial đã hết hạn", time: fmt(now), content: null, duration: null, createdBy: "System" },
    ],
  },

  // ── sap_het_han (2) ──────────────────────────────────────────────────────
  {
    id: "EVT007",
    name: "Gói cước sắp hết hạn - 7 ngày",
    sub: "Thông báo tự động",
    group: "sap_het_han",
    customer: {
      name: "Minh Khôi",
      avatar: "https://i.pravatar.cc/100?img=62",
      role: "Khách hàng",
      email: "khoi.minh@example.com",
      phone: "0999 777 888",
      source: "Direct",
      address: "TP. Hà Nội",
    },
    customerId: "CUST002",
    biz: { id: "#BIZ005", tags: ["Enterprise", "TPBank"] },
    assignee: { name: "Phạm Thanh Sơn", avatar: "https://i.pravatar.cc/100?img=12", role: "Manager" },
    assigneeId: "USER003",
    stage: "Còn 7 ngày",
    tags: ["#SapHetHan"],
    plan: { name: "ENTERPRISE", cycle: "Thanh toán theo năm", price: "19.990.000 đ", daysLeft: 7, expiryDate: "24/04/2026" },
    services: [{ name: "Zalo OA Integration", active: true }, { name: "Livechat Support", active: true }],
    quotas: [{ name: "Truy cập User", used: 12, total: 50, color: "blue" }],
    timeline: [
      { type: "event", title: "Thông báo sắp hết hạn gói Enterprise", time: fmt(now), content: null, duration: null, createdBy: "System" },
    ],
  },
  {
    id: "EVT008",
    name: "Gói cước sắp hết hạn - 2 ngày",
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
    stage: "Còn 2 ngày",
    tags: ["#Urgent"],
    plan: { name: "TRIAL", cycle: "Dùng thử", price: "0 đ", daysLeft: 2, expiryDate: "19/04/2026" },
    services: [],
    quotas: [{ name: "Truy cập User", used: 3, total: 3, color: "red" }],
    timeline: [
      { type: "event", title: "Cảnh báo khẩn - còn 2 ngày hết hạn", time: fmt(now), content: null, duration: null, createdBy: "System" },
    ],
  },

  // ── chuyen_khoan (2) ──────────────────────────────────────────────────────
  {
    id: "EVT009",
    name: "Xác nhận thanh toán thành công",
    sub: "Đơn hàng #DH2026-001",
    group: "chuyen_khoan",
    customer: {
      name: "Minh Khôi",
      avatar: "https://i.pravatar.cc/100?img=62",
      role: "Khách hàng",
      email: "khoi.minh@example.com",
      phone: "0999 777 888",
      source: "TPBank",
      address: "TP. Hà Nội",
    },
    customerId: "CUST002",
    biz: { id: "#BIZ005", tags: ["Enterprise", "TPBank"] },
    assignee: { name: "Phạm Thanh Sơn", avatar: "https://i.pravatar.cc/100?img=12", role: "Manager" },
    assigneeId: "USER003",
    stage: "Đã xác nhận",
    tags: ["#Paid"],
    plan: { name: "ENTERPRISE", cycle: "Thanh toán theo năm", price: "19.990.000 đ", daysLeft: 365, expiryDate: "17/04/2027" },
    services: [{ name: "Zalo OA Integration", active: true }, { name: "Livechat Support", active: true }],
    quotas: [{ name: "Truy cập User", used: 12, total: 50, color: "blue" }],
    timeline: [
      { type: "event", title: "Xác nhận thanh toán thành công qua TPBank", time: fmt(now), content: null, duration: null, createdBy: "System" },
    ],
  },
  {
    id: "EVT010",
    name: "Thanh toán chuyển khoản mới",
    sub: "Đơn hàng #DH2026-002",
    group: "chuyen_khoan",
    customer: {
      name: "Bảo Quốc",
      avatar: "https://i.pravatar.cc/100?img=33",
      role: "Khách hàng",
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
    tags: ["#WaitingConfirm"],
    plan: { name: "PREMIUM", cycle: "Thanh toán theo tháng", price: "2.990.000 đ", daysLeft: 30, expiryDate: "17/05/2026" },
    services: [{ name: "Livechat Support", active: true }],
    quotas: [{ name: "Truy cập User", used: 3, total: 10, color: "blue" }],
    timeline: [
      { type: "event", title: "Nhận thanh toán chuyển khoản qua VCB", time: fmt(now), content: null, duration: null, createdBy: "System" },
    ],
  },
];

// ─── ActionChain mới — Chuỗi dài 5 bước ─────────────────────────────────────
// Bổ sung vào mảng actionChains hiện có
actionChains.push({
  id: "CHAIN004",
  name: "Chuyển đổi Trial → Trả phí",
  description:
    "Chuỗi 5 bước chuyển đổi khách hàng từ gói Trial sang gói trả phí: " +
    "gửi tài liệu → gọi tư vấn → gọi chốt deal → tạo đơn hàng → xác nhận thanh toán.",
  delay: "1d", // Bắt đầu 1 ngày sau khi sự kiện kích hoạt
  active: true,
  steps: [
    // ── Bước 1: Gửi tài liệu & proposal ──────────────────────────────────
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
    // ── Bước 2: Gọi điện lần 1 ───────────────────────────────────────────
    {
      order: 2,
      actionId: "ACT001", // Gọi điện lần 1
      branches: [
        {
          resultId:     "RES009", // Hứng thú - cần demo
          order:        1,
          nextStepType: "next_in_chain",
          nextActionId: "ACT010", // → Gọi chốt deal
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
    // ── Bước 3: Gọi điện lần 2 (dự phòng) ───────────────────────────────
    {
      order: 3,
      actionId: "ACT002", // Gọi điện lần 2
      branches: [
        {
          resultId:     "RES001", // Đã liên hệ & quan tâm
          order:        1,
          nextStepType: "next_in_chain",
          nextActionId: "ACT010", // → Gọi chốt deal
          closeOutcome: null,
          delayUnit:    "day",
          delayValue:   1,
        },
        {
          resultId:     "RES002", // Không bắt máy (lần 2)
          order:        2,
          nextStepType: "close_task",
          nextActionId: null,
          closeOutcome: "failure",
          delayUnit:    null,
          delayValue:   null,
        },
        {
          resultId:     "RES003", // Hẹn gọi lại
          order:        3,
          nextStepType: "next_in_chain",
          nextActionId: "ACT010",
          closeOutcome: null,
          delayUnit:    "day",
          delayValue:   3,
        },
      ],
    },
    // ── Bước 4: Gọi chốt deal ────────────────────────────────────────────
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
    // ── Bước 5: Tạo đơn hàng & xác nhận ─────────────────────────────────
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
});

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
