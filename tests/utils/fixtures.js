/**
 * tests/utils/fixtures.js
 * Seeds minimal data required for integration tests.
 * Called once before the full suite from setup.js.
 */

const mongoose = require("mongoose");
const User = require("../../src/models/User");
const Customer = require("../../src/models/Customer");
const Event = require("../../src/models/Event");
const Action = require("../../src/models/Action");
const Result = require("../../src/models/Result");
const Reason = require("../../src/models/Reason");
const ActionChain = require("../../src/models/ActionChain");
const Organization = require("../../src/models/Organization");
const Lead = require("../../src/models/Lead");
const Task = require("../../src/models/Task");
const StaffFunction = require("../../src/models/StaffFunction");
const { hashPassword } = require("../../src/utils/auth");

// ─── Fixture IDs (stable, referenced across test files) ──────────────────────
const IDS = {
  // Users
  USER_OWNER:   "TEST-USER001",
  USER_ADMIN:   "TEST-USER002",
  USER_MANAGER: "TEST-USER003",
  USER_STAFF1:  "TEST-USER004",
  USER_STAFF2:  "TEST-USER005",

  // RBAC role IDs (set by seedRbac — lowercase)
  ROLE_OWNER:   "owner",
  ROLE_ADMIN:   "admin",
  ROLE_MANAGER: "manager",
  ROLE_STAFF:   "staff",

  // Customers
  CUST1: "TEST-CUST001",
  CUST2: "TEST-CUST002",

  // Events
  EVT1: "TEST-EVT001",
  EVT2: "TEST-EVT002", // unassigned

  // Action Config
  ACT1: "TEST-ACT001",
  ACT2: "TEST-ACT002",
  RES1: "TEST-RES001",
  RES2: "TEST-RES002",
  REAS1: "TEST-REAS001",
  CHAIN1: "TEST-CHAIN001",  // active
  CHAIN2: "TEST-CHAIN002",  // inactive
  CHAIN3: "TEST-CHAIN003",  // active, simple branching

  // Organization
  ORG1: "TEST-ORG001",

  // Leads & Tasks
  LEAD1: "TEST-LEAD001",
  TASK1: "TEST-TASK001",

  // Functions
  FUNC1: "TEST-FUNC001",
};

// ─── User credentials ─────────────────────────────────────────────────────────
const CREDENTIALS = {
  owner:   { email: "owner@test.com",   password: "Owner@123" },
  admin:   { email: "admin@test.com",   password: "Admin@123" },
  manager: { email: "manager@test.com", password: "Manager@123" },
  staff1:  { email: "staff1@test.com",  password: "Staff@123" },
  staff2:  { email: "staff2@test.com",  password: "Staff@123" },
};

async function seedTestFixtures() {
  // ── Organization ────────────────────────────────────────────────────────────
  await Organization.create({
    id:     IDS.ORG1,
    parent: "Phòng Sale",
    alias:  "phong-sale",
    children: [
      { name: "Nhóm Sale HN", alias: "phong-sale-nhom-sale-hn", desc: "Hà Nội" },
    ],
  });

  // ── Users ────────────────────────────────────────────────────────────────────
  const pwHash = async (pw) => hashPassword(pw);

  await User.insertMany([
    {
      id: IDS.USER_OWNER,
      name: "Test Owner",
      email: CREDENTIALS.owner.email,
      passwordHash: await pwHash(CREDENTIALS.owner.password),
      roleId: IDS.ROLE_OWNER,
      department: [],
      group: [],
      sessions: [],
    },
    {
      id: IDS.USER_ADMIN,
      name: "Test Admin",
      email: CREDENTIALS.admin.email,
      passwordHash: await pwHash(CREDENTIALS.admin.password),
      roleId: IDS.ROLE_ADMIN,
      department: ["Phòng Kỹ Thuật"],
      group: [],
      sessions: [],
    },
    {
      id: IDS.USER_MANAGER,
      name: "Test Manager",
      email: CREDENTIALS.manager.email,
      passwordHash: await pwHash(CREDENTIALS.manager.password),
      roleId: IDS.ROLE_MANAGER,
      department: ["Phòng Sale"],
      group: ["Nhóm Sale HN"],
      sessions: [],
    },
    {
      id: IDS.USER_STAFF1,
      name: "Test Staff One",
      email: CREDENTIALS.staff1.email,
      passwordHash: await pwHash(CREDENTIALS.staff1.password),
      roleId: IDS.ROLE_STAFF,
      department: ["Phòng Sale"],
      group: ["Nhóm Sale HN"],
      managerId: IDS.USER_MANAGER,
      sessions: [],
    },
    {
      id: IDS.USER_STAFF2,
      name: "Test Staff Two",
      email: CREDENTIALS.staff2.email,
      passwordHash: await pwHash(CREDENTIALS.staff2.password),
      roleId: IDS.ROLE_STAFF,
      department: ["Phòng Sale"],
      group: ["Nhóm Sale HN"],
      managerId: IDS.USER_MANAGER,
      sessions: [],
    },
  ]);

  // ── Results ──────────────────────────────────────────────────────────────────
  await Result.insertMany([
    { id: IDS.RES1, name: "Đã liên hệ & quan tâm", type: "success", description: "KH bắt máy, quan tâm" },
    { id: IDS.RES2, name: "Không bắt máy",          type: "failure", description: "KH không nghe" },
  ]);

  // ── Reasons ──────────────────────────────────────────────────────────────────
  await Reason.insertMany([
    { id: IDS.REAS1, name: "Bận việc", description: "KH bận" },
  ]);

  // ── Actions ──────────────────────────────────────────────────────────────────
  await Action.insertMany([
    {
      id: IDS.ACT1,
      name: "Gọi điện lần 1",
      type: "call",
      category: "primary",
      reasonIds: [IDS.REAS1],
      description: "Cuộc gọi đầu tiên",
    },
    {
      id: IDS.ACT2,
      name: "Gọi điện lần 2",
      type: "call",
      category: "primary",
      reasonIds: [IDS.REAS1],
      description: "Cuộc gọi thứ hai",
    },
  ]);

  // ── Action Chains ─────────────────────────────────────────────────────────────
  await ActionChain.insertMany([
    {
      id: IDS.CHAIN1,
      name: "Chain active test",
      description: "Used by event chain tests",
      delayUnit: "immediate",
      delayValue: null,
      active: true,
      steps: [
        {
          order: 1,
          actionId: IDS.ACT1,
          branches: [
            {
              resultId: IDS.RES1,
              order: 1,
              nextStepType: "next_in_chain",
              nextActionId: IDS.ACT2,
              closeOutcome: null,
              delayUnit: "hour",
              delayValue: 2,
            },
            {
              resultId: IDS.RES2,
              order: 2,
              nextStepType: "close_task",
              nextActionId: null,
              closeOutcome: "failure",
              delayUnit: null,
              delayValue: null,
            },
          ],
        },
        {
          order: 2,
          actionId: IDS.ACT2,
          branches: [],
        },
      ],
    },
    {
      id: IDS.CHAIN2,
      name: "Chain inactive test",
      description: "Cannot be added to events",
      delayUnit: "hour",
      delayValue: 1,
      active: false,
      steps: [],
    },
    {
      id: IDS.CHAIN3,
      name: "Chain simple",
      description: "Simple 1-step chain",
      delayUnit: "immediate",
      delayValue: null,
      active: true,
      steps: [{ order: 1, actionId: IDS.ACT1, branches: [] }],
    },
  ]);

  // ── Customers ─────────────────────────────────────────────────────────────────
  await Customer.insertMany([
    {
      id: IDS.CUST1,
      name: "Test Customer VIP",
      email: "vip@test.com",
      phone: "0901 000 111",
      type: "VIP Customer",
      biz: ["BizA"],
      platforms: ["SmaxAi"],
      group: "Nhóm Sale HN",
      registeredAt: "01/01/2026",
      tags: ["#VIP"],
    },
    {
      id: IDS.CUST2,
      name: "Test Customer Trial",
      email: "trial@test.com",
      phone: "0901 000 222",
      type: "Trial",
      biz: [],
      platforms: [],
      group: "Nhóm Sale HN",
      registeredAt: "10/04/2026",
      tags: [],
    },
  ]);

  // ── Events ───────────────────────────────────────────────────────────────────
  await Event.insertMany([
    {
      id: IDS.EVT1,
      name: "Test Event Assigned",
      group: "user_moi",
      stage: "Tiếp cận",
      customer: {
        name: "Test Customer VIP",
        email: "vip@test.com",
        phone: "0901 000 111",
      },
      customerId: IDS.CUST1,
      assigneeId: IDS.USER_STAFF1,
      assignee: {
        name: "Test Staff One",
        avatar: "",
        role: "Nhân viên",
      },
    },
    {
      id: IDS.EVT2,
      name: "Test Event Unassigned",
      group: "biz_moi",
      stage: "Chờ xử lý",
      customer: {
        name: "Test Customer Trial",
        email: "trial@test.com",
        phone: "0901 000 222",
      },
      customerId: null,
      assigneeId: null,
      assignee: null,
    },
  ]);

  // ── Leads ─────────────────────────────────────────────────────────────────────
  await Lead.insertMany([
    {
      id: IDS.LEAD1,
      name: "Test Lead",
      email: "lead@test.com",
      phone: "0901 000 333",
      status: "Biz tạo mới",
      tags: ["#TestLead"],
      source: "Test",
    },
  ]);

  // ── Tasks ─────────────────────────────────────────────────────────────────────
  await Task.insertMany([
    {
      id: IDS.TASK1,
      action: "Gọi điện test",
      time: "09:00",
      timeType: "future",
      customer: {
        name: "Test Customer VIP",
        email: "vip@test.com",
        phone: "0901 000 111",
      },
      platform: "SmaxAi",
      assignee: { name: "Test Staff One", avatar: "" },
      status: "Đang thực hiện",
    },
  ]);

  // ── Staff Functions ────────────────────────────────────────────────────────────
  await StaffFunction.insertMany([
    { id: IDS.FUNC1, title: "Test Function", desc: "Mô tả test", type: "tech" },
  ]);
}

module.exports = { IDS, CREDENTIALS, seedTestFixtures };
