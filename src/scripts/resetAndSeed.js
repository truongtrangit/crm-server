/**
 * resetAndSeed.js — Xoá toàn bộ data và seed lại từ đầu
 *
 * Chạy: node src/scripts/resetAndSeed.js
 *
 * ⚠️  CẢNH BÁO: script này XOÁ HOÀN TOÀN tất cả collections trước khi seed.
 *     CHỈ dùng trong môi trường DEV.
 */

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const mongoose = require("mongoose");

// ─── Models ───
const Customer = require("../modules/customer/customer/customer.model.js");

const Event = require("../modules/event/event/event.model.js");
const Organization = require("../modules/hr/organization/organization.model.js");
const User = require("../modules/system/user/user.model.js");
const StaffFunction = require("../modules/hr/function/staffFunction.model.js");

const Action = require("../modules/event/actionConfig/action.model.js");
const Result = require("../modules/system/metadata/result.model.js");
const Reason = require("../modules/system/metadata/reason.model.js");
const ActionChain = require("../modules/event/eventActionChain/actionChain.model.js");
const EventActionChain = require("../modules/event/eventActionChain/eventActionChain.model.js");
const Role = require("../modules/system/rbac/role.model.js");
const Counter = require("../core/models/Counter");

const Permission = require("../modules/system/rbac/permission.model.js");
const Lead = require("../modules/lead/lead/lead.model.js");
const LeadStatus = require("../modules/lead/leadConfig/leadStatus.model.js");
const LeadStatusGroup = require("../modules/lead/leadConfig/leadStatusGroup.model.js");
const Funnel = require("../modules/lead/funnel/funnel.model.js");
const FunnelFolder = require("../modules/lead/funnel/funnelFolder.model.js");
const FunnelGroup = require("../modules/lead/funnel/funnelGroup.model.js");
const AutomationLog = require("../modules/system/log/automationLog.model.js");
const WebhookLog = require("../modules/system/webhook/webhookLog.model.js");
const SystemLog = require("../modules/system/log/systemLog.model.js");
const BlockAutomation = require("../modules/event/eventActionChain/blockAutomation.model.js");
const MetaConfig = require("../modules/system/meta/metaConfig.model.js");
const MetaProgram = require("../modules/system/meta/metaProgram.model.js");
const Subscription = require("../modules/hr/company/subscription.model.js");
const Task = require("../modules/job/task/task.model.js");

// ─── Seed helpers ───
const seedData = require("../core/constants/seedData");
const { hashPassword } = require("../core/utils/auth");
const { seedRbac } = require("../core/services/rbacSeed.js");
const { seedSystemFunnel } = require("./seedSystemFunnel");
const {
  buildDepartmentAlias,
  buildGroupAlias,
  buildOrganizationDirectory,
  resolveDepartmentReference,
  resolveGroupReference,
} = require("../core/utils/organization");

const MODELS_TO_RESET = [
  { model: EventActionChain, name: "EventActionChain" },
  { model: Event, name: "Event" },
  { model: Customer, name: "Customer" },

  { model: ActionChain, name: "ActionChain" },
  { model: Action, name: "Action" },
  { model: Result, name: "Result" },
  { model: Reason, name: "Reason" },
  { model: StaffFunction, name: "StaffFunction" },
  { model: Organization, name: "Organization" },
  { model: User, name: "User" },
  { model: Role, name: "Role" },
  { model: Counter, name: "Counter" },

  { model: Permission, name: "Permission" },
  { model: Lead, name: "Lead" },
  { model: LeadStatus, name: "LeadStatus" },
  { model: LeadStatusGroup, name: "LeadStatusGroup" },
  { model: Funnel, name: "Funnel" },
  { model: FunnelFolder, name: "FunnelFolder" },
  { model: FunnelGroup, name: "FunnelGroup" },
  { model: AutomationLog, name: "AutomationLog" },
  { model: WebhookLog, name: "WebhookLog" },
  { model: SystemLog, name: "SystemLog" },
  { model: BlockAutomation, name: "BlockAutomation" },
  { model: MetaConfig, name: "MetaConfig" },
  { model: MetaProgram, name: "MetaProgram" },
  { model: Subscription, name: "Subscription" },
  { model: Task, name: "Task" },
];

async function dropAll() {
  console.log("\n🗑  Dropping all collections...");
  for (const { model, name } of MODELS_TO_RESET) {
    try {
      // Use deleteMany with _includeDeleted for soft-delete models
      if (model.findWithDeleted) {
        await model.deleteMany({}).setOptions({ _includeDeleted: true });
      } else {
        await model.deleteMany({});
      }
      console.log(`   ✓ Cleared: ${name}`);
    } catch (e) {
      console.warn(`   ⚠ Could not clear ${name}: ${e.message}`);
    }
  }
}

/**
 * Seed Counter collection based on max IDs found in seed data.
 * This ensures new IDs continue from where seed data left off.
 */
async function seedCounters() {
  const counterSeeds = [
    { _id: "USER", seq: seedData.users.length },
    { _id: "CUST", seq: seedData.customers.length },
    { _id: "EVT", seq: seedData.events.length },
    { _id: "RES", seq: seedData.results.length },
    { _id: "RSN", seq: seedData.reasons.length },
    { _id: "ACT", seq: seedData.actions.length },
    { _id: "CHN", seq: seedData.actionChains.length },
    { _id: "FUNC", seq: seedData.staffFunctions.length },
  ];

  await Counter.insertMany(counterSeeds);
  console.log(`   ✓ Seeded ${counterSeeds.length} counters`);
}

async function seedOrganizations() {
  for (const org of seedData.organizations) {
    const alias = buildDepartmentAlias(org.parent);
    const children = org.children.map((child) => ({
      ...child,
      alias: buildGroupAlias(alias, child.name),
    }));
    await Organization.create({ ...org, alias, children });
  }
  console.log(`   ✓ Seeded ${seedData.organizations.length} organizations`);
}

async function seedUsers() {
  const organizations = await Organization.find(
    {},
    { id: 1, alias: 1, parent: 1, children: 1 },
  ).lean();
  const directory = buildOrganizationDirectory(organizations);

  const items = await Promise.all(
    seedData.users.map(async (item) => {
      const resolvedDepts = (item.department || [])
        .map((d) => resolveDepartmentReference(directory, d))
        .filter(Boolean);
      const resolvedGroups = (item.group || [])
        .map((g) => resolveGroupReference(directory, g))
        .filter(Boolean);

      const staffFunctions = seedData.staffFunctions || [];

      const functions = [];
      const departments = [];
      const groups = [];

      resolvedDepts.forEach((dept) => {
        const matchingFunc = staffFunctions.find(
          (f) =>
            dept.alias.toLowerCase().includes(f.type.toLowerCase()) ||
            (f.type === "tech" &&
              dept.alias.toLowerCase().includes("ky-thuat")),
        );
        const functionId = matchingFunc ? matchingFunc.id : "FUNC1";
        if (!functions.includes(functionId)) {
          functions.push(functionId);
        }

        departments.push({
          deptAlias: dept.alias,
          role: item.role === "MANAGER" ? "lead" : "member",
        });
      });

      resolvedGroups.forEach((g) => {
        groups.push({
          groupAlias: g.alias,
          role: item.role === "MANAGER" ? "lead" : "member",
        });
      });

      return {
        ...item,
        email: String(item.email).trim().toLowerCase(),
        roleId: String(item.role || "STAFF")
          .trim()
          .toLowerCase(),
        passwordHash: await hashPassword(item.password),
        password: undefined,
        sessions: [],
        lastLoginAt: null,
        createdBy: null,
        functions,
        departments,
        groups,
      };
    }),
  );

  await User.insertMany(items.map(({ password, role, ...rest }) => rest));
  console.log(`   ✓ Seeded ${items.length} users`);
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("❌  MONGO_URI not found in .env");
    process.exit(1);
  }

  console.log("🔌  Connecting to MongoDB...");
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  console.log(`   Connected: ${mongoose.connection.host}`);

  // ── 1. Drop all ──────────────────────────────────────────
  await dropAll();

  // ── 2. Seed in dependency order ──────────────────────────
  console.log("\n🌱  Seeding fresh data...");

  await seedCounters();
  await seedOrganizations();
  await seedUsers();

  await Result.insertMany(seedData.results);
  console.log(`   ✓ Seeded ${seedData.results.length} results`);

  await Reason.insertMany(seedData.reasons);
  console.log(`   ✓ Seeded ${seedData.reasons.length} reasons`);

  await Action.insertMany(seedData.actions);
  console.log(`   ✓ Seeded ${seedData.actions.length} actions`);

  await ActionChain.insertMany(seedData.actionChains);
  console.log(`   ✓ Seeded ${seedData.actionChains.length} action chains`);

  await Customer.insertMany(seedData.customers);
  console.log(`   ✓ Seeded ${seedData.customers.length} customers`);

  // Enrich event assignee snapshots with department/group from the seeded users
  const seededUsers = await User.find(
    {},
    { id: 1, name: 1, avatar: 1, department: 1, group: 1, roleId: 1 },
  ).lean();
  const userMap = Object.fromEntries(seededUsers.map((u) => [u.id, u]));

  const enrichedEvents = seedData.events.map((evt) => {
    if (!evt.assigneeId) return evt;
    const u = userMap[evt.assigneeId];
    if (!u) return evt;
    return {
      ...evt,
      assignee: {
        ...(evt.assignee || {}),
        name: u.name || evt.assignee?.name || "",
        avatar: u.avatar || evt.assignee?.avatar || "",
        department: u.department || [],
        group: u.group || [],
      },
    };
  });

  await Event.insertMany(enrichedEvents);
  console.log(`   ✓ Seeded ${enrichedEvents.length} events`);

  await StaffFunction.insertMany(seedData.staffFunctions);
  console.log(`   ✓ Seeded ${seedData.staffFunctions.length} staff functions`);

  // ── 3. Seed RBAC roles ──────────────────────────────────
  await seedRbac();
  console.log("   ✓ RBAC roles seeded");

  // ── 4. Seed system funnel ───────────────────────────────
  await seedSystemFunnel();
  console.log("   ✓ System funnel seeded");

  // ── 5. Seed Meta configurations and programs ──────────
  const configsData = [
    {
      id: "MDF",
      name: "MDF",
      badgeColor: "#4338ca",
      icon: "fa-solid fa-bullseye",
      kpiType: "metric",
      metrics: [{ name: "Doanh thu", unit: "$" }],
      description: "Tăng trưởng doanh thu thông qua các chiến dịch Meta Ads",
      order: 1,
    },
    {
      id: "Whatsapp",
      name: "Whatsapp",
      badgeColor: "#047857",
      icon: "fa-brands fa-whatsapp",
      kpiType: "metric",
      metrics: [
        { name: "Page", unit: "Page" },
        { name: "Tin nhắn", unit: "Tin nhắn" },
      ],
      description: "Tích hợp Chatbot & CSKH qua Whatsapp Business API",
      order: 2,
    },
    {
      id: "PDF",
      name: "PDF",
      badgeColor: "#15803d",
      icon: "fa-solid fa-chart-line",
      kpiType: "metric",
      metrics: [{ name: "Đơn hàng", unit: "Đơn" }],
      description: "Chiến dịch tối ưu CPO (Cost Per Order)",
      order: 3,
    },
    {
      id: "CTX",
      name: "CTX",
      badgeColor: "#be185d",
      icon: "fa-solid fa-comments",
      kpiType: "metric",
      metrics: [{ name: "Chi phí", unit: "$" }],
      description: "Chiến dịch Click-to-Messenger tối ưu tương tác",
      order: 4,
    },
    {
      id: "FMM",
      name: "FMM",
      badgeColor: "#b45309",
      icon: "fa-solid fa-bullhorn",
      kpiType: "task",
      metrics: [],
      description: "Fanpage Marketing Management - quản lý nội dung",
      order: 5,
    },
  ];

  await MetaConfig.insertMany(configsData);
  console.log(`   ✓ Seeded ${configsData.length} Meta configs`);

  const programsData = [
    {
      id: "PROG-001",
      name: "Tăng trưởng doanh thu Q1",
      typeId: "MDF",
      budgetType: "fixed",
      budget: 50000,
      startDate: new Date("2025-01-01"),
      endDate: new Date("2025-03-31"),
      picIds: ["USER4"],
      descriptionHtml:
        "<p>Tối ưu hóa các chiến dịch chuyển đổi trên Meta Ads để đạt mục tiêu doanh thu đề ra. Bao gồm:</p><ul><li>Tối ưu CPA cho các campaign conversion</li><li>A/B testing creative sets hàng tuần</li><li>Retargeting audience cũ với dynamic ads</li></ul>",
      kpiTargets: [
        { metricName: "Doanh thu", unit: "$", target: 50000, current: 45000 },
      ],
      progressPercent: 90,
      tasks: [
        {
          title: "Setup Meta Business Suite",
          picId: "USER4",
          picName: "Vũ Thu Phương",
          deadline: new Date("2025-01-10"),
          isCompleted: true,
          completedAt: new Date("2025-01-08"),
        },
        {
          title: "Chạy A/B test creative tháng 1",
          picId: "USER4",
          picName: "Vũ Thu Phương",
          deadline: new Date("2025-01-31"),
          isCompleted: true,
          completedAt: new Date("2025-01-28"),
        },
        {
          title: "Báo cáo mid-term Q1",
          picId: "USER4",
          picName: "Vũ Thu Phương",
          deadline: new Date("2025-02-15"),
          isCompleted: true,
          completedAt: new Date("2025-02-14"),
        },
        {
          title: "Tối ưu retargeting campaign",
          picId: "USER4",
          picName: "Vũ Thu Phương",
          deadline: new Date("2025-03-15"),
          isCompleted: true,
          completedAt: new Date("2025-03-12"),
        },
        {
          title: "Tổng kết Q1 & báo cáo cuối kỳ",
          picId: "USER4",
          picName: "Vũ Thu Phương",
          deadline: new Date("2025-03-31"),
          isCompleted: false,
          completedAt: null,
        },
      ],
      milestones: [
        {
          metricName: "Doanh thu",
          valueAdded: 15000,
          totalCurrent: 15000,
          note: "Doanh thu tháng 1 từ conversion campaigns",
          createdBy: "Vũ Thu Phương",
        },
        {
          metricName: "Doanh thu",
          valueAdded: 18000,
          totalCurrent: 33000,
          note: "Tháng 2 - tăng mạnh nhờ retargeting",
          createdBy: "Vũ Thu Phương",
        },
        {
          metricName: "Doanh thu",
          valueAdded: 12000,
          totalCurrent: 45000,
          note: "Tháng 3 - giai đoạn cuối Q1",
          createdBy: "System",
        },
      ],
      attachments: [
        {
          fileName: "Báo cáo Q1 - Meta Ads Performance",
          url: "https://docs.google.com/spreadsheets/d/example1",
          createdBy: "Vũ Thu Phương",
        },
        {
          fileName: "Creative Guidelines v2.0",
          url: "https://drive.google.com/file/d/example2",
          createdBy: "Vũ Thu Phương",
        },
      ],
    },
    {
      id: "PROG-002",
      name: "Tích hợp Chatbot Whatsapp",
      typeId: "Whatsapp",
      budgetType: "fixed",
      budget: 10000,
      startDate: new Date("2025-02-15"),
      endDate: new Date("2025-06-30"),
      picIds: ["USER5"],
      descriptionHtml:
        "<p>Triển khai CSKH tự động qua Whatsapp API cho 10 khách hàng Enterprise.</p><ul><li>Tích hợp Whatsapp Cloud API</li><li>Xây dựng flow chatbot tự động cho CSKH</li><li>Dashboard theo dõi tin nhắn real-time</li></ul>",
      kpiTargets: [
        { metricName: "Page", unit: "Page", target: 100, current: 20 },
        {
          metricName: "Tin nhắn",
          unit: "Tin nhắn",
          target: 1000000,
          current: 500000,
        },
      ],
      progressPercent: 35,
      tasks: [
        {
          title: "Đăng ký Whatsapp Business API",
          picId: "USER5",
          picName: "Lê Văn Hùng",
          deadline: new Date("2025-02-28"),
          isCompleted: true,
          completedAt: new Date("2025-02-25"),
        },
        {
          title: "Setup webhook & server endpoint",
          picId: "USER5",
          picName: "Lê Văn Hùng",
          deadline: new Date("2025-03-15"),
          isCompleted: true,
          completedAt: new Date("2025-03-10"),
        },
        {
          title: "Xây dựng chatbot flow cơ bản",
          picId: "USER5",
          picName: "Lê Văn Hùng",
          deadline: new Date("2025-04-15"),
          isCompleted: false,
          completedAt: null,
        },
        {
          title: "Triển khai cho 5 khách hàng pilot",
          picId: "USER5",
          picName: "Lê Văn Hùng",
          deadline: new Date("2025-05-15"),
          isCompleted: false,
          completedAt: null,
        },
        {
          title: "Mở rộng đến 10 khách hàng",
          picId: "USER5",
          picName: "Lê Văn Hùng",
          deadline: new Date("2025-06-15"),
          isCompleted: false,
          completedAt: null,
        },
      ],
      milestones: [
        {
          metricName: "Page",
          valueAdded: 20,
          totalCurrent: 20,
          note: "Onboard 20 page đầu tiên",
          createdBy: "Lê Văn Hùng",
        },
        {
          metricName: "Tin nhắn",
          valueAdded: 500000,
          totalCurrent: 500000,
          note: "500k tin nhắn xử lý tự động",
          createdBy: "System",
        },
      ],
      attachments: [
        {
          fileName: "Whatsapp API Documentation",
          url: "https://developers.facebook.com/docs/whatsapp",
          createdBy: "Lê Văn Hùng",
        },
        {
          fileName: "Chatbot Flow Diagram",
          url: "https://miro.com/app/board/example",
          createdBy: "Lê Văn Hùng",
        },
        {
          fileName: "Danh sách khách hàng Enterprise",
          url: "https://docs.google.com/sheets/d/example3",
          createdBy: "System",
        },
      ],
    },
    {
      id: "PROG-003",
      name: "Chiến dịch CPO Q2",
      typeId: "PDF",
      budgetType: "fixed",
      budget: 10000,
      startDate: new Date("2025-04-01"),
      endDate: new Date("2025-06-30"),
      picIds: ["USER7"],
      descriptionHtml:
        "<p>Tài trợ đối tác giảm giá vốn để tối đa hóa số đơn hàng mới.</p><ul><li>Tối ưu CPO xuống dưới $1 / đơn</li><li>Scale campaign khi đạt CPO target</li><li>Partnership discount program</li></ul>",
      kpiTargets: [
        { metricName: "Đơn hàng", unit: "Đơn", target: 10000, current: 2500 },
      ],
      progressPercent: 25,
      tasks: [
        {
          title: "Phân tích dữ liệu đơn hàng Q1",
          picId: "USER7",
          picName: "Trần Đức Anh",
          deadline: new Date("2025-04-10"),
          isCompleted: true,
          completedAt: new Date("2025-04-09"),
        },
        {
          title: "Setup tracking & attribution",
          picId: "USER7",
          picName: "Trần Đức Anh",
          deadline: new Date("2025-04-20"),
          isCompleted: true,
          completedAt: new Date("2025-04-18"),
        },
        {
          title: "Launch campaign phase 1",
          picId: "USER7",
          picName: "Trần Đức Anh",
          deadline: new Date("2025-05-01"),
          isCompleted: false,
          completedAt: null,
        },
        {
          title: "Scale budget nếu CPO < $1",
          picId: "USER7",
          picName: "Trần Đức Anh",
          deadline: new Date("2025-05-30"),
          isCompleted: false,
          completedAt: null,
        },
      ],
      milestones: [
        {
          metricName: "Đơn hàng",
          valueAdded: 2500,
          totalCurrent: 2500,
          note: "Đạt 2500 đơn hàng sau 2 tuần chạy",
          createdBy: "Trần Đức Anh",
        },
      ],
      attachments: [
        {
          fileName: "CPO Analysis Report",
          url: "https://docs.google.com/document/d/example4",
          createdBy: "Trần Đức Anh",
        },
      ],
    },
    {
      id: "PROG-004",
      name: "Click-to-Messenger Campaign",
      typeId: "CTX",
      budgetType: "fixed",
      budget: 20000,
      startDate: new Date("2025-03-01"),
      endDate: new Date("2025-05-30"),
      picIds: ["USER8"],
      descriptionHtml:
        "<p>Thúc đẩy tương tác khách hàng qua quảng cáo Click-to-Messenger, tối ưu chi phí tin nhắn.</p><ul><li>Target audience từ Lookalike đã mua hàng</li><li>Automated Messenger response flow</li><li>Tích hợp CRM để track conversion</li></ul>",
      kpiTargets: [
        { metricName: "Chi phí", unit: "$", target: 20000, current: 12000 },
      ],
      progressPercent: 60,
      tasks: [
        {
          title: "Tạo Lookalike Audience",
          picId: "USER8",
          picName: "Hoàng Diệu Linh",
          deadline: new Date("2025-03-10"),
          isCompleted: true,
          completedAt: new Date("2025-03-08"),
        },
        {
          title: "Setup Messenger auto-reply",
          picId: "USER8",
          picName: "Hoàng Diệu Linh",
          deadline: new Date("2025-03-20"),
          isCompleted: true,
          completedAt: new Date("2025-03-18"),
        },
        {
          title: "Launch CTX campaign",
          picId: "USER8",
          picName: "Hoàng Diệu Linh",
          deadline: new Date("2025-04-01"),
          isCompleted: true,
          completedAt: new Date("2025-03-30"),
        },
        {
          title: "Tích hợp tracking vào CRM",
          picId: "USER8",
          picName: "Hoàng Diệu Linh",
          deadline: new Date("2025-04-15"),
          isCompleted: false,
          completedAt: null,
        },
        {
          title: "Báo cáo tổng kết chiến dịch",
          picId: "USER8",
          picName: "Hoàng Diệu Linh",
          deadline: new Date("2025-05-25"),
          isCompleted: false,
          completedAt: null,
        },
      ],
      milestones: [
        {
          metricName: "Chi phí",
          valueAdded: 5000,
          totalCurrent: 5000,
          note: "Chi tháng 3 - phase khởi chạy",
          createdBy: "Hoàng Diệu Linh",
        },
        {
          metricName: "Chi phí",
          valueAdded: 7000,
          totalCurrent: 12000,
          note: "Chi tháng 4 - đang scale tốt",
          createdBy: "System",
        },
      ],
      attachments: [
        {
          fileName: "Messenger Flow Blueprint",
          url: "https://drive.google.com/file/d/example5",
          createdBy: "Hoàng Diệu Linh",
        },
        {
          fileName: "CTX Performance Dashboard",
          url: "https://datastudio.google.com/example6",
          createdBy: "Hoàng Diệu Linh",
        },
        {
          fileName: "Audience Segment Report",
          url: "https://docs.google.com/sheets/d/example7",
          createdBy: "System",
        },
      ],
    },
  ];

  await MetaProgram.insertMany(programsData);
  console.log(`   ✓ Seeded ${programsData.length} Meta programs`);

  console.log("\n✅  Reset & seed completed successfully!\n");

  await mongoose.connection.close();
  process.exit(0);
}

main().catch((err) => {
  console.error("❌  Reset failed:", err.message);
  mongoose.connection.close().then(() => process.exit(1));
});
