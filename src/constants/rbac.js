/**
 * RBAC Permission Definitions
 * Format: RESOURCE_ACTION
 */

// Resources
const RESOURCES = {
  USERS: "users",
  CUSTOMERS: "customers",
  EVENTS: "events",
  EVENT_CHAINS: "event_chains",   // Chuỗi hành động trong sự kiện
  TASKS: "tasks",                  // Quản lý Tác vụ
  TASK_CHAINS: "task_chains",      // Chuỗi hành động trong tác vụ
  ACTIONS_CFG: "actions_cfg",
  ORGANIZATION: "organization",
  ROLES: "roles",
  PERMISSIONS: "permissions",
  METADATA: "metadata",
  FUNCTIONS: "functions",
  LOGS: "logs",                   // System / Automation / Webhook logs (read-only)
  META: "meta",                    // Meta integration programs
  LEADS_CFG: "leads_cfg",         // Cấu hình trạng thái Lead
  LEADS: "leads",                  // Quản lý Lead
};

// Actions
const ACTIONS = {
  CREATE: "create",
  READ: "read",
  UPDATE: "update",
  DELETE: "delete",
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

  // Actions Config (actions, results, reasons, action chains)
  ACTIONS_CFG_CREATE: `${RESOURCES.ACTIONS_CFG}_${ACTIONS.CREATE}`,
  ACTIONS_CFG_READ: `${RESOURCES.ACTIONS_CFG}_${ACTIONS.READ}`,
  ACTIONS_CFG_UPDATE: `${RESOURCES.ACTIONS_CFG}_${ACTIONS.UPDATE}`,
  ACTIONS_CFG_DELETE: `${RESOURCES.ACTIONS_CFG}_${ACTIONS.DELETE}`,
  ACTIONS_CFG_MANAGE: `${RESOURCES.ACTIONS_CFG}_${ACTIONS.MANAGE}`,

  // Logs (read-only — append-only audit trail, no create/update/delete via API)
  LOGS_READ: `${RESOURCES.LOGS}_${ACTIONS.READ}`,

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
};

const STAFF_PERMISSIONS = [
  PERMISSIONS.CUSTOMERS_READ,
  PERMISSIONS.CUSTOMERS_CREATE,
  PERMISSIONS.CUSTOMERS_UPDATE,
  PERMISSIONS.CUSTOMERS_DELETE,
  PERMISSIONS.EVENTS_READ,
  PERMISSIONS.EVENTS_CREATE,
  PERMISSIONS.EVENTS_UPDATE,      // Có thể update event được assign cho mình
  PERMISSIONS.EVENTS_DELETE,
  PERMISSIONS.EVENT_CHAINS_READ,
  PERMISSIONS.EVENT_CHAINS_CREATE,
  PERMISSIONS.EVENT_CHAINS_UPDATE,
  PERMISSIONS.EVENT_CHAINS_CLOSE,
  PERMISSIONS.EVENT_CHAINS_DELETE,
  PERMISSIONS.METADATA_READ,
  PERMISSIONS.FUNCTIONS_READ,
  PERMISSIONS.ACTIONS_CFG_READ,
  PERMISSIONS.ACTIONS_CFG_UPDATE,
  PERMISSIONS.META_READ,
  PERMISSIONS.META_CREATE,
  PERMISSIONS.META_UPDATE,
  PERMISSIONS.META_DELETE,
  PERMISSIONS.LEADS_READ,
  PERMISSIONS.LEADS_CREATE,
  PERMISSIONS.LEADS_UPDATE,      // Có thể update lead được assign cho mình
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
];

const MANAGER_PERMISSIONS = Array.from(new Set([
  ...STAFF_PERMISSIONS,
  PERMISSIONS.USERS_CREATE,
  PERMISSIONS.USERS_READ,
  PERMISSIONS.USERS_UPDATE,
  PERMISSIONS.USERS_DELETE,
  PERMISSIONS.ORGANIZATION_READ,
  PERMISSIONS.ACTIONS_CFG_CREATE,
]));

const ADMIN_PERMISSIONS = Array.from(new Set([
  ...MANAGER_PERMISSIONS,
  PERMISSIONS.USERS_MANAGE,
  PERMISSIONS.CUSTOMERS_MANAGE,
  PERMISSIONS.EVENTS_MANAGE,
  PERMISSIONS.EVENT_CHAINS_MANAGE,
  PERMISSIONS.ROLES_READ,
  PERMISSIONS.PERMISSIONS_READ,
  PERMISSIONS.FUNCTIONS_MANAGE,
  PERMISSIONS.ACTIONS_CFG_MANAGE,
  PERMISSIONS.LOGS_READ,
  PERMISSIONS.META_MANAGE,
  PERMISSIONS.LEADS_CFG_MANAGE,
  PERMISSIONS.LEADS_MANAGE,
  PERMISSIONS.TASKS_MANAGE,
  PERMISSIONS.TASK_CHAINS_MANAGE,
]));

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
    description:
      "Manager - Can create and manage staff, view customers",
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
  customers: { key: "customers", label: "Khách hàng", type: "root", actions: [] },
  "customers.biz": { key: "customers.biz", label: "Doanh nghiệp", type: "sub", parentKey: "customers", actions: ["view", "create", "edit", "delete", "export"] },
  "customers.user": { key: "customers.user", label: "Cá nhân", type: "sub", parentKey: "customers", actions: ["view", "create", "edit", "delete", "export"] },

  operations: { key: "operations", label: "Quản lý", type: "root", actions: [] },
  "operations.tasks": { key: "operations.tasks", label: "Quản lý Tác vụ", type: "sub", parentKey: "operations", actions: ["view", "create", "edit", "delete"] },
  "operations.events": { key: "operations.events", label: "Quản lý Sự kiện", type: "sub", parentKey: "operations", actions: ["view", "create", "edit", "delete", "configure"] },
  "operations.leads": { key: "operations.leads", label: "Quản lý Lead", type: "sub", parentKey: "operations", actions: ["view", "create", "edit", "delete", "configure"] },

  meta: { key: "meta", label: "Hợp tác Meta", type: "root", actions: ["view", "create", "edit", "delete"] },

  staff: { key: "staff", label: "Nhân viên", type: "root", actions: [] },
  "staff.users": { key: "staff.users", label: "Tài khoản", type: "sub", parentKey: "staff", actions: ["view", "create", "edit", "delete"] },
  "staff.organization": { key: "staff.organization", label: "Sơ đồ tổ chức", type: "sub", parentKey: "staff", actions: ["view", "create", "edit"] },
  "staff.functions": { key: "staff.functions", label: "Chức năng", type: "sub", parentKey: "staff", actions: ["view", "create", "edit", "delete"] },

  logs: { key: "logs", label: "Logs Hệ thống", type: "root", actions: [] },
  "logs.system": { key: "logs.system", label: "System Logs", type: "sub", parentKey: "logs", actions: ["view"] },
  "logs.webhook": { key: "logs.webhook", label: "Webhook Logs", type: "sub", parentKey: "logs", actions: ["view"] },
  "logs.blockautomation": { key: "logs.blockautomation", label: "Block Automation Logs", type: "sub", parentKey: "logs", actions: ["view"] },
};

const MODULE_TO_PERMISSIONS_MAP = {
  "customers.biz": {
    "view": ["customers_read"],
    "create": ["customers_create"],
    "edit": ["customers_update"],
    "delete": ["customers_delete"],
    "export": ["customers_read"]
  },
  "customers.user": {
    "view": ["customers_read"],
    "create": ["customers_create"],
    "edit": ["customers_update"],
    "delete": ["customers_delete"],
    "export": ["customers_read"]
  },
  "operations.tasks": {
    "view": ["tasks_read", "task_chains_read", "actions_cfg_read"],
    "create": ["tasks_create", "task_chains_create"],
    "edit": ["tasks_update", "task_chains_update"],
    "delete": ["tasks_delete", "task_chains_delete"]
  },
  "operations.events": {
    "view": ["events_read", "event_chains_read", "actions_cfg_read"],
    "create": ["events_create", "event_chains_create"],
    "edit": ["events_update", "event_chains_update"],
    "delete": ["events_delete", "event_chains_delete"],
    "configure": ["actions_cfg_read", "actions_cfg_update", "actions_cfg_create", "actions_cfg_delete"]
  },
  "operations.leads": {
    "view": ["leads_read", "actions_cfg_read"],
    "create": ["leads_create"],
    "edit": ["leads_update"],
    "delete": ["leads_delete"],
    "configure": ["leads_cfg_manage"]
  },
  "meta": {
    "view": ["meta_read"],
    "create": ["meta_create"],
    "edit": ["meta_update"],
    "delete": ["meta_delete"]
  },
  "staff.users": {
    "view": ["users_read"],
    "create": ["users_create"],
    "edit": ["users_update"],
    "delete": ["users_delete"]
  },
  "staff.organization": {
    "view": ["organization_read"],
    "create": ["organization_manage", "organization_update"],
    "edit": ["organization_update"]
  },
  "staff.functions": {
    "view": ["functions_read"],
    "create": ["functions_create"],
    "edit": ["functions_update"],
    "delete": ["functions_delete"]
  },
  "logs.system": {
    "view": ["logs_read"]
  },
  "logs.webhook": {
    "view": ["logs_read"]
  },
  "logs.blockautomation": {
    "view": ["logs_read"]
  }
};

const VALID_ASSIGNABLE_PERMISSIONS = Array.from(new Set(
  Object.values(MODULE_TO_PERMISSIONS_MAP).flatMap(actionMap =>
    Object.values(actionMap).flat()
  )
));

module.exports = {
  RESOURCES,
  ACTIONS,
  PERMISSIONS,
  ROLE_DEFINITIONS,
  MODULE_DEFINITIONS,
  MODULE_TO_PERMISSIONS_MAP,
  VALID_ASSIGNABLE_PERMISSIONS,
};
