# RBAC (Role-Based Access Control) Implementation Guide

## Overview

The CRM Server now implements a comprehensive Role-Based Access Control (RBAC) system that replaces the previous simple role-based authorization. This system provides:

- **Fine-grained permissions** based on resources and actions
- **Role-permission mapping** for flexible authorization
- **System roles** that cannot be modified (OWNER, ADMIN, MANAGER, STAFF)
- **Custom permissions** support for individual users
- **Permission hierarchies** for better access management

## Architecture

### Core Components

1. **Permission Model** (`src/models/Permission.js`)
   - Stores individual permissions
   - Format: `{resource}_{action}` (e.g., `users_create`)
   - Properties: id, name, description, resource, action, createdBy

2. **Role Model** (`src/models/Role.js`)
   - Maps permissions to roles
   - Contains permission IDs array
   - Properties: id, name, description, permissions[], level, isSystem, createdBy

3. **User Model** (Updated)
   - Added `roleId` field to reference roles
   - Added `permissions[]` field for custom permissions
   - Maintains backward compatibility with `role` field

### RBAC Components Location

- **Constants**: `src/constants/rbac.js`
  - RESOURCES: Resource types
  - ACTIONS: Action types
  - PERMISSIONS: All available permissions
  - ROLE_DEFINITIONS: Default role configurations

- **Utilities**: `src/utils/rbac.js`
  - `hasPermission()`: Check single permission
  - `hasAnyPermission()`: Check if user has any of multiple permissions
  - `hasAllPermissions()`: Check if user has all permissions
  - `getUserRoleWithPermissions()`: Get user's role with all permissions
  - `getUserPermissions()`: Get all permissions for a user

- **Middleware**: `src/middleware/auth.js`
  - `authenticateRequest`: Existing authentication middleware
  - `authorizeRoles()`: Legacy role-based authorization (still supported)
  - `requirePermission()`: New permission-based authorization

## Supported Permissions

### Resources & Actions

Each resource supports the following actions:

- **CREATE**: Create new items
- **READ**: View items
- **UPDATE**: Modify items
- **DELETE**: Remove items
- **MANAGE**: Full control (includes all other actions)

### Available Permissions

#### Users

- `users_create`
- `users_read`
- `users_update`
- `users_delete`
- `users_manage`

#### Customers

- `customers_create`
- `customers_read`
- `customers_update`
- `customers_delete`
- `customers_manage`

#### Leads

- `leads_create`
- `leads_read`
- `leads_update`
- `leads_delete`
- `leads_manage`

#### Tasks

- `tasks_create`
- `tasks_read`
- `tasks_update`
- `tasks_delete`
- `tasks_manage`

#### Organization

- `organization_read`
- `organization_update`
- `organization_manage`

#### Roles & Permissions Management

- `roles_create`
- `roles_read`
- `roles_update`
- `roles_delete`
- `roles_manage`
- `permissions_read`
- `permissions_manage`

#### Metadata & Functions

- `metadata_read`
- `functions_create`
- `functions_read`
- `functions_update`
- `functions_delete`
- `functions_manage`

## Default System Roles

### OWNER (Level 4)

- Has ALL permissions
- Cannot be deleted or modified
- Default: No user has this role by default

### ADMIN (Level 3)

- Manages users, customers, leads, tasks
- Can manage staff functions
- Cannot access role management (except read)
- Permissions: users_manage, customers_manage, leads_manage, tasks_manage, organization_read, functions_manage

### MANAGER (Level 2)

- Create and manage staff
- View and manage customers and leads
- Manage tasks
- Cannot delete users
- Cannot access role management

### STAFF (Level 1)

- View customers, leads, tasks
- Create own tasks and customers/leads
- Cannot manage other staff
- Cannot access role management

## Usage Examples

### Basic Permission Check in Route

```javascript
const { requirePermission } = require("../middleware/auth");
const { PERMISSIONS } = require("../constants/rbac");

// Single permission
router.get("/", requirePermission(PERMISSIONS.USERS_READ), async (req, res) => {
  // Only users with users_read permission can access
});

// Multiple permissions (ANY)
router.post(
  "/",
  requirePermission(
    [PERMISSIONS.USERS_CREATE, PERMISSIONS.USERS_MANAGE],
    "any",
  ),
  async (req, res) => {
    // User needs either users_create OR users_manage
  },
);

// Multiple permissions (ALL)
router.put(
  "/:id",
  requirePermission(
    [PERMISSIONS.USERS_UPDATE, PERMISSIONS.ORGANIZATION_MANAGE],
    "all",
  ),
  async (req, res) => {
    // User needs BOTH permissions
  },
);
```

### Programmatic Permission Check

```javascript
const { hasPermission, getUserPermissions } = require("../utils/rbac");
const { PERMISSIONS } = require("../constants/rbac");

// Check single permission
if (await hasPermission(user, PERMISSIONS.USERS_DELETE)) {
  // User can delete users
}

// Get all user permissions
const allPermissions = await getUserPermissions(user);
console.log(allPermissions); // Array of permission IDs
```

## API Endpoints

### RBAC Management Routes (`/api/rbac`)

#### Permissions

- `GET /api/rbac` - List all permissions (requires `permissions_read`)
- `GET /api/rbac/:id` - Get permission details

#### Roles

- `GET /api/rbac/roles` - List all roles (requires `roles_read`)
- `GET /api/rbac/roles/:id` - Get role with permissions (requires `roles_read`)
- `POST /api/rbac/roles` - Create new role (requires `roles_manage`)
- `PUT /api/rbac/roles/:id` - Update role (requires `roles_manage`)
- `DELETE /api/rbac/roles/:id` - Delete role (requires `roles_manage`)

### Users Route (Updated)

- `GET /api/users` - List users (requires `users_read`)
- `POST /api/users` - Create user (requires `users_create`)
- `PUT /api/users/:id` - Update user (requires `users_update`)
- `DELETE /api/users/:id` - Delete user (requires `users_delete`)

## Migration from Old System

The system automatically migrates existing users during server startup:

1. **Automatic Mapping**: Users with `role` field are automatically assigned corresponding `roleId`
   - `OWNER` → `roleId: "owner"`
   - `ADMIN` → `roleId: "admin"`
   - `MANAGER` → `roleId: "manager"`
   - `STAFF` → `roleId: "staff"`

2. **Backward Compatibility**: The old `role` field is preserved
   - Existing code using `req.user.role` continues to work
   - New code should use permission checks via `requirePermission()`

3. **One-Time Setup**: Seeds run automatically on first server startup
   - All permissions are created
   - All system roles are created
   - Existing users are migrated

## Adding Custom Permissions to Users

### Method 1: Via Direct User Update

```javascript
const user = await User.findOne({ id: userId });
user.permissions.push(customPermissionId); // Add custom permission
await user.save();
```

### Method 2: Via API (if implemented)

```bash
PUT /api/users/:id
{
  "permissions": ["users_create", "custom_permission_id"]
}
```

## Creating Custom Roles

```javascript
const { Post } = require("../routes/rbac");

POST /api/rbac/roles
{
  "id": "custom_role",
  "name": "Custom Role",
  "description": "Custom role description",
  "permissions": ["users_read", "customers_read", "leads_read"],
  "level": 2
}
```

## Best Practices

1. **Always use permission checks** instead of role checks for authorization

   ```javascript
   // ❌ Old way (avoid)
   if (user.role === "ADMIN") { ... }

   // ✅ New way (recommended)
   if (await hasPermission(user, PERMISSIONS.USERS_MANAGE)) { ... }
   ```

2. **Use middleware for route protection**

   ```javascript
   router.delete("/:id", requirePermission(PERMISSIONS.USERS_DELETE), handler);
   ```

3. **Assign specific "manage" permission** for full resource control

   ```javascript
   // Better than having to check 5 individual permissions
   requirePermission(PERMISSIONS.CUSTOMERS_MANAGE);
   ```

4. **Keep roles focused** - Don't assign unnecessary permissions to roles

5. **Use role levels** for hierarchical checks when needed
   ```javascript
   // If needed for legacy logic
   const role = await getUserRoleWithPermissions(user);
   if (role.level >= 3) { ... }
   ```

## Troubleshooting

### Permission Denied Error

```json
{
  "code": "INSUFFICIENT_PERMISSION",
  "requiredPermissions": ["users_manage"]
}
```

**Solution**: Ensure user's role has the required permission or add it manually.

### Migration Issues

If users are not automatically assigned roleId during startup:

```javascript
// Run manually in a controller or script
const { migrateUsersToRbac } = require("./services/rbacSeed");
await migrateUsersToRbac();
```

### Custom Permissions Not Working

Ensure the permission ID exists:

```javascript
// Check if permission exists
const permission = await Permission.findOne({ id: customPermissionId });
if (!permission) {
  // Create it first
  const newPerm = new Permission({
    id: customPermissionId,
    name: "Custom Permission",
    description: "...",
    resource: "resource_name",
    action: "action_name",
  });
  await newPerm.save();
}
```

## Next Steps

1. Update all existing routes to use `requirePermission()`
2. Test RBAC with different user roles
3. Monitor logs for permission violations
4. Adjust role definitions based on real-world usage
5. Consider implementing custom audit logging for permission checks
