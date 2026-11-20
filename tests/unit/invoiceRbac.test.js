jest.mock('../../src/core/services/CacheService', () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(true),
  del: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../src/modules/system/rbac/role.model', () => ({
  findOne: jest.fn(() => ({
    lean: jest.fn().mockResolvedValue(null),
  })),
}));

const {
  RESOURCES,
  PERMISSIONS,
  ROLE_DEFINITIONS,
  MODULE_DEFINITIONS,
  MODULE_TO_PERMISSIONS_MAP,
  ACTION_IMPLICATIONS,
} = require('../../src/core/constants/rbac');
const { hasPermission } = require('../../src/core/utils/rbac');

describe('Invoice Products RBAC & MLAC', () => {
  test('định nghĩa đầy đủ RESOURCES & PERMISSIONS cho invoice_products', () => {
    expect(RESOURCES.INVOICE_PRODUCTS).toBe('invoice_products');
    expect(PERMISSIONS.INVOICE_PRODUCTS_READ).toBe('invoice_products_read');
    expect(PERMISSIONS.INVOICE_PRODUCTS_CREATE).toBe('invoice_products_create');
    expect(PERMISSIONS.INVOICE_PRODUCTS_UPDATE).toBe('invoice_products_update');
    expect(PERMISSIONS.INVOICE_PRODUCTS_DELETE).toBe('invoice_products_delete');
    expect(PERMISSIONS.INVOICE_PRODUCTS_MANAGE).toBe('invoice_products_manage');
  });

  test('OWNER và ADMIN có quyền quản lý invoice_products', () => {
    expect(ROLE_DEFINITIONS.OWNER.permissions).toContain(PERMISSIONS.INVOICE_PRODUCTS_MANAGE);
    expect(ROLE_DEFINITIONS.ADMIN.permissions).toContain(PERMISSIONS.INVOICE_PRODUCTS_MANAGE);
  });

  test('MODULE_DEFINITIONS khai báo submodule invoice.products dưới parentKey invoice', () => {
    const mod = MODULE_DEFINITIONS['invoice.products'];
    expect(mod).toBeDefined();
    expect(mod).toEqual({
      key: 'invoice.products',
      label: 'Danh mục sản phẩm',
      type: 'sub',
      parentKey: 'invoice',
      actions: ['view', 'create', 'edit', 'delete'],
    });
  });

  test('MODULE_TO_PERMISSIONS_MAP map đúng action của invoice.products sang permissions', () => {
    expect(MODULE_TO_PERMISSIONS_MAP['invoice.products']).toEqual({
      view: [PERMISSIONS.INVOICE_PRODUCTS_READ],
      create: [PERMISSIONS.INVOICE_PRODUCTS_CREATE],
      edit: [PERMISSIONS.INVOICE_PRODUCTS_UPDATE],
      delete: [PERMISSIONS.INVOICE_PRODUCTS_DELETE],
    });
    expect(ACTION_IMPLICATIONS.create).toContain('view');
    expect(ACTION_IMPLICATIONS.edit).toContain('view');
    expect(ACTION_IMPLICATIONS.delete).toContain('view');
  });

  test('hasPermission cho phép invoice_products_manage thoả mãn tất cả quyền CRUD của invoice_products', async () => {
    const adminLikeUser = {
      roleId: 'custom',
      permissions: [PERMISSIONS.INVOICE_PRODUCTS_MANAGE],
    };

    expect(await hasPermission(adminLikeUser, PERMISSIONS.INVOICE_PRODUCTS_READ)).toBe(true);
    expect(await hasPermission(adminLikeUser, PERMISSIONS.INVOICE_PRODUCTS_CREATE)).toBe(true);
    expect(await hasPermission(adminLikeUser, PERMISSIONS.INVOICE_PRODUCTS_UPDATE)).toBe(true);
    expect(await hasPermission(adminLikeUser, PERMISSIONS.INVOICE_PRODUCTS_DELETE)).toBe(true);
  });

  test('user chỉ có quyền invoice.manage KHÔNG tự động có quyền tạo/sửa/xoá invoice_products', async () => {
    const invoiceOnlyUser = {
      roleId: 'staff',
      permissions: [
        PERMISSIONS.INVOICES_READ,
        PERMISSIONS.INVOICES_CREATE,
        PERMISSIONS.INVOICES_UPDATE,
        PERMISSIONS.INVOICES_DELETE,
      ],
    };

    expect(await hasPermission(invoiceOnlyUser, PERMISSIONS.INVOICE_PRODUCTS_CREATE)).toBe(false);
    expect(await hasPermission(invoiceOnlyUser, PERMISSIONS.INVOICE_PRODUCTS_UPDATE)).toBe(false);
    expect(await hasPermission(invoiceOnlyUser, PERMISSIONS.INVOICE_PRODUCTS_DELETE)).toBe(false);
  });
});
