/**
 * seedMeta.js
 * Script để seed dữ liệu mẫu cho module Hợp tác Meta dựa vào template HTML.
 * Bao gồm đầy đủ: Configs, Users, Programs, KPI Targets, Milestones, Tasks, Attachments.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');

const MetaConfig = require('../models/MetaConfig');
const MetaProgram = require('../models/MetaProgram');
const User = require('../models/User');

// ─── Config Types (giống badge-mdf, badge-wa, badge-pdf, badge-ctx, badge-fmm trong HTML) ────
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

async function seed() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("❌ MONGO_URI not found in .env");
    process.exit(1);
  }

  console.log("🔌 Connecting to MongoDB...");
  await mongoose.connect(uri);

  // ── Clean up ──
  console.log("🗑 Clearing Meta configs and programs...");
  await MetaConfig.deleteMany({});
  await MetaProgram.deleteMany({});

  // ── Seed Configs ──
  console.log("🌱 Seeding MetaConfigs...");
  await MetaConfig.insertMany(configsData);

  // ── Seed Users for PICs ──
  console.log("🔍 Seeding PIC Users...");
  await User.deleteMany({ email: { $in: [
    'nguyenvana@example.com', 'tranthib@example.com',
    'levanc@example.com', 'phamthid@example.com'
  ]}});

  const seedUsers = await User.insertMany([
    { id: 'USR-SEED-1', name: 'Nguyễn Văn A', email: 'nguyenvana@example.com', passwordHash: 'seed_hash', avatar: 'https://i.pravatar.cc/100?img=12', role: 'STAFF', isActive: true },
    { id: 'USR-SEED-2', name: 'Trần Thị B', email: 'tranthib@example.com', passwordHash: 'seed_hash', avatar: 'https://i.pravatar.cc/100?img=5', role: 'STAFF', isActive: true },
    { id: 'USR-SEED-3', name: 'Lê Văn C', email: 'levanc@example.com', passwordHash: 'seed_hash', avatar: 'https://i.pravatar.cc/100?img=33', role: 'STAFF', isActive: true },
    { id: 'USR-SEED-4', name: 'Phạm Thị D', email: 'phamthid@example.com', passwordHash: 'seed_hash', avatar: 'https://i.pravatar.cc/100?img=47', role: 'STAFF', isActive: true },
  ]);

  const pic1 = seedUsers[0].id;
  const pic2 = seedUsers[1].id;
  const pic3 = seedUsers[2].id;
  const pic4 = seedUsers[3].id;

  // ── Seed Programs (giống chính xác HTML Table Row 1-4) ──
  const programsData = [
    {
      id: 'PROG-001',
      name: 'Tăng trưởng doanh thu Q1',
      typeId: 'MDF',
      budgetType: 'fixed',
      budget: 50000,
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-03-31'),
      picIds: [pic1],
      descriptionHtml: '<p>Tối ưu hóa các chiến dịch chuyển đổi trên Meta Ads để đạt mục tiêu doanh thu đề ra. Bao gồm:</p><ul><li>Tối ưu CPA cho các campaign conversion</li><li>A/B testing creative sets hàng tuần</li><li>Retargeting audience cũ với dynamic ads</li></ul>',
      kpiTargets: [
        { metricName: 'Doanh thu', unit: '$', target: 50000, current: 45000 }
      ],
      progressPercent: 90,
      tasks: [
        { title: 'Setup Meta Business Suite', picId: pic1, picName: 'Nguyễn Văn A', deadline: new Date('2025-01-10'), isCompleted: true, completedAt: new Date('2025-01-08') },
        { title: 'Chạy A/B test creative tháng 1', picId: pic1, picName: 'Nguyễn Văn A', deadline: new Date('2025-01-31'), isCompleted: true, completedAt: new Date('2025-01-28') },
        { title: 'Báo cáo mid-term Q1', picId: pic1, picName: 'Nguyễn Văn A', deadline: new Date('2025-02-15'), isCompleted: true, completedAt: new Date('2025-02-14') },
        { title: 'Tối ưu retargeting campaign', picId: pic1, picName: 'Nguyễn Văn A', deadline: new Date('2025-03-15'), isCompleted: true, completedAt: new Date('2025-03-12') },
        { title: 'Tổng kết Q1 & báo cáo cuối kỳ', picId: pic1, picName: 'Nguyễn Văn A', deadline: new Date('2025-03-31'), isCompleted: false, completedAt: null },
      ],
      milestones: [
        { metricName: 'Doanh thu', valueAdded: 15000, totalCurrent: 15000, note: 'Doanh thu tháng 1 từ conversion campaigns', createdBy: 'Nguyễn Văn A' },
        { metricName: 'Doanh thu', valueAdded: 18000, totalCurrent: 33000, note: 'Tháng 2 - tăng mạnh nhờ retargeting', createdBy: 'Nguyễn Văn A' },
        { metricName: 'Doanh thu', valueAdded: 12000, totalCurrent: 45000, note: 'Tháng 3 - giai đoạn cuối Q1', createdBy: 'System' },
      ],
      attachments: [
        { fileName: 'Báo cáo Q1 - Meta Ads Performance', url: 'https://docs.google.com/spreadsheets/d/example1', createdBy: 'Nguyễn Văn A' },
        { fileName: 'Creative Guidelines v2.0', url: 'https://drive.google.com/file/d/example2', createdBy: 'Nguyễn Văn A' },
      ]
    },
    {
      id: 'PROG-002',
      name: 'Tích hợp Chatbot Whatsapp',
      typeId: 'Whatsapp',
      budgetType: 'fixed',
      budget: 10000,
      startDate: new Date('2025-02-15'),
      endDate: new Date('2025-06-30'),
      picIds: [pic2],
      descriptionHtml: '<p>Triển khai CSKH tự động qua Whatsapp API cho 10 khách hàng Enterprise.</p><ul><li>Tích hợp Whatsapp Cloud API</li><li>Xây dựng flow chatbot tự động cho CSKH</li><li>Dashboard theo dõi tin nhắn real-time</li></ul>',
      kpiTargets: [
        { metricName: 'Page', unit: 'Page', target: 100, current: 20 },
        { metricName: 'Tin nhắn', unit: 'Tin nhắn', target: 1000000, current: 500000 }
      ],
      progressPercent: 35,
      tasks: [
        { title: 'Đăng ký Whatsapp Business API', picId: pic2, picName: 'Trần Thị B', deadline: new Date('2025-02-28'), isCompleted: true, completedAt: new Date('2025-02-25') },
        { title: 'Setup webhook & server endpoint', picId: pic2, picName: 'Trần Thị B', deadline: new Date('2025-03-15'), isCompleted: true, completedAt: new Date('2025-03-10') },
        { title: 'Xây dựng chatbot flow cơ bản', picId: pic2, picName: 'Trần Thị B', deadline: new Date('2025-04-15'), isCompleted: false, completedAt: null },
        { title: 'Triển khai cho 5 khách hàng pilot', picId: pic2, picName: 'Trần Thị B', deadline: new Date('2025-05-15'), isCompleted: false, completedAt: null },
        { title: 'Mở rộng đến 10 khách hàng', picId: pic2, picName: 'Trần Thị B', deadline: new Date('2025-06-15'), isCompleted: false, completedAt: null },
      ],
      milestones: [
        { metricName: 'Page', valueAdded: 20, totalCurrent: 20, note: 'Onboard 20 page đầu tiên', createdBy: 'Trần Thị B' },
        { metricName: 'Tin nhắn', valueAdded: 500000, totalCurrent: 500000, note: '500k tin nhắn xử lý tự động', createdBy: 'System' },
      ],
      attachments: [
        { fileName: 'Whatsapp API Documentation', url: 'https://developers.facebook.com/docs/whatsapp', createdBy: 'Trần Thị B' },
        { fileName: 'Chatbot Flow Diagram', url: 'https://miro.com/app/board/example', createdBy: 'Trần Thị B' },
        { fileName: 'Danh sách khách hàng Enterprise', url: 'https://docs.google.com/sheets/d/example3', createdBy: 'System' },
      ]
    },
    {
      id: 'PROG-003',
      name: 'Chiến dịch CPO Q2',
      typeId: 'PDF',
      budgetType: 'fixed',
      budget: 10000,
      startDate: new Date('2025-04-01'),
      endDate: new Date('2025-06-30'),
      picIds: [pic3],
      descriptionHtml: '<p>Tài trợ đối tác giảm giá vốn để tối đa hóa số đơn hàng mới.</p><ul><li>Tối ưu CPO xuống dưới $1 / đơn</li><li>Scale campaign khi đạt CPO target</li><li>Partnership discount program</li></ul>',
      kpiTargets: [
        { metricName: 'Đơn hàng', unit: 'Đơn', target: 10000, current: 2500 }
      ],
      progressPercent: 25,
      tasks: [
        { title: 'Phân tích dữ liệu đơn hàng Q1', picId: pic3, picName: 'Lê Văn C', deadline: new Date('2025-04-10'), isCompleted: true, completedAt: new Date('2025-04-09') },
        { title: 'Setup tracking & attribution', picId: pic3, picName: 'Lê Văn C', deadline: new Date('2025-04-20'), isCompleted: true, completedAt: new Date('2025-04-18') },
        { title: 'Launch campaign phase 1', picId: pic3, picName: 'Lê Văn C', deadline: new Date('2025-05-01'), isCompleted: false, completedAt: null },
        { title: 'Scale budget nếu CPO < $1', picId: pic3, picName: 'Lê Văn C', deadline: new Date('2025-05-30'), isCompleted: false, completedAt: null },
      ],
      milestones: [
        { metricName: 'Đơn hàng', valueAdded: 2500, totalCurrent: 2500, note: 'Đạt 2500 đơn hàng sau 2 tuần chạy', createdBy: 'Lê Văn C' },
      ],
      attachments: [
        { fileName: 'CPO Analysis Report', url: 'https://docs.google.com/document/d/example4', createdBy: 'Lê Văn C' },
      ]
    },
    {
      id: 'PROG-004',
      name: 'Click-to-Messenger Campaign',
      typeId: 'CTX',
      budgetType: 'fixed',
      budget: 20000,
      startDate: new Date('2025-03-01'),
      endDate: new Date('2025-05-30'),
      picIds: [pic4],
      descriptionHtml: '<p>Thúc đẩy tương tác khách hàng qua quảng cáo Click-to-Messenger, tối ưu chi phí tin nhắn.</p><ul><li>Target audience từ Lookalike đã mua hàng</li><li>Automated Messenger response flow</li><li>Tích hợp CRM để track conversion</li></ul>',
      kpiTargets: [
        { metricName: 'Chi phí', unit: '$', target: 20000, current: 12000 }
      ],
      progressPercent: 60,
      tasks: [
        { title: 'Tạo Lookalike Audience', picId: pic4, picName: 'Phạm Thị D', deadline: new Date('2025-03-10'), isCompleted: true, completedAt: new Date('2025-03-08') },
        { title: 'Setup Messenger auto-reply', picId: pic4, picName: 'Phạm Thị D', deadline: new Date('2025-03-20'), isCompleted: true, completedAt: new Date('2025-03-18') },
        { title: 'Launch CTX campaign', picId: pic4, picName: 'Phạm Thị D', deadline: new Date('2025-04-01'), isCompleted: true, completedAt: new Date('2025-03-30') },
        { title: 'Tích hợp tracking vào CRM', picId: pic4, picName: 'Phạm Thị D', deadline: new Date('2025-04-15'), isCompleted: false, completedAt: null },
        { title: 'Báo cáo tổng kết chiến dịch', picId: pic4, picName: 'Phạm Thị D', deadline: new Date('2025-05-25'), isCompleted: false, completedAt: null },
      ],
      milestones: [
        { metricName: 'Chi phí', valueAdded: 5000, totalCurrent: 5000, note: 'Chi tháng 3 - phase khởi chạy', createdBy: 'Phạm Thị D' },
        { metricName: 'Chi phí', valueAdded: 7000, totalCurrent: 12000, note: 'Chi tháng 4 - đang scale tốt', createdBy: 'System' },
      ],
      attachments: [
        { fileName: 'Messenger Flow Blueprint', url: 'https://drive.google.com/file/d/example5', createdBy: 'Phạm Thị D' },
        { fileName: 'CTX Performance Dashboard', url: 'https://datastudio.google.com/example6', createdBy: 'Phạm Thị D' },
        { fileName: 'Audience Segment Report', url: 'https://docs.google.com/sheets/d/example7', createdBy: 'System' },
      ]
    }
  ];

  console.log("🌱 Seeding MetaPrograms...");
  await MetaProgram.insertMany(programsData);

  console.log("✅ Seed completed successfully!");
  console.log(`   - ${configsData.length} configs`);
  console.log(`   - ${seedUsers.length} users`);
  console.log(`   - ${programsData.length} programs (with tasks, milestones, attachments)`);
  process.exit(0);
}

seed().catch(err => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
