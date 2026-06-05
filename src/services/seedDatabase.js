const Customer = require("../models/Customer");

const Event = require("../models/Event");
const Organization = require("../models/Organization");
const User = require("../models/User");
const StaffFunction = require("../models/StaffFunction");

const Action = require("../models/Action");
const Result = require("../models/Result");
const Reason = require("../models/Reason");
const ActionChain = require("../models/ActionChain");
const Counter = require("../models/Counter");
const MetaConfig = require("../models/MetaConfig");
const MetaProgram = require("../models/MetaProgram");
const seedData = require("../constants/seedData");
const { hashPassword } = require("../utils/auth");
const { seedSystemFunnel } = require("../scripts/seedSystemFunnel");
const {
  buildDepartmentAlias,
  buildGroupAlias,
  buildOrganizationDirectory,
  resolveDepartmentReference,
  resolveGroupReference,
} = require("../utils/organization");

async function seedCollection(Model, items, label) {
  const count = await Model.countDocuments();

  if (count > 0) {
    return;
  }

  await Model.insertMany(items);
  console.log(`Seeded ${items.length} ${label}`);
}

async function seedUsers() {
  const existingUsers = await User.find({}).select({ id: 1, email: 1 }).lean();
  const existingIds = new Set(existingUsers.map((item) => item.id));
  const existingEmails = new Set(
    existingUsers
      .map((item) =>
        String(item.email || "")
          .trim()
          .toLowerCase(),
      )
      .filter(Boolean),
  );

  const missingSeedUsers = seedData.users.filter(
    (item) =>
      !existingIds.has(item.id) &&
      !existingEmails.has(String(item.email).trim().toLowerCase()),
  );

  if (missingSeedUsers.length === 0) {
    return;
  }

  const organizations = await Organization.find({}, { id: 1, alias: 1, parent: 1, children: 1 }).lean();
  const directory = buildOrganizationDirectory(organizations);

  const items = await Promise.all(
    missingSeedUsers.map(async (item) => {
      const resolvedDepts = (item.department || [])
        .map((d) => resolveDepartmentReference(directory, d))
        .filter(Boolean);
      const resolvedGroups = (item.group || [])
        .map((g) => resolveGroupReference(directory, g))
        .filter(Boolean);

      const deptToFuncMap = {
        "phong-marketing": "FUNC1",
        "phong-sale": "FUNC2",
        "phong-ky-thuat": "FUNC3",
        "phong-cskh": "FUNC4"
      };

      const functions = [];
      const departments = [];
      const groups = [];

      resolvedDepts.forEach(dept => {
        const functionId = deptToFuncMap[dept.alias] || "FUNC1";
        if (!functions.includes(functionId)) {
          functions.push(functionId);
        }
        departments.push({
          deptAlias: dept.alias,
          role: item.role === "MANAGER" ? "lead" : "member"
        });
      });

      resolvedGroups.forEach(grp => {
        groups.push({
          groupAlias: grp.alias,
          role: item.role === "MANAGER" ? "lead" : "member"
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
    })
  );

  await User.insertMany(items.map(({ password, role, ...item }) => item));
  console.log(`Seeded ${items.length} users`);
}

async function syncOrganizationAliases() {
  const organizations = await Organization.find();
  let updated = 0;

  for (const organization of organizations) {
    const nextAlias =
      organization.alias || buildDepartmentAlias(organization.parent);
    let changed = organization.alias !== nextAlias;

    organization.alias = nextAlias;
    organization.children = organization.children.map((child) => {
      const nextChildAlias =
        child.alias || buildGroupAlias(nextAlias, child.name);

      if (child.alias !== nextChildAlias) {
        changed = true;
      }

      return {
        ...child.toObject(),
        alias: nextChildAlias,
      };
    });

    if (changed) {
      await organization.save();
      updated += 1;
    }
  }

  if (updated > 0) {
    console.log(`Synced ${updated} organizations with aliases`);
  }
}

async function syncUserOrganizationReferences() {
  const organizations = await Organization.find(
    {},
    { id: 1, alias: 1, parent: 1, children: 1 },
  ).lean();
  const directory = buildOrganizationDirectory(organizations);
  const users = await User.find();
  let updated = 0;

  for (const user of users) {
    if (Array.isArray(user.departments) && user.departments.length > 0) {
      continue;
    }

    const legacyDept = user.toObject().department || [];
    const legacyGroup = user.toObject().group || [];

    if (legacyDept.length > 0 || legacyGroup.length > 0) {
      const resolvedDepts = legacyDept
        .map((item) => resolveDepartmentReference(directory, item))
        .filter(Boolean);
      const resolvedGroups = legacyGroup
        .map((item) => resolveGroupReference(directory, item))
        .filter(Boolean);

      const deptToFuncMap = {
        "phong-marketing": "FUNC1",
        "phong-sale": "FUNC2",
        "phong-ky-thuat": "FUNC3",
        "phong-cskh": "FUNC4"
      };

      const functions = [];
      const departments = [];
      const groups = [];

      resolvedDepts.forEach(dept => {
        const functionId = deptToFuncMap[dept.alias] || "FUNC1";
        if (!functions.includes(functionId)) {
          functions.push(functionId);
        }
        departments.push({ deptAlias: dept.alias, role: user.roleId === "manager" ? "lead" : "member" });
      });

      resolvedGroups.forEach(g => {
        groups.push({ groupAlias: g.alias, role: user.roleId === "manager" ? "lead" : "member" });
      });

      user.functions = functions;
      user.departments = departments;
      user.groups = groups;
      await user.save();
      updated += 1;
    }
  }

  if (updated > 0) {
    console.log(`Synced ${updated} users to decoupled structure`);
  }
}

async function seedDatabase() {
  await seedCollection(Organization, seedData.organizations, "organization items");
  await syncOrganizationAliases();
  await seedUsers();
  await syncUserOrganizationReferences();
  await seedCollection(Customer, seedData.customers, "customers");

  await seedCollection(Event, seedData.events, "events");
  await seedCollection(StaffFunction, seedData.staffFunctions, "staff functions");

  // ── Action config — thứ tự: Reason → Result → Action → ActionChain ──────
  await seedCollection(Reason, seedData.reasons, "reasons");
  await seedCollection(Result, seedData.results, "results");
  await seedCollection(Action, seedData.actions, "actions");
  await seedCollection(ActionChain, seedData.actionChains, "action chains");

  // Seed counters if not present (ensures monotonic IDs start correctly)
  await seedCounters();

  // Seed system funnel (idempotent)
  await seedSystemFunnel();

  // Seed Job Task Type system defaults
  const JobConfigTaskType = require("../models/JobConfigTaskType");
  const jobTaskTypeCount = await JobConfigTaskType.countDocuments();
  if (jobTaskTypeCount === 0) {
    const defaultTaskType = {
      id: "JTT1",
      name: "Marketing",
      description: "Loại công việc mặc định của hệ thống",
      icon: "fa-solid fa-bullhorn",
      color: "#be185d",
      isSystem: true,
    };
    await JobConfigTaskType.create(defaultTaskType);
    console.log(`Seeded 1 system Job Task Type`);
    
    const existingJTT = await Counter.findById("JTT");
    if (!existingJTT) {
      await Counter.create({ _id: "JTT", seq: 1 });
    }
  }

  // Seed Meta configurations and programs if they are empty
  const metaConfigCount = await MetaConfig.countDocuments();
  if (metaConfigCount === 0) {
    const configsData = [
      {
        id: 'MDF',
        name: 'MDF',
        badgeColor: '#4338ca',
        icon: 'fa-solid fa-bullseye',
        kpiType: 'metric',
        metrics: [{ name: 'Doanh thu', unit: '$' }],
        description: 'Tăng trưởng doanh thu thông qua các chiến dịch Meta Ads',
        order: 1,
      },
      {
        id: 'Whatsapp',
        name: 'Whatsapp',
        badgeColor: '#047857',
        icon: 'fa-brands fa-whatsapp',
        kpiType: 'metric',
        metrics: [{ name: 'Page', unit: 'Page' }, { name: 'Tin nhắn', unit: 'Tin nhắn' }],
        description: 'Tích hợp Chatbot & CSKH qua Whatsapp Business API',
        order: 2,
      },
      {
        id: 'PDF',
        name: 'PDF',
        badgeColor: '#15803d',
        icon: 'fa-solid fa-chart-line',
        kpiType: 'metric',
        metrics: [{ name: 'Đơn hàng', unit: 'Đơn' }],
        description: 'Chiến dịch tối ưu CPO (Cost Per Order)',
        order: 3,
      },
      {
        id: 'CTX',
        name: 'CTX',
        badgeColor: '#be185d',
        icon: 'fa-solid fa-comments',
        kpiType: 'metric',
        metrics: [{ name: 'Chi phí', unit: '$' }],
        description: 'Chiến dịch Click-to-Messenger tối ưu tương tác',
        order: 4,
      },
      {
        id: 'FMM',
        name: 'FMM',
        badgeColor: '#b45309',
        icon: 'fa-solid fa-bullhorn',
        kpiType: 'task',
        metrics: [],
        description: 'Fanpage Marketing Management - quản lý nội dung',
        order: 5,
      }
    ];
    await MetaConfig.insertMany(configsData);
    console.log(`Seeded ${configsData.length} Meta configs`);
  }

  const metaProgramCount = await MetaProgram.countDocuments();
  if (metaProgramCount === 0) {
    const programsData = [
      {
        id: 'PROG-001',
        name: 'Tăng trưởng doanh thu Q1',
        typeId: 'MDF',
        budgetType: 'fixed',
        budget: 50000,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-03-31'),
        picIds: ['USER4'],
        descriptionHtml: '<p>Tối ưu hóa các chiến dịch chuyển đổi trên Meta Ads để đạt mục tiêu doanh thu đề ra. Bao gồm:</p><ul><li>Tối ưu CPA cho các campaign conversion</li><li>A/B testing creative sets hàng tuần</li><li>Retargeting audience cũ với dynamic ads</li></ul>',
        kpiTargets: [
          { metricName: 'Doanh thu', unit: '$', target: 50000, current: 45000 }
        ],
        progressPercent: 90,
        tasks: [
          { title: 'Setup Meta Business Suite', picId: 'USER4', picName: 'Vũ Thu Phương', deadline: new Date('2026-01-10'), isCompleted: true, completedAt: new Date('2026-01-08') },
          { title: 'Chạy A/B test creative tháng 1', picId: 'USER4', picName: 'Vũ Thu Phương', deadline: new Date('2026-01-31'), isCompleted: true, completedAt: new Date('2026-01-28') },
          { title: 'Báo cáo mid-term Q1', picId: 'USER4', picName: 'Vũ Thu Phương', deadline: new Date('2026-02-15'), isCompleted: true, completedAt: new Date('2026-02-14') },
          { title: 'Tối ưu retargeting campaign', picId: 'USER4', picName: 'Vũ Thu Phương', deadline: new Date('2026-03-15'), isCompleted: true, completedAt: new Date('2026-03-12') },
          { title: 'Tổng kết Q1 & báo cáo cuối kỳ', picId: 'USER4', picName: 'Vũ Thu Phương', deadline: new Date('2026-03-31'), isCompleted: false, completedAt: null },
        ],
        milestones: [
          { metricName: 'Doanh thu', valueAdded: 15000, totalCurrent: 15000, note: 'Doanh thu tháng 1 từ conversion campaigns', createdBy: 'Vũ Thu Phương' },
          { metricName: 'Doanh thu', valueAdded: 18000, totalCurrent: 33000, note: 'Tháng 2 - tăng mạnh nhờ retargeting', createdBy: 'Vũ Thu Phương' },
          { metricName: 'Doanh thu', valueAdded: 12000, totalCurrent: 45000, note: 'Tháng 3 - giai đoạn cuối Q1', createdBy: 'System' },
        ],
        attachments: [
          { fileName: 'Báo cáo Q1 - Meta Ads Performance', url: 'https://docs.google.com/spreadsheets/d/example1', createdBy: 'Vũ Thu Phương' },
          { fileName: 'Creative Guidelines v2.0', url: 'https://drive.google.com/file/d/example2', createdBy: 'Vũ Thu Phương' },
        ]
      },
      {
        id: 'PROG-002',
        name: 'Tích hợp Chatbot Whatsapp',
        typeId: 'Whatsapp',
        budgetType: 'fixed',
        budget: 10000,
        startDate: new Date('2026-02-15'),
        endDate: new Date('2026-06-30'),
        picIds: ['USER5'],
        descriptionHtml: '<p>Triển khai CSKH tự động qua Whatsapp API cho 10 khách hàng Enterprise.</p><ul><li>Tích hợp Whatsapp Cloud API</li><li>Xây dựng flow chatbot tự động cho CSKH</li><li>Dashboard theo dõi tin nhắn real-time</li></ul>',
        kpiTargets: [
          { metricName: 'Page', unit: 'Page', target: 100, current: 20 },
          { metricName: 'Tin nhắn', unit: 'Tin nhắn', target: 1000000, current: 500000 }
        ],
        progressPercent: 35,
        tasks: [
          { title: 'Đăng ký Whatsapp Business API', picId: 'USER5', picName: 'Lê Văn Hùng', deadline: new Date('2026-02-28'), isCompleted: true, completedAt: new Date('2026-02-25') },
          { title: 'Setup webhook & server endpoint', picId: 'USER5', picName: 'Lê Văn Hùng', deadline: new Date('2026-03-15'), isCompleted: true, completedAt: new Date('2026-03-10') },
          { title: 'Xây dựng chatbot flow cơ bản', picId: 'USER5', picName: 'Lê Văn Hùng', deadline: new Date('2026-04-15'), isCompleted: false, completedAt: null },
          { title: 'Triển khai cho 5 khách hàng pilot', picId: 'USER5', picName: 'Lê Văn Hùng', deadline: new Date('2026-05-15'), isCompleted: false, completedAt: null },
          { title: 'Mở rộng đến 10 khách hàng', picId: 'USER5', picName: 'Lê Văn Hùng', deadline: new Date('2026-06-15'), isCompleted: false, completedAt: null },
        ],
        milestones: [
          { metricName: 'Page', valueAdded: 20, totalCurrent: 20, note: 'Onboard 20 page đầu tiên', createdBy: 'Lê Văn Hùng' },
          { metricName: 'Tin nhắn', valueAdded: 500000, totalCurrent: 500000, note: '500k tin nhắn xử lý tự động', createdBy: 'System' },
        ],
        attachments: [
          { fileName: 'Whatsapp API Documentation', url: 'https://developers.facebook.com/docs/whatsapp', createdBy: 'Lê Văn Hùng' },
          { fileName: 'Chatbot Flow Diagram', url: 'https://miro.com/app/board/example', createdBy: 'Lê Văn Hùng' },
          { fileName: 'Danh sách khách hàng Enterprise', url: 'https://docs.google.com/sheets/d/example3', createdBy: 'System' },
        ]
      },
      {
        id: 'PROG-003',
        name: 'Chiến dịch CPO Q2',
        typeId: 'PDF',
        budgetType: 'fixed',
        budget: 10000,
        startDate: new Date('2026-04-01'),
        endDate: new Date('2026-06-30'),
        picIds: ['USER7'],
        descriptionHtml: '<p>Tài trợ đối tác giảm giá vốn để tối đa hóa số đơn hàng mới.</p><ul><li>Tối ưu CPO xuống dưới $1 / đơn</li><li>Scale campaign khi đạt CPO target</li><li>Partnership discount program</li></ul>',
        kpiTargets: [
          { metricName: 'Đơn hàng', unit: 'Đơn', target: 10000, current: 2500 }
        ],
        progressPercent: 25,
        tasks: [
          { title: 'Phân tích dữ liệu đơn hàng Q1', picId: 'USER7', picName: 'Trần Đức Anh', deadline: new Date('2026-04-10'), isCompleted: true, completedAt: new Date('2026-04-09') },
          { title: 'Setup tracking & attribution', picId: 'USER7', picName: 'Trần Đức Anh', deadline: new Date('2026-04-20'), isCompleted: true, completedAt: new Date('2026-04-18') },
          { title: 'Launch campaign phase 1', picId: 'USER7', picName: 'Trần Đức Anh', deadline: new Date('2026-05-01'), isCompleted: false, completedAt: null },
          { title: 'Scale budget nếu CPO < $1', picId: 'USER7', picName: 'Trần Đức Anh', deadline: new Date('2026-05-30'), isCompleted: false, completedAt: null },
        ],
        milestones: [
          { metricName: 'Đơn hàng', valueAdded: 2500, totalCurrent: 2500, note: 'Đạt 2500 đơn hàng sau 2 tuần chạy', createdBy: 'Trần Đức Anh' },
        ],
        attachments: [
          { fileName: 'CPO Analysis Report', url: 'https://docs.google.com/document/d/example4', createdBy: 'Trần Đức Anh' },
        ]
      },
      {
        id: 'PROG-004',
        name: 'Click-to-Messenger Campaign',
        typeId: 'CTX',
        budgetType: 'fixed',
        budget: 20000,
        startDate: new Date('2026-03-01'),
        endDate: new Date('2026-05-30'),
        picIds: ['USER8'],
        descriptionHtml: '<p>Thúc đẩy tương tác khách hàng qua quảng cáo Click-to-Messenger, tối ưu chi phí tin nhắn.</p><ul><li>Target audience từ Lookalike đã mua hàng</li><li>Automated Messenger response flow</li><li>Tích hợp CRM để track conversion</li></ul>',
        kpiTargets: [
          { metricName: 'Chi phí', unit: '$', target: 20000, current: 12000 }
        ],
        progressPercent: 60,
        tasks: [
          { title: 'Tạo Lookalike Audience', picId: 'USER8', picName: 'Hoàng Diệu Linh', deadline: new Date('2026-03-10'), isCompleted: true, completedAt: new Date('2026-03-08') },
          { title: 'Setup Messenger auto-reply', picId: 'USER8', picName: 'Hoàng Diệu Linh', deadline: new Date('2026-03-20'), isCompleted: true, completedAt: new Date('2026-03-18') },
          { title: 'Launch CTX campaign', picId: 'USER8', picName: 'Hoàng Diệu Linh', deadline: new Date('2026-04-01'), isCompleted: true, completedAt: new Date('2026-03-30') },
          { title: 'Tích hợp tracking vào CRM', picId: 'USER8', picName: 'Hoàng Diệu Linh', deadline: new Date('2026-04-15'), isCompleted: false, completedAt: null },
          { title: 'Báo cáo tổng kết chiến dịch', picId: 'USER8', picName: 'Hoàng Diệu Linh', deadline: new Date('2026-05-25'), isCompleted: false, completedAt: null },
        ],
        milestones: [
          { metricName: 'Chi phí', valueAdded: 5000, totalCurrent: 5000, note: 'Chi tháng 3 - phase khởi chạy', createdBy: 'Hoàng Diệu Linh' },
          { metricName: 'Chi phí', valueAdded: 7000, totalCurrent: 12000, note: 'Chi tháng 4 - đang scale tốt', createdBy: 'System' },
        ],
        attachments: [
          { fileName: 'Messenger Flow Blueprint', url: 'https://drive.google.com/file/d/example5', createdBy: 'Hoàng Diệu Linh' },
          { fileName: 'CTX Performance Dashboard', url: 'https://datastudio.google.com/example6', createdBy: 'Hoàng Diệu Linh' },
          { fileName: 'Audience Segment Report', url: 'https://docs.google.com/sheets/d/example7', createdBy: 'System' },
        ]
      }
    ];
    await MetaProgram.insertMany(programsData);
    console.log(`Seeded ${programsData.length} Meta programs`);
  }
}

/**
 * Initialize counters based on existing max IDs in collections.
 * Only creates counter entries that don't already exist.
 */
async function seedCounters() {
  const prefixConfigs = [
    { prefix: "USER", items: seedData.users },
    { prefix: "CUST", items: seedData.customers },
    { prefix: "EVT", items: seedData.events },
    { prefix: "RES", items: seedData.results },
    { prefix: "RSN", items: seedData.reasons },
    { prefix: "ACT", items: seedData.actions },
    { prefix: "CHN", items: seedData.actionChains },
    { prefix: "FUNC", items: seedData.staffFunctions },
    { prefix: "ORG", items: seedData.organizations }

  ];

  let seeded = 0;
  for (const { prefix, items } of prefixConfigs) {
    const existing = await Counter.findById(prefix);
    if (!existing) {
      await Counter.create({ _id: prefix, seq: items.length });
      seeded++;
    }
  }

  if (seeded > 0) {
    console.log(`Seeded ${seeded} counters`);
  }
}

module.exports = {
  seedDatabase,
};
