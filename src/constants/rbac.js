/**
 * RBAC Permission Definitions
 * Format: RESOURCE_ACTION
 */

// Resources
const RESOURCES = {
  USERS: "users",
  CUSTOMERS: "customers",
  EVENTS: "events",
  EVENT_CHAINS: "event_chains", // Chuỗi hành động trong sự kiện
  TASKS: "tasks", // Quản lý Tác vụ
  TASK_CHAINS: "task_chains", // Chuỗi hành động trong tác vụ
  ACTIONS_CFG: "actions_cfg",
  ORGANIZATION: "organization",
  ROLES: "roles",
  PERMISSIONS: "permissions",
  METADATA: "metadata",
  FUNCTIONS: "functions",
  FUNCTIONAL_GROUPS: "functional_groups",
  LOGS: "logs", // System / Automation / Webhook logs (read-only)
  META: "meta", // Meta integration programs
  LEADS_CFG: "leads_cfg", // Cấu hình trạng thái Lead
  LEADS: "leads", // Quản lý Lead
  STAFFS: "staffs", // Cấu hình nhân sự
  SALARIES: "salaries", // Cấu hình và bảng lương
  REVENUES: "revenues", // Doanh thu
  EXPENSES: "expenses", // Chi phí
  SALARY_CONFIGS: "salary_configs", // Cấu hình lương
  COMPANIES: "companies", // Cấu hình công ty
  FINANCE: "finance", // Báo cáo tài chính
  JOBHUB: "jobhub", // Job Hub
};

// Actions
const ACTIONS = {
  CREATE: "create",
  READ: "read",
  UPDATE: "update",
  DELETE: "delete",
  CONFIG: "config",
  PERMANENT_DELETE: "permanent_delete",
  RESTORE: "restore",
  MANAGE: "manage", // Has all permissions for this resource
};

// Permission definitions
const PERMISSIONS = {
  // Users management
  USERS_CREATE: `${RESOURCES.USERS}_${ACTIONS.CREATE}`,
  USERS_READ: `${RESOURCES.USERS}_${ACTIONS.READ}`,
  USERS_UPDATE: `${RESOURCES.USERS}_${ACTIONS.UPDATE}`,
  USERS_DELETE: `${RESOURCES.USERS}_${ACTIONS.DELETE}`,
  USER_RESTORE: `${RESOURCES.USERS}_${ACTIONS.RESTORE}`,
  USERS_PERMANENT_DELETE: `${RESOURCES.USERS}_${ACTIONS.PERMANENT_DELETE}`,
  USERS_MANAGE: `${RESOURCES.USERS}_${ACTIONS.MANAGE}`,

  // Customers
  CUSTOMERS_CREATE: `${RESOURCES.CUSTOMERS}_${ACTIONS.CREATE}`,
  CUSTOMERS_READ: `${RESOURCES.CUSTOMERS}_${ACTIONS.READ}`,
  CUSTOMERS_UPDATE: `${RESOURCES.CUSTOMERS}_${ACTIONS.UPDATE}`,
  CUSTOMERS_DELETE: `${RESOURCES.CUSTOMERS}_${ACTIONS.DELETE}`,
  CUSTOMER_RESTORE: `${RESOURCES.CUSTOMERS}_${ACTIONS.RESTORE}`,
  CUSTOMERS_PERMANENT_DELETE: `${RESOURCES.CUSTOMERS}_${ACTIONS.PERMANENT_DELETE}`,
  CUSTOMERS_MANAGE: `${RESOURCES.CUSTOMERS}_${ACTIONS.MANAGE}`,

  // Events
  EVENTS_CREATE: `${RESOURCES.EVENTS}_${ACTIONS.CREATE}`,
  EVENTS_READ: `${RESOURCES.EVENTS}_${ACTIONS.READ}`,
  EVENTS_UPDATE: `${RESOURCES.EVENTS}_${ACTIONS.UPDATE}`,
  EVENTS_DELETE: `${RESOURCES.EVENTS}_${ACTIONS.DELETE}`,
  EVENTS_MANAGE: `${RESOURCES.EVENTS}_${ACTIONS.MANAGE}`,

  // Event Action Chains (chuỗi hành động trong sự kiện)
  EVENT_CHAINS_CREATE: `${RESOURCES.EVENT_CHAINS}_${ACTIONS.CREATE}`,
  EVENT_CHAINS_READ: `${RESOURCES.EVENT_CHAINS}_${ACTIONS.READ}`,
  EVENT_CHAINS_UPDATE: `${RESOURCES.EVENT_CHAINS}_${ACTIONS.UPDATE}`,
  EVENT_CHAINS_DELETE: `${RESOURCES.EVENT_CHAINS}_${ACTIONS.DELETE}`,
  EVENT_CHAINS_CLOSE: `${RESOURCES.EVENT_CHAINS}_close`,
  EVENT_CHAINS_MANAGE: `${RESOURCES.EVENT_CHAINS}_${ACTIONS.MANAGE}`,

  // Organization
  ORGANIZATION_READ: `${RESOURCES.ORGANIZATION}_${ACTIONS.READ}`,
  ORGANIZATION_UPDATE: `${RESOURCES.ORGANIZATION}_${ACTIONS.UPDATE}`,
  ORGANIZATION_MANAGE: `${RESOURCES.ORGANIZATION}_${ACTIONS.MANAGE}`,

  // Roles & Permissions
  ROLES_CREATE: `${RESOURCES.ROLES}_${ACTIONS.CREATE}`,
  ROLES_READ: `${RESOURCES.ROLES}_${ACTIONS.READ}`,
  ROLES_UPDATE: `${RESOURCES.ROLES}_${ACTIONS.UPDATE}`,
  ROLES_DELETE: `${RESOURCES.ROLES}_${ACTIONS.DELETE}`,
  ROLES_MANAGE: `${RESOURCES.ROLES}_${ACTIONS.MANAGE}`,

  PERMISSIONS_READ: `${RESOURCES.PERMISSIONS}_${ACTIONS.READ}`,
  PERMISSIONS_MANAGE: `${RESOURCES.PERMISSIONS}_${ACTIONS.MANAGE}`,

  // Metadata
  METADATA_READ: `${RESOURCES.METADATA}_${ACTIONS.READ}`,

  // Functions
  FUNCTIONS_CREATE: `${RESOURCES.FUNCTIONS}_${ACTIONS.CREATE}`,
  FUNCTIONS_READ: `${RESOURCES.FUNCTIONS}_${ACTIONS.READ}`,
  FUNCTIONS_UPDATE: `${RESOURCES.FUNCTIONS}_${ACTIONS.UPDATE}`,
  FUNCTIONS_DELETE: `${RESOURCES.FUNCTIONS}_${ACTIONS.DELETE}`,
  FUNCTIONS_MANAGE: `${RESOURCES.FUNCTIONS}_${ACTIONS.MANAGE}`,

  // Functional Groups
  FUNCTIONAL_GROUPS_CREATE: `${RESOURCES.FUNCTIONAL_GROUPS}_${ACTIONS.CREATE}`,
  FUNCTIONAL_GROUPS_READ: `${RESOURCES.FUNCTIONAL_GROUPS}_${ACTIONS.READ}`,
  FUNCTIONAL_GROUPS_UPDATE: `${RESOURCES.FUNCTIONAL_GROUPS}_${ACTIONS.UPDATE}`,
  FUNCTIONAL_GROUPS_DELETE: `${RESOURCES.FUNCTIONAL_GROUPS}_${ACTIONS.DELETE}`,
  FUNCTIONAL_GROUPS_MANAGE: `${RESOURCES.FUNCTIONAL_GROUPS}_${ACTIONS.MANAGE}`,

  // Actions Config (actions, results, reasons, action chains)
  ACTIONS_CFG_CREATE: `${RESOURCES.ACTIONS_CFG}_${ACTIONS.CREATE}`,
  ACTIONS_CFG_READ: `${RESOURCES.ACTIONS_CFG}_${ACTIONS.READ}`,
  ACTIONS_CFG_UPDATE: `${RESOURCES.ACTIONS_CFG}_${ACTIONS.UPDATE}`,
  ACTIONS_CFG_DELETE: `${RESOURCES.ACTIONS_CFG}_${ACTIONS.DELETE}`,
  ACTIONS_CFG_MANAGE: `${RESOURCES.ACTIONS_CFG}_${ACTIONS.MANAGE}`,

  // Logs (read-only — append-only audit trail, no create/update/delete via API)
  LOGS_SYSTEM_READ: `${RESOURCES.LOGS}_system_${ACTIONS.READ}`,
  LOGS_WEBHOOK_READ: `${RESOURCES.LOGS}_webhook_${ACTIONS.READ}`,
  LOGS_AUTOMATION_READ: `${RESOURCES.LOGS}_automation_${ACTIONS.READ}`,

  // Meta integration
  META_CREATE: `${RESOURCES.META}_${ACTIONS.CREATE}`,
  META_READ: `${RESOURCES.META}_${ACTIONS.READ}`,
  META_UPDATE: `${RESOURCES.META}_${ACTIONS.UPDATE}`,
  META_DELETE: `${RESOURCES.META}_${ACTIONS.DELETE}`,
  META_MANAGE: `${RESOURCES.META}_${ACTIONS.MANAGE}`,

  // Leads Config
  LEADS_CFG_MANAGE: `${RESOURCES.LEADS_CFG}_${ACTIONS.MANAGE}`,

  // Leads
  LEADS_CREATE: `${RESOURCES.LEADS}_${ACTIONS.CREATE}`,
  LEADS_READ: `${RESOURCES.LEADS}_${ACTIONS.READ}`,
  LEADS_UPDATE: `${RESOURCES.LEADS}_${ACTIONS.UPDATE}`,
  LEADS_DELETE: `${RESOURCES.LEADS}_${ACTIONS.DELETE}`,
  LEADS_MANAGE: `${RESOURCES.LEADS}_${ACTIONS.MANAGE}`,

  // Tasks
  TASKS_CREATE: `${RESOURCES.TASKS}_${ACTIONS.CREATE}`,
  TASKS_READ: `${RESOURCES.TASKS}_${ACTIONS.READ}`,
  TASKS_UPDATE: `${RESOURCES.TASKS}_${ACTIONS.UPDATE}`,
  TASKS_DELETE: `${RESOURCES.TASKS}_${ACTIONS.DELETE}`,
  TASKS_MANAGE: `${RESOURCES.TASKS}_${ACTIONS.MANAGE}`,

  // Task Action Chains (chuỗi hành động trong tác vụ)
  TASK_CHAINS_CREATE: `${RESOURCES.TASK_CHAINS}_${ACTIONS.CREATE}`,
  TASK_CHAINS_READ: `${RESOURCES.TASK_CHAINS}_${ACTIONS.READ}`,
  TASK_CHAINS_UPDATE: `${RESOURCES.TASK_CHAINS}_${ACTIONS.UPDATE}`,
  TASK_CHAINS_DELETE: `${RESOURCES.TASK_CHAINS}_${ACTIONS.DELETE}`,
  TASK_CHAINS_CLOSE: `${RESOURCES.TASK_CHAINS}_close`,
  TASK_CHAINS_MANAGE: `${RESOURCES.TASK_CHAINS}_${ACTIONS.MANAGE}`,

  // Finance Dashboard
  FINANCE_READ: `${RESOURCES.FINANCE}_${ACTIONS.READ}`,

  // Staffs
  STAFFS_CREATE: `${RESOURCES.STAFFS}_${ACTIONS.CREATE}`,
  STAFFS_READ: `${RESOURCES.STAFFS}_${ACTIONS.READ}`,
  STAFFS_UPDATE: `${RESOURCES.STAFFS}_${ACTIONS.UPDATE}`,
  STAFFS_DELETE: `${RESOURCES.STAFFS}_${ACTIONS.DELETE}`,
  STAFFS_MANAGE: `${RESOURCES.STAFFS}_${ACTIONS.MANAGE}`,

  // Salaries
  SALARIES_CREATE: `${RESOURCES.SALARIES}_${ACTIONS.CREATE}`,
  SALARIES_READ: `${RESOURCES.SALARIES}_${ACTIONS.READ}`,
  SALARIES_UPDATE: `${RESOURCES.SALARIES}_${ACTIONS.UPDATE}`,
  SALARIES_DELETE: `${RESOURCES.SALARIES}_${ACTIONS.DELETE}`,
  SALARIES_MANAGE: `${RESOURCES.SALARIES}_${ACTIONS.MANAGE}`,

  // Revenues
  REVENUES_CREATE: `${RESOURCES.REVENUES}_${ACTIONS.CREATE}`,
  REVENUES_READ: `${RESOURCES.REVENUES}_${ACTIONS.READ}`,
  REVENUES_UPDATE: `${RESOURCES.REVENUES}_${ACTIONS.UPDATE}`,
  REVENUES_DELETE: `${RESOURCES.REVENUES}_${ACTIONS.DELETE}`,
  REVENUES_CONFIG: `${RESOURCES.REVENUES}_${ACTIONS.CONFIG}`,
  REVENUES_MANAGE: `${RESOURCES.REVENUES}_${ACTIONS.MANAGE}`,

  // Expenses
  EXPENSES_CREATE: `${RESOURCES.EXPENSES}_${ACTIONS.CREATE}`,
  EXPENSES_READ: `${RESOURCES.EXPENSES}_${ACTIONS.READ}`,
  EXPENSES_UPDATE: `${RESOURCES.EXPENSES}_${ACTIONS.UPDATE}`,
  EXPENSES_DELETE: `${RESOURCES.EXPENSES}_${ACTIONS.DELETE}`,
  EXPENSES_CONFIG: `${RESOURCES.EXPENSES}_${ACTIONS.CONFIG}`,
  EXPENSES_MANAGE: `${RESOURCES.EXPENSES}_${ACTIONS.MANAGE}`,

  // Salary Configs
  SALARY_CONFIGS_CREATE: `${RESOURCES.SALARY_CONFIGS}_${ACTIONS.CREATE}`,
  SALARY_CONFIGS_READ: `${RESOURCES.SALARY_CONFIGS}_${ACTIONS.READ}`,
  SALARY_CONFIGS_UPDATE: `${RESOURCES.SALARY_CONFIGS}_${ACTIONS.UPDATE}`,
  SALARY_CONFIGS_DELETE: `${RESOURCES.SALARY_CONFIGS}_${ACTIONS.DELETE}`,
  SALARY_CONFIGS_MANAGE: `${RESOURCES.SALARY_CONFIGS}_${ACTIONS.MANAGE}`,

  // Companies
  COMPANIES_CREATE: `${RESOURCES.COMPANIES}_${ACTIONS.CREATE}`,
  COMPANIES_READ: `${RESOURCES.COMPANIES}_${ACTIONS.READ}`,
  COMPANIES_UPDATE: `${RESOURCES.COMPANIES}_${ACTIONS.UPDATE}`,
  COMPANIES_DELETE: `${RESOURCES.COMPANIES}_${ACTIONS.DELETE}`,
  COMPANIES_MANAGE: `${RESOURCES.COMPANIES}_${ACTIONS.MANAGE}`,

  // Job Hub
  // Job Hub - Work (Chung)
  JOBHUB_WORK_READ: `${RESOURCES.JOBHUB}_work_${ACTIONS.READ}`,
  JOBHUB_WORK_MANAGE: `${RESOURCES.JOBHUB}_work_${ACTIONS.MANAGE}`,

  // Job Hub - Folders
  JOBHUB_FOLDER_CREATE: `${RESOURCES.JOBHUB}_folder_${ACTIONS.CREATE}`,
  JOBHUB_FOLDER_UPDATE: `${RESOURCES.JOBHUB}_folder_${ACTIONS.UPDATE}`,
  JOBHUB_FOLDER_DELETE: `${RESOURCES.JOBHUB}_folder_${ACTIONS.DELETE}`,

  // Job Hub - Tasks
  JOBHUB_TASK_CREATE: `${RESOURCES.JOBHUB}_task_${ACTIONS.CREATE}`,
  JOBHUB_TASK_UPDATE: `${RESOURCES.JOBHUB}_task_${ACTIONS.UPDATE}`,
  JOBHUB_TASK_DELETE: `${RESOURCES.JOBHUB}_task_${ACTIONS.DELETE}`,

  // Job Hub - Config
  JOBHUB_CONFIG_READ: `${RESOURCES.JOBHUB}_config_${ACTIONS.READ}`,
  JOBHUB_CONFIG_CHANNEL_READ: `${RESOURCES.JOBHUB}_channel_${ACTIONS.READ}`,
  JOBHUB_CONFIG_CHANNEL_CREATE: `${RESOURCES.JOBHUB}_channel_${ACTIONS.CREATE}`,
  JOBHUB_CONFIG_CHANNEL_UPDATE: `${RESOURCES.JOBHUB}_channel_${ACTIONS.UPDATE}`,
  JOBHUB_CONFIG_CHANNEL_DELETE: `${RESOURCES.JOBHUB}_channel_${ACTIONS.DELETE}`,

  JOBHUB_CONFIG_TASK_TYPE_READ: `${RESOURCES.JOBHUB}_task_type_${ACTIONS.READ}`,
  JOBHUB_CONFIG_TASK_TYPE_CREATE: `${RESOURCES.JOBHUB}_task_type_${ACTIONS.CREATE}`,
  JOBHUB_CONFIG_TASK_TYPE_UPDATE: `${RESOURCES.JOBHUB}_task_type_${ACTIONS.UPDATE}`,
  JOBHUB_CONFIG_TASK_TYPE_DELETE: `${RESOURCES.JOBHUB}_task_type_${ACTIONS.DELETE}`,

  JOBHUB_CONFIG_TASK_TYPE_GROUP_READ: `${RESOURCES.JOBHUB}_task_type_group_${ACTIONS.READ}`,
  JOBHUB_CONFIG_TASK_TYPE_GROUP_CREATE: `${RESOURCES.JOBHUB}_task_type_group_${ACTIONS.CREATE}`,
  JOBHUB_CONFIG_TASK_TYPE_GROUP_UPDATE: `${RESOURCES.JOBHUB}_task_type_group_${ACTIONS.UPDATE}`,
  JOBHUB_CONFIG_TASK_TYPE_GROUP_DELETE: `${RESOURCES.JOBHUB}_task_type_group_${ACTIONS.DELETE}`,
  JOBHUB_CONFIG_TASK_TYPE_GROUP_MANAGE: `${RESOURCES.JOBHUB}_task_type_group_${ACTIONS.MANAGE}`,

  JOBHUB_CONFIG_STATUS_READ: `${RESOURCES.JOBHUB}_status_${ACTIONS.READ}`,
  JOBHUB_CONFIG_STATUS_CREATE: `${RESOURCES.JOBHUB}_status_${ACTIONS.CREATE}`,
  JOBHUB_CONFIG_STATUS_UPDATE: `${RESOURCES.JOBHUB}_status_${ACTIONS.UPDATE}`,
  JOBHUB_CONFIG_STATUS_DELETE: `${RESOURCES.JOBHUB}_status_${ACTIONS.DELETE}`,

  JOBHUB_CONFIG_REPEAT_RULE_READ: `${RESOURCES.JOBHUB}_repeat_rule_${ACTIONS.READ}`,
  JOBHUB_CONFIG_REPEAT_RULE_CREATE: `${RESOURCES.JOBHUB}_repeat_rule_${ACTIONS.CREATE}`,
  JOBHUB_CONFIG_REPEAT_RULE_UPDATE: `${RESOURCES.JOBHUB}_repeat_rule_${ACTIONS.UPDATE}`,
  JOBHUB_CONFIG_REPEAT_RULE_DELETE: `${RESOURCES.JOBHUB}_repeat_rule_${ACTIONS.DELETE}`,
};

const STAFF_PERMISSIONS = [
  PERMISSIONS.CUSTOMERS_READ,
  PERMISSIONS.CUSTOMERS_CREATE,
  PERMISSIONS.CUSTOMERS_UPDATE,
  PERMISSIONS.CUSTOMERS_DELETE,
  PERMISSIONS.EVENTS_READ,
  PERMISSIONS.EVENTS_CREATE,
  PERMISSIONS.EVENTS_UPDATE, // Có thể update event được assign cho mình
  PERMISSIONS.EVENT_CHAINS_READ,
  PERMISSIONS.EVENT_CHAINS_CREATE,
  PERMISSIONS.EVENT_CHAINS_UPDATE,
  PERMISSIONS.EVENT_CHAINS_CLOSE,
  PERMISSIONS.EVENT_CHAINS_DELETE,
  PERMISSIONS.METADATA_READ,
  PERMISSIONS.FUNCTIONS_READ,
  PERMISSIONS.FUNCTIONAL_GROUPS_READ,
  PERMISSIONS.ACTIONS_CFG_READ,
  PERMISSIONS.META_READ,
  PERMISSIONS.META_CREATE,
  PERMISSIONS.META_UPDATE,
  PERMISSIONS.META_DELETE,
  PERMISSIONS.LEADS_READ,
  PERMISSIONS.LEADS_CREATE,
  PERMISSIONS.LEADS_UPDATE, // Có thể update lead được assign cho mình
  PERMISSIONS.LEADS_DELETE,
  PERMISSIONS.TASKS_READ,
  PERMISSIONS.TASKS_CREATE,
  PERMISSIONS.TASKS_UPDATE,
  PERMISSIONS.TASKS_DELETE,
  PERMISSIONS.TASK_CHAINS_READ,
  PERMISSIONS.TASK_CHAINS_CREATE,
  PERMISSIONS.TASK_CHAINS_UPDATE,
  PERMISSIONS.TASK_CHAINS_CLOSE,
  PERMISSIONS.TASK_CHAINS_DELETE,
  PERMISSIONS.JOBHUB_WORK_READ,
  PERMISSIONS.JOBHUB_TASK_CREATE,
  PERMISSIONS.JOBHUB_TASK_UPDATE,
  PERMISSIONS.JOBHUB_CONFIG_STATUS_READ,
  PERMISSIONS.JOBHUB_CONFIG_TASK_TYPE_READ,
  PERMISSIONS.JOBHUB_CONFIG_CHANNEL_READ,
];

const MANAGER_PERMISSIONS = Array.from(
  new Set([
    ...STAFF_PERMISSIONS,
    PERMISSIONS.USERS_CREATE,
    PERMISSIONS.USERS_READ,
    PERMISSIONS.USERS_UPDATE,
    PERMISSIONS.USERS_DELETE,
    PERMISSIONS.USER_RESTORE,
    PERMISSIONS.USERS_PERMANENT_DELETE,
    PERMISSIONS.CUSTOMERS_DELETE,
    PERMISSIONS.CUSTOMER_RESTORE,
    PERMISSIONS.CUSTOMERS_PERMANENT_DELETE,
    PERMISSIONS.ORGANIZATION_READ,
    PERMISSIONS.ORGANIZATION_UPDATE,
    PERMISSIONS.ORGANIZATION_MANAGE,
    PERMISSIONS.ACTIONS_CFG_CREATE,
    PERMISSIONS.ACTIONS_CFG_UPDATE,
    PERMISSIONS.STAFFS_READ,
    PERMISSIONS.STAFFS_CREATE,
    PERMISSIONS.STAFFS_UPDATE,
    PERMISSIONS.STAFFS_DELETE,
    PERMISSIONS.FUNCTIONS_CREATE,
    PERMISSIONS.FUNCTIONS_UPDATE,
    PERMISSIONS.FUNCTIONS_DELETE,
    PERMISSIONS.FUNCTIONAL_GROUPS_CREATE,
    PERMISSIONS.FUNCTIONAL_GROUPS_UPDATE,
    PERMISSIONS.FUNCTIONAL_GROUPS_DELETE,
    PERMISSIONS.COMPANIES_READ,
    PERMISSIONS.COMPANIES_CREATE,
    PERMISSIONS.COMPANIES_UPDATE,
    PERMISSIONS.COMPANIES_DELETE,
    PERMISSIONS.JOBHUB_TASK_DELETE,
    PERMISSIONS.JOBHUB_FOLDER_CREATE,
    PERMISSIONS.JOBHUB_FOLDER_UPDATE,
    PERMISSIONS.JOBHUB_FOLDER_DELETE,
    PERMISSIONS.JOBHUB_CONFIG_REPEAT_RULE_READ,
    PERMISSIONS.JOBHUB_CONFIG_REPEAT_RULE_CREATE,
    PERMISSIONS.JOBHUB_CONFIG_REPEAT_RULE_UPDATE,
    PERMISSIONS.JOBHUB_CONFIG_REPEAT_RULE_DELETE,
    PERMISSIONS.JOBHUB_CONFIG_CHANNEL_READ,
    PERMISSIONS.JOBHUB_CONFIG_CHANNEL_CREATE,
    PERMISSIONS.JOBHUB_CONFIG_CHANNEL_UPDATE,
    PERMISSIONS.JOBHUB_CONFIG_CHANNEL_DELETE,
    PERMISSIONS.JOBHUB_CONFIG_TASK_TYPE_READ,
    PERMISSIONS.JOBHUB_CONFIG_TASK_TYPE_CREATE,
    PERMISSIONS.JOBHUB_CONFIG_TASK_TYPE_UPDATE,
    PERMISSIONS.JOBHUB_CONFIG_TASK_TYPE_DELETE,
    PERMISSIONS.JOBHUB_CONFIG_STATUS_READ,
    PERMISSIONS.JOBHUB_CONFIG_STATUS_CREATE,
    PERMISSIONS.JOBHUB_CONFIG_STATUS_UPDATE,
    PERMISSIONS.JOBHUB_CONFIG_STATUS_DELETE,
    PERMISSIONS.JOBHUB_CONFIG_READ,
  ]),
);

const ADMIN_PERMISSIONS = Array.from(
  new Set([
    ...MANAGER_PERMISSIONS,
    PERMISSIONS.USERS_MANAGE,
    PERMISSIONS.CUSTOMERS_MANAGE,
    PERMISSIONS.EVENTS_MANAGE,
    PERMISSIONS.EVENT_CHAINS_MANAGE,
    PERMISSIONS.ROLES_READ,
    PERMISSIONS.PERMISSIONS_READ,
    PERMISSIONS.FUNCTIONS_MANAGE,
    PERMISSIONS.ACTIONS_CFG_MANAGE,
    PERMISSIONS.LOGS_SYSTEM_READ,
    PERMISSIONS.LOGS_WEBHOOK_READ,
    PERMISSIONS.LOGS_AUTOMATION_READ,
    PERMISSIONS.META_MANAGE,
    PERMISSIONS.LEADS_CFG_MANAGE,
    PERMISSIONS.LEADS_MANAGE,
    PERMISSIONS.TASKS_MANAGE,
    PERMISSIONS.TASK_CHAINS_MANAGE,
    PERMISSIONS.STAFFS_MANAGE,
    PERMISSIONS.FINANCE_READ,
    PERMISSIONS.SALARIES_MANAGE,
    PERMISSIONS.REVENUES_MANAGE,
    PERMISSIONS.EXPENSES_MANAGE,
    PERMISSIONS.SALARY_CONFIGS_MANAGE,
    PERMISSIONS.COMPANIES_MANAGE,
    PERMISSIONS.JOBHUB_WORK_MANAGE,
    PERMISSIONS.JOBHUB_CONFIG_TASK_TYPE_GROUP_MANAGE,
  ]),
);

// Role definitions with their permissions
const ROLE_DEFINITIONS = {
  OWNER: {
    name: "OWNER",
    description: "Owner - Has all permissions",
    level: 4,
    permissions: Object.values(PERMISSIONS),
  },
  ADMIN: {
    name: "ADMIN",
    description: "Administrator - Can manage users, customers",
    level: 3,
    permissions: ADMIN_PERMISSIONS,
  },
  MANAGER: {
    name: "MANAGER",
    description: "Manager - Can create and manage staff, view customers",
    level: 2,
    permissions: MANAGER_PERMISSIONS,
  },
  STAFF: {
    name: "STAFF",
    description: "Staff - Can view and create customers",
    level: 1,
    permissions: STAFF_PERMISSIONS,
  },
};

// ─── Module-Level Access Control (MLAC) Definitions ────────────────────────────
// Defines the modules visible in the FE sidebar and the per-module permissions
// that can be granted to individual users.
// `parentKey` links sub-modules to their root module for sidebar grouping.

const MODULE_DEFINITIONS = {
  customers: {
    key: "customers",
    label: "Khách hàng",
    type: "root",
    actions: [],
  },
  "customers.biz": {
    key: "customers.biz",
    label: "Doanh nghiệp",
    type: "sub",
    parentKey: "customers",
    actions: ["view", "create", "edit", "delete", "export"],
  },
  "customers.user": {
    key: "customers.user",
    label: "Cá nhân",
    type: "sub",
    parentKey: "customers",
    actions: ["view", "create", "edit", "delete", "export"],
  },

  operations: {
    key: "operations",
    label: "Quản lý",
    type: "root",
    actions: [],
  },
  "operations.tasks": {
    key: "operations.tasks",
    label: "Quản lý Tác vụ",
    type: "sub",
    parentKey: "operations",
    actions: ["view", "create", "edit", "delete"],
  },
  "operations.events": {
    key: "operations.events",
    label: "Quản lý Sự kiện",
    type: "sub",
    parentKey: "operations",
    actions: ["view", "create", "edit", "delete", "configure"],
  },
  "operations.leads": {
    key: "operations.leads",
    label: "Quản lý Lead",
    type: "sub",
    parentKey: "operations",
    actions: ["view", "create", "edit", "delete", "configure"],
  },

  meta: { key: "meta", label: "Hợp tác Meta", type: "root", actions: [] },
  "meta.program": {
    key: "meta.program",
    label: "Chương trình",
    type: "sub",
    parentKey: "meta",
    actions: ["view", "create", "edit", "delete"],
  },
  "meta.config": {
    key: "meta.config",
    label: "Cấu hình",
    type: "sub",
    parentKey: "meta",
    actions: ["view", "create", "edit", "delete"],
  },

  staff: { key: "staff", label: "Nhân viên", type: "root", actions: [] },
  "staff.users": {
    key: "staff.users",
    label: "Tài khoản",
    type: "sub",
    parentKey: "staff",
    actions: ["view", "create", "edit", "delete"],
  },
  "staff.organization": {
    key: "staff.organization",
    label: "Sơ đồ tổ chức",
    type: "sub",
    parentKey: "staff",
    actions: ["view", "create", "edit"],
  },
  "staff.functions": {
    key: "staff.functions",
    label: "Chức năng",
    type: "sub",
    parentKey: "staff",
    actions: ["view", "create", "edit", "delete"],
  },
  "staff.functional_groups": {
    key: "staff.functional_groups",
    label: "Khối chức năng",
    type: "sub",
    parentKey: "staff",
    actions: ["view", "create", "edit", "delete"],
  },
  "staff.companies": {
    key: "staff.companies",
    label: "Công ty",
    type: "sub",
    parentKey: "staff",
    actions: ["view", "create", "edit", "delete"],
  },

  logs: { key: "logs", label: "Logs Hệ thống", type: "root", actions: [] },
  "logs.system": {
    key: "logs.system",
    label: "System Logs",
    type: "sub",
    parentKey: "logs",
    actions: ["view"],
  },
  "logs.webhook": {
    key: "logs.webhook",
    label: "Webhook Logs",
    type: "sub",
    parentKey: "logs",
    actions: ["view"],
  },
  "logs.blockautomation": {
    key: "logs.blockautomation",
    label: "Block Automation Logs",
    type: "sub",
    parentKey: "logs",
    actions: ["view"],
  },

  finance: { key: "finance", label: "Tài chính", type: "root", actions: [] },
  "finance.dashboard": {
    key: "finance.dashboard",
    label: "Tổng quan",
    type: "sub",
    parentKey: "finance",
    actions: ["view"],
  },
  "finance.revenue": {
    key: "finance.revenue",
    label: "Doanh thu",
    type: "sub",
    parentKey: "finance",
    actions: ["view", "create", "edit", "delete", "configure"],
  },
  "finance.expense": {
    key: "finance.expense",
    label: "Chi phí",
    type: "sub",
    parentKey: "finance",
    actions: ["view", "create", "edit", "delete", "configure"],
  },
  "finance.salary": {
    key: "finance.salary",
    label: "Lương",
    type: "sub",
    parentKey: "finance",
    actions: ["view", "create", "edit", "delete", "configure"],
  },
  "finance.salary_config": {
    key: "finance.salary_config",
    label: "Cấu hình lương",
    type: "sub",
    parentKey: "finance",
    actions: ["view", "create", "edit", "delete", "configure"],
  },

  jobhub: { key: "jobhub", label: "Job Hub", type: "root", actions: [] },
  "jobhub.tasks": {
    key: "jobhub.tasks",
    label: "Công việc",
    type: "sub",
    parentKey: "jobhub",
    actions: [
      "view",
      "create_task",
      "edit_task",
      "delete_task",
      "manage_folders",
    ],
  },
  "jobhub.config": {
    key: "jobhub.config",
    label: "Cấu hình",
    type: "sub",
    parentKey: "jobhub",
    actions: ["view"],
  },
  "jobhub.config.repeatRule": {
    key: "jobhub.config.repeatRule",
    label: "Quy tắc lặp lại",
    type: "sub-sub",
    parentKey: "jobhub.config",
    actions: ["view", "create", "edit", "delete"],
  },
  "jobhub.config.channel": {
    key: "jobhub.config.channel",
    label: "Kênh triển khai",
    type: "sub-sub",
    parentKey: "jobhub.config",
    actions: ["view", "create", "edit", "delete"],
  },
  "jobhub.config.taskType": {
    key: "jobhub.config.taskType",
    label: "Loại công việc",
    type: "sub-sub",
    parentKey: "jobhub.config",
    actions: ["view", "create", "edit", "delete", "configure"],
  },
  "jobhub.config.status": {
    key: "jobhub.config.status",
    label: "Trạng thái",
    type: "sub-sub",
    parentKey: "jobhub.config",
    actions: ["view", "create", "edit", "delete"],
  },
};

const MODULE_TO_PERMISSIONS_MAP = {
  "customers.biz": {
    view: [PERMISSIONS.CUSTOMERS_READ],
    create: [PERMISSIONS.CUSTOMERS_CREATE],
    edit: [PERMISSIONS.CUSTOMERS_UPDATE],
    delete: [PERMISSIONS.CUSTOMERS_DELETE],
    // "export": [PERMISSIONS.CUSTOMERS_READ]
  },
  "customers.user": {
    view: [PERMISSIONS.CUSTOMERS_READ],
    create: [PERMISSIONS.CUSTOMERS_CREATE],
    edit: [PERMISSIONS.CUSTOMERS_UPDATE],
    delete: [PERMISSIONS.CUSTOMERS_DELETE],
    // "export": [PERMISSIONS.CUSTOMERS_READ]
  },
  "operations.tasks": {
    view: [
      PERMISSIONS.TASKS_READ,
      PERMISSIONS.TASK_CHAINS_READ,
      PERMISSIONS.ACTIONS_CFG_READ,
      PERMISSIONS.USERS_READ,
    ],
    create: [PERMISSIONS.TASKS_CREATE, PERMISSIONS.TASK_CHAINS_CREATE],
    edit: [PERMISSIONS.TASKS_UPDATE, PERMISSIONS.TASK_CHAINS_UPDATE],
    delete: [PERMISSIONS.TASKS_DELETE, PERMISSIONS.TASK_CHAINS_DELETE],
  },
  "operations.events": {
    view: [
      PERMISSIONS.EVENTS_READ,
      PERMISSIONS.EVENT_CHAINS_READ,
      PERMISSIONS.ACTIONS_CFG_READ,
      PERMISSIONS.USERS_READ,
      PERMISSIONS.CUSTOMERS_READ,
    ],
    create: [
      PERMISSIONS.EVENTS_CREATE,
      PERMISSIONS.EVENT_CHAINS_CREATE,
      PERMISSIONS.CUSTOMERS_READ,
    ],
    edit: [PERMISSIONS.EVENTS_UPDATE, PERMISSIONS.EVENT_CHAINS_UPDATE],
    delete: [PERMISSIONS.EVENTS_DELETE, PERMISSIONS.EVENT_CHAINS_DELETE],
    configure: [PERMISSIONS.ACTIONS_CFG_MANAGE],
  },
  "operations.leads": {
    view: [
      PERMISSIONS.LEADS_READ,
      PERMISSIONS.ACTIONS_CFG_READ,
      PERMISSIONS.USERS_READ,
    ],
    create: [PERMISSIONS.LEADS_CREATE],
    edit: [PERMISSIONS.LEADS_UPDATE],
    delete: [PERMISSIONS.LEADS_DELETE],
    configure: [PERMISSIONS.LEADS_CFG_MANAGE],
  },
  "meta.program": {
    view: [PERMISSIONS.META_READ, PERMISSIONS.USERS_READ],
    create: [PERMISSIONS.META_CREATE],
    edit: [PERMISSIONS.META_UPDATE],
    delete: [PERMISSIONS.META_DELETE],
  },
  "meta.config": {
    view: [PERMISSIONS.META_READ],
    create: [PERMISSIONS.META_MANAGE],
    edit: [PERMISSIONS.META_MANAGE],
    delete: [PERMISSIONS.META_MANAGE],
  },
  "staff.users": {
    view: [PERMISSIONS.USERS_READ, PERMISSIONS.COMPANIES_READ],
    create: [PERMISSIONS.USERS_CREATE],
    edit: [PERMISSIONS.USERS_UPDATE],
    delete: [PERMISSIONS.USERS_DELETE],
  },
  "staff.organization": {
    view: [PERMISSIONS.ORGANIZATION_READ],
    create: [PERMISSIONS.ORGANIZATION_MANAGE, PERMISSIONS.ORGANIZATION_UPDATE],
    edit: [PERMISSIONS.ORGANIZATION_UPDATE],
  },
  "staff.functions": {
    view: [PERMISSIONS.FUNCTIONS_READ],
    create: [PERMISSIONS.FUNCTIONS_CREATE],
    edit: [PERMISSIONS.FUNCTIONS_UPDATE],
    delete: [PERMISSIONS.FUNCTIONS_DELETE],
  },
  "staff.functional_groups": {
    view: [PERMISSIONS.FUNCTIONAL_GROUPS_READ],
    create: [PERMISSIONS.FUNCTIONAL_GROUPS_CREATE],
    edit: [PERMISSIONS.FUNCTIONAL_GROUPS_UPDATE],
    delete: [PERMISSIONS.FUNCTIONAL_GROUPS_DELETE],
  },
  "staff.companies": {
    view: [PERMISSIONS.COMPANIES_READ],
    create: [PERMISSIONS.COMPANIES_CREATE],
    edit: [PERMISSIONS.COMPANIES_UPDATE],
    delete: [PERMISSIONS.COMPANIES_DELETE],
  },
  "logs.system": {
    view: [PERMISSIONS.LOGS_SYSTEM_READ],
  },
  "logs.webhook": {
    view: [PERMISSIONS.LOGS_WEBHOOK_READ],
  },
  "logs.blockautomation": {
    view: [PERMISSIONS.LOGS_AUTOMATION_READ],
  },
  "finance.dashboard": {
    view: [PERMISSIONS.FINANCE_READ],
  },
  "finance.revenue": {
    view: [PERMISSIONS.REVENUES_READ],
    create: [PERMISSIONS.REVENUES_CREATE],
    edit: [PERMISSIONS.REVENUES_UPDATE],
    delete: [PERMISSIONS.REVENUES_DELETE],
    configure: [PERMISSIONS.REVENUES_MANAGE],
  },
  "finance.expense": {
    view: [PERMISSIONS.EXPENSES_READ],
    create: [PERMISSIONS.EXPENSES_CREATE],
    edit: [PERMISSIONS.EXPENSES_UPDATE],
    delete: [PERMISSIONS.EXPENSES_DELETE],
    configure: [PERMISSIONS.EXPENSES_CONFIG, PERMISSIONS.EXPENSES_MANAGE],
  },
  "finance.salary": {
    view: [PERMISSIONS.SALARIES_READ],
    create: [PERMISSIONS.SALARIES_CREATE],
    edit: [PERMISSIONS.SALARIES_UPDATE],
    delete: [PERMISSIONS.SALARIES_DELETE],
    configure: [PERMISSIONS.SALARIES_MANAGE],
  },
  "finance.salary_config": {
    view: [
      PERMISSIONS.SALARY_CONFIGS_READ,
      PERMISSIONS.STAFFS_READ,
      PERMISSIONS.COMPANIES_READ,
      PERMISSIONS.FUNCTIONS_READ,
      PERMISSIONS.FUNCTIONAL_GROUPS_READ,
    ],
    create: [PERMISSIONS.SALARY_CONFIGS_CREATE, PERMISSIONS.STAFFS_CREATE],
    edit: [PERMISSIONS.SALARY_CONFIGS_UPDATE, PERMISSIONS.STAFFS_UPDATE],
    delete: [PERMISSIONS.SALARY_CONFIGS_DELETE, PERMISSIONS.STAFFS_DELETE],
    configure: [PERMISSIONS.SALARY_CONFIGS_MANAGE, PERMISSIONS.STAFFS_MANAGE],
  },
  "jobhub.tasks": {
    view: [
      PERMISSIONS.JOBHUB_WORK_READ,
      PERMISSIONS.JOBHUB_CONFIG_STATUS_READ,
      PERMISSIONS.JOBHUB_CONFIG_TASK_TYPE_READ,
      PERMISSIONS.JOBHUB_CONFIG_CHANNEL_READ,
      PERMISSIONS.JOBHUB_CONFIG_TASK_TYPE_GROUP_READ,
    ],
    create_task: [PERMISSIONS.JOBHUB_TASK_CREATE],
    edit_task: [PERMISSIONS.JOBHUB_TASK_UPDATE],
    delete_task: [PERMISSIONS.JOBHUB_TASK_DELETE],
    manage_folders: [
      PERMISSIONS.JOBHUB_FOLDER_CREATE,
      PERMISSIONS.JOBHUB_FOLDER_UPDATE,
      PERMISSIONS.JOBHUB_FOLDER_DELETE,
    ],
  },
  "jobhub.config": {
    view: [PERMISSIONS.JOBHUB_CONFIG_READ],
  },
  "jobhub.config.repeatRule": {
    view: [
      PERMISSIONS.JOBHUB_CONFIG_REPEAT_RULE_READ,
      PERMISSIONS.JOBHUB_CONFIG_TASK_TYPE_READ,
      PERMISSIONS.JOBHUB_CONFIG_CHANNEL_READ,
    ],
    create: [PERMISSIONS.JOBHUB_CONFIG_REPEAT_RULE_CREATE],
    edit: [PERMISSIONS.JOBHUB_CONFIG_REPEAT_RULE_UPDATE],
    delete: [PERMISSIONS.JOBHUB_CONFIG_REPEAT_RULE_DELETE],
  },
  "jobhub.config.channel": {
    view: [PERMISSIONS.JOBHUB_CONFIG_CHANNEL_READ],
    create: [PERMISSIONS.JOBHUB_CONFIG_CHANNEL_CREATE],
    edit: [PERMISSIONS.JOBHUB_CONFIG_CHANNEL_UPDATE],
    delete: [PERMISSIONS.JOBHUB_CONFIG_CHANNEL_DELETE],
  },
  "jobhub.config.taskType": {
    view: [PERMISSIONS.JOBHUB_CONFIG_TASK_TYPE_READ],
    create: [PERMISSIONS.JOBHUB_CONFIG_TASK_TYPE_CREATE],
    edit: [PERMISSIONS.JOBHUB_CONFIG_TASK_TYPE_UPDATE],
    delete: [PERMISSIONS.JOBHUB_CONFIG_TASK_TYPE_DELETE],
    configure: [PERMISSIONS.JOBHUB_CONFIG_TASK_TYPE_MANAGE],
  },
  "jobhub.config.status": {
    view: [PERMISSIONS.JOBHUB_CONFIG_STATUS_READ],
    create: [PERMISSIONS.JOBHUB_CONFIG_STATUS_CREATE],
    edit: [PERMISSIONS.JOBHUB_CONFIG_STATUS_UPDATE],
    delete: [PERMISSIONS.JOBHUB_CONFIG_STATUS_DELETE],
  },
};

const VALID_ASSIGNABLE_PERMISSIONS = Array.from(
  new Set(
    Object.values(MODULE_TO_PERMISSIONS_MAP).flatMap((actionMap) =>
      Object.values(actionMap).flat(),
    ),
  ),
);

module.exports = {
  RESOURCES,
  ACTIONS,
  PERMISSIONS,
  ROLE_DEFINITIONS,
  MODULE_DEFINITIONS,
  MODULE_TO_PERMISSIONS_MAP,
  VALID_ASSIGNABLE_PERMISSIONS,
};
