/**
 * Full Permission Scan Script v2
 * Uses AST-like multi-line parsing for accurate extraction.
 */

const fs = require('fs');
const path = require('path');

const {
  PERMISSIONS,
  ROLE_DEFINITIONS,
  MODULE_DEFINITIONS,
  MODULE_TO_PERMISSIONS_MAP,
} = require('../src/core/constants/rbac');

const routesDir = path.join(__dirname, '..', 'src', 'routes', 'v1');
const indexPath = path.join(routesDir, 'index.js');

// ─── Parse index.js to get route prefixes ───────────────────────────────────
function parseRouteIndex() {
  const content = fs.readFileSync(indexPath, 'utf8');
  const prefixMap = {};
  // Match: router.use("/xxx", authenticateRequest, xxxRoutes);
  // or: router.use("/xxx", xxxRoutes);
  const regex = /router\.use\s*\(\s*["'`]([^"'`]+)["'`]\s*,\s*(?:authenticateRequest\s*,\s*)?(\w+)/g;
  let m;
  while ((m = regex.exec(content)) !== null) {
    prefixMap[m[2]] = m[1];
  }
  return prefixMap;
}

// ─── Parse a single route file ──────────────────────────────────────────────
function parseRouteFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const endpoints = [];

  // Match router.METHOD(...) blocks. They can span multiple lines.
  // Strategy: find "router.get(" etc, then extract everything until the closing ");"
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const methodMatch = line.match(/router\.(get|post|put|patch|delete)\s*\(/i);
    if (!methodMatch) continue;

    const method = methodMatch[1].toUpperCase();

    // Collect the full statement (may span multiple lines)
    let fullStatement = '';
    let depth = 0;
    let started = false;
    for (let j = i; j < lines.length && j < i + 20; j++) {
      fullStatement += lines[j] + ' ';
      for (const ch of lines[j]) {
        if (ch === '(') { depth++; started = true; }
        if (ch === ')') depth--;
      }
      if (started && depth <= 0) break;
    }

    // Extract route path
    const pathMatch = fullStatement.match(/router\.\w+\s*\(\s*["'`]([^"'`]+)["'`]/);
    const routePath = pathMatch ? pathMatch[1] : '???';

    // Extract permissions
    const permMatches = [...fullStatement.matchAll(/PERMISSIONS\.([A-Z_]+)/g)];
    const permissions = permMatches.map(m => ({
      key: m[1],
      value: PERMISSIONS[m[1]],
    })).filter(p => p.value); // Only include valid permissions

    // Extract roles
    const roleMatch = fullStatement.match(/requireRole\s*\(\s*\[([^\]]+)\]/);
    const roles = roleMatch ? roleMatch[1].replace(/["'\s]/g, '').split(',') : [];

    // Check if it has requirePermission or requireRole
    const hasPermission = fullStatement.includes('requirePermission');
    const hasRole = fullStatement.includes('requireRole');

    endpoints.push({
      file: path.basename(filePath),
      method,
      path: routePath,
      permissions,
      roles,
      hasPermissionCheck: hasPermission || hasRole,
      lineNumber: i + 1,
    });
  }

  return endpoints;
}

// ─── Main ───────────────────────────────────────────────────────────────────
const prefixMap = parseRouteIndex();

const routeFiles = fs.readdirSync(routesDir).filter(f => f.endsWith('.routes.js'));
let allEndpoints = [];
const permissionsUsedInRoutes = new Set();

for (const file of routeFiles) {
  const filePath = path.join(routesDir, file);
  const endpoints = parseRouteFile(filePath);
  
  // Find prefix for this file
  const varName = file.replace('.routes.js', '').replace(/[^a-zA-Z]/g, '') + 'Routes';
  
  endpoints.forEach(e => {
    e.permissions.forEach(p => permissionsUsedInRoutes.add(p.value));
  });
  
  allEndpoints = allEndpoints.concat(endpoints);
}

// ─── Build reverse maps ─────────────────────────────────────────────────────
const permissionToModules = {};
for (const [moduleKey, actionMap] of Object.entries(MODULE_TO_PERMISSIONS_MAP)) {
  for (const [action, perms] of Object.entries(actionMap)) {
    for (const perm of perms) {
      if (!perm) continue;
      if (!permissionToModules[perm]) permissionToModules[perm] = [];
      permissionToModules[perm].push({ module: moduleKey, action });
    }
  }
}

const permissionToRoles = {};
for (const [roleName, roleDef] of Object.entries(ROLE_DEFINITIONS)) {
  for (const perm of roleDef.permissions) {
    if (!perm) continue;
    if (!permissionToRoles[perm]) permissionToRoles[perm] = [];
    permissionToRoles[perm].push(roleName);
  }
}

// ─── Analysis ───────────────────────────────────────────────────────────────

// All permissions granted through MODULE_TO_PERMISSIONS_MAP
const allModulePermissions = new Set();
for (const actionMap of Object.values(MODULE_TO_PERMISSIONS_MAP)) {
  for (const perms of Object.values(actionMap)) {
    perms.forEach(p => { if (p) allModulePermissions.add(p); });
  }
}

// 1. Unprotected endpoints (no requirePermission/requireRole)
const unprotectedEndpoints = allEndpoints.filter(e => !e.hasPermissionCheck);

// 2. Permissions used in routes but not in MODULE_TO_PERMISSIONS_MAP
const orphanPermissions = [...permissionsUsedInRoutes].filter(p => !allModulePermissions.has(p));

// 3. Permissions defined but never used in routes
const allDefinedPerms = Object.values(PERMISSIONS);
const unusedPermissions = allDefinedPerms.filter(p => !permissionsUsedInRoutes.has(p));

// 4. Modules defined but missing permission mapping
const modulesMissingPermMap = Object.keys(MODULE_DEFINITIONS).filter(
  k => MODULE_DEFINITIONS[k].type !== 'root' && !MODULE_TO_PERMISSIONS_MAP[k]
);

// 5. Role-Module gap analysis
function hasPermInRole(rolePerms, perm) {
  if (!perm) return true;
  if (rolePerms.has(perm)) return true;
  const lastUnderscore = perm.lastIndexOf('_');
  if (lastUnderscore > 0) {
    const resource = perm.slice(0, lastUnderscore);
    if (rolePerms.has(`${resource}_manage`)) return true;
  }
  return false;
}

const roleModuleGaps = {};
for (const [roleName, roleDef] of Object.entries(ROLE_DEFINITIONS)) {
  if (roleName === 'OWNER') continue;
  const rolePermSet = new Set(roleDef.permissions);
  const gaps = {};

  for (const [moduleKey, actionMap] of Object.entries(MODULE_TO_PERMISSIONS_MAP)) {
    for (const [action, perms] of Object.entries(actionMap)) {
      const missing = perms.filter(p => !hasPermInRole(rolePermSet, p));
      if (missing.length > 0) {
        if (!gaps[moduleKey]) gaps[moduleKey] = {};
        gaps[moduleKey][action] = missing;
      }
    }
  }
  roleModuleGaps[roleName] = gaps;
}

// 6. Cross-dependency analysis: find cases where module view needs permissions
// from OTHER modules (the root cause of the user's problem)
const crossModuleDeps = {};
for (const [moduleKey, actionMap] of Object.entries(MODULE_TO_PERMISSIONS_MAP)) {
  const moduleDef = MODULE_DEFINITIONS[moduleKey];
  if (!moduleDef) continue;

  for (const [action, perms] of Object.entries(actionMap)) {
    for (const perm of perms) {
      if (!perm) continue;
      // Find which OTHER module this permission "belongs" to
      const otherModules = Object.entries(MODULE_TO_PERMISSIONS_MAP)
        .filter(([mk]) => mk !== moduleKey)
        .filter(([, am]) => 
          Object.values(am).some(ps => ps.includes(perm))
        )
        .map(([mk]) => mk);
      
      if (otherModules.length > 0) {
        if (!crossModuleDeps[moduleKey]) crossModuleDeps[moduleKey] = {};
        if (!crossModuleDeps[moduleKey][action]) crossModuleDeps[moduleKey][action] = [];
        crossModuleDeps[moduleKey][action].push({
          permission: perm,
          neededFromModules: otherModules,
        });
      }
    }
  }
}

// ─── Output ─────────────────────────────────────────────────────────────────

const report = {
  summary: {
    totalRouteFiles: routeFiles.length,
    totalEndpoints: allEndpoints.length,
    totalPermissionsUsedInRoutes: permissionsUsedInRoutes.size,
    totalPermissionsDefined: allDefinedPerms.length,
    unprotectedEndpoints: unprotectedEndpoints.length,
    orphanPermissions: orphanPermissions.length,
    unusedPermissions: unusedPermissions.length,
    modulesMissingPermMap: modulesMissingPermMap.length,
  },
  unprotectedEndpoints: unprotectedEndpoints.map(e => ({
    method: e.method, path: e.path, file: e.file, line: e.lineNumber,
  })),
  orphanPermissions,
  unusedPermissions,
  modulesMissingPermMap,
  crossModuleDeps,
  roleModuleGaps,
  allEndpoints: allEndpoints.map(e => ({
    method: e.method,
    path: e.path,
    file: e.file,
    line: e.lineNumber,
    permissions: e.permissions.map(p => p.value),
    roles: e.roles,
    protected: e.hasPermissionCheck,
  })),
};

const outputPath = path.join(__dirname, '..', 'permission_scan_report.json');
fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));

// ─── Console output ─────────────────────────────────────────────────────────

console.log('='.repeat(80));
console.log('PERMISSION SCAN REPORT');
console.log('='.repeat(80));

console.log('\n📊 SUMMARY:');
console.log(JSON.stringify(report.summary, null, 2));

console.log('\n\n🔓 UNPROTECTED ENDPOINTS (no requirePermission/requireRole):');
if (unprotectedEndpoints.length === 0) {
  console.log('  ✅ None found');
} else {
  unprotectedEndpoints.forEach(e => {
    console.log(`  ⚠️  ${e.method} ${e.path} → ${e.file}:${e.lineNumber}`);
  });
}

console.log('\n\n🔗 CROSS-MODULE PERMISSION DEPENDENCIES:');
console.log('  (Modules that require permissions from OTHER modules)');
for (const [mod, actions] of Object.entries(crossModuleDeps)) {
  for (const [action, deps] of Object.entries(actions)) {
    for (const dep of deps) {
      console.log(`  📌 ${mod}.${action} needs "${dep.permission}" from: ${dep.neededFromModules.join(', ')}`);
    }
  }
}

console.log('\n\n🧩 ORPHAN PERMISSIONS (used in routes but NOT in MODULE_TO_PERMISSIONS_MAP):');
orphanPermissions.forEach(p => console.log(`  ❌ ${p}`));

console.log('\n\n🗑️  UNUSED PERMISSIONS (defined but never enforced in any route):');
unusedPermissions.forEach(p => console.log(`  ⚪ ${p}`));

console.log('\n\n📦 MODULES MISSING PERMISSION MAP:');
modulesMissingPermMap.forEach(m => console.log(`  ❌ ${m} (defined in MODULE_DEFINITIONS but no MODULE_TO_PERMISSIONS_MAP entry)`));

console.log('\n\n👤 STAFF ROLE - MODULE GAPS:');
const staffGaps = roleModuleGaps.STAFF || {};
if (Object.keys(staffGaps).length === 0) console.log('  ✅ No gaps');
for (const [mod, actions] of Object.entries(staffGaps)) {
  for (const [action, perms] of Object.entries(actions)) {
    console.log(`  ❌ ${mod}.${action}: missing ${perms.join(', ')}`);
  }
}

console.log('\n\n👔 MANAGER ROLE - MODULE GAPS:');
const managerGaps = roleModuleGaps.MANAGER || {};
if (Object.keys(managerGaps).length === 0) console.log('  ✅ No gaps');
for (const [mod, actions] of Object.entries(managerGaps)) {
  for (const [action, perms] of Object.entries(actions)) {
    console.log(`  ❌ ${mod}.${action}: missing ${perms.join(', ')}`);
  }
}

console.log('\n\n🛡️  ADMIN ROLE - MODULE GAPS:');
const adminGaps = roleModuleGaps.ADMIN || {};
if (Object.keys(adminGaps).length === 0) console.log('  ✅ No gaps');
for (const [mod, actions] of Object.entries(adminGaps)) {
  for (const [action, perms] of Object.entries(actions)) {
    console.log(`  ❌ ${mod}.${action}: missing ${perms.join(', ')}`);
  }
}

console.log('\n\n' + '='.repeat(80));
console.log(`Full report saved to: ${outputPath}`);

// ─── CI/CD Gate ──────────────────────────────────────────────────────────────
const KNOWN_ADMIN_ONLY_ORPHANS = 6; // restore/permanent_delete/metadata_read/roles_manage

// Modules that STAFF/MANAGER can never be assigned to (admin-only features).
// Gaps in these modules are expected — don't block CI for them.
const ADMIN_ONLY_MODULES = new Set([
  'finance.dashboard', 'finance.revenue', 'finance.expense',
  'finance.salary', 'finance.salary_config', 'finance.policy',
  'zcode.manage',
  'bankLog.transactions', 'bankLog.rules',
  'invoice.manage', 'invoice.config',
  'logs.system', 'logs.webhook', 'logs.blockautomation',
]);

const errors = [];

// 1. Missing MODULE_TO_PERMISSIONS_MAP entries (always a bug)
if (modulesMissingPermMap.length > 0) {
  errors.push(`${modulesMissingPermMap.length} module(s) have MODULE_DEFINITIONS but no MODULE_TO_PERMISSIONS_MAP entry`);
}

// 2. Too many orphan permissions (admin-only ones are expected)
if (orphanPermissions.length > KNOWN_ADMIN_ONLY_ORPHANS) {
  errors.push(`${orphanPermissions.length} orphan permissions (expected max ${KNOWN_ADMIN_ONLY_ORPHANS})`);
}

// 3. STAFF/MANAGER gaps on modules they receive by DEFAULT (no moduleAccess fallback).
// When a user HAS moduleAccess, computePermissionsFromModuleAccess() handles it.
// When a user has NO moduleAccess, STAFF_PERMISSIONS is the fallback — only these
// core modules matter for STAFF fallback behavior.
const STAFF_CORE_MODULES = new Set([
  'customers.biz', 'customers.user',
  'operations.events', 'operations.tasks', 'operations.leads',
  'meta.program',
  'jobhub.tasks',
]);

for (const [roleKey, actionGaps] of Object.entries(roleModuleGaps.STAFF || {})) {
  if (!STAFF_CORE_MODULES.has(roleKey)) continue;
  const missingPerms = Object.values(actionGaps).flat();
  if (missingPerms.length > 0) {
    // Only fail on view gaps (403 on page load) — not on delete/configure (admin actions)
    const viewGaps = actionGaps['view'] || [];
    if (viewGaps.length > 0) {
      errors.push(`[STAFF fallback] ${roleKey}.view: missing ${viewGaps.join(', ')}`);
    }
  }
}

if (errors.length > 0) {
  console.log('\n❌ CI GATE FAILED:');
  errors.forEach(e => console.log(`  • ${e}`));
  console.log('\nFix the issues above before deploying.\n');
  process.exit(1);
} else {
  console.log('\n✅ CI GATE PASSED: Permission configuration is valid.\n');
  process.exit(0);
}
