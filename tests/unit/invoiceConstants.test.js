const {
  INVOICE_STATUSES,
  INVOICE_PROVIDER_TYPES,
  BKAV_INVOICE_TYPES,
  BKAV_CMD_TYPES,
  BKAV_TAX_RATE_IDS,
  BKAV_PAY_METHOD_IDS,
  BKAV_RECEIVE_TYPES,
  INVOICE_RELATION_TYPES,
  INVOICE_SOURCE_MODULES,
  BKAV_MAX_INVOICES_PER_REQUEST,
} = require('../../src/core/constants/invoice');
const AdapterFactory = require('../../src/modules/invoice/adapters/AdapterFactory');

// ─────────────────────────────────────────────────────────────────────────────
// 1. INVOICE_STATUSES
// ─────────────────────────────────────────────────────────────────────────────
describe('INVOICE_STATUSES', () => {
  test('có đủ 8 trạng thái', () => {
    expect(Object.keys(INVOICE_STATUSES)).toHaveLength(8);
  });

  test.each([
    ['DRAFT', 'draft'],
    ['PENDING_SIGN', 'pending_sign'],
    ['PENDING', 'pending'],
    ['ISSUED', 'issued'],
    ['ERROR', 'error'],
    ['CANCELLED', 'cancelled'],
    ['REPLACED', 'replaced'],
    ['ADJUSTED', 'adjusted'],
  ])('%s = "%s"', (key, value) => {
    expect(INVOICE_STATUSES[key]).toBe(value);
  });

  test('object đã được freeze (không thể thay đổi)', () => {
    expect(Object.isFrozen(INVOICE_STATUSES)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. BKAV_INVOICE_TYPES
// ─────────────────────────────────────────────────────────────────────────────
describe('BKAV_INVOICE_TYPES', () => {
  test.each([
    ['GTGT', 1],
    ['BAN_HANG', 2],
    ['BAN_HANG_PTQ', 4],
    ['PXK_VCNB', 5],
    ['PXK_DAI_LY', 6],
  ])('%s = %d', (key, value) => {
    expect(BKAV_INVOICE_TYPES[key]).toBe(value);
  });

  test('KHÔNG có giá trị 3 (bỏ qua theo đặc tả BKAV)', () => {
    const values = Object.values(BKAV_INVOICE_TYPES);
    expect(values).not.toContain(3);
  });

  test('chỉ có đúng 5 loại hoá đơn', () => {
    expect(Object.keys(BKAV_INVOICE_TYPES)).toHaveLength(5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. BKAV_CMD_TYPES
// ─────────────────────────────────────────────────────────────────────────────
describe('BKAV_CMD_TYPES', () => {
  const expectedCmdTypes = {
    // Tạo hoá đơn
    CREATE_100: 100,
    CREATE_101: 101,
    CREATE_110: 110,
    CREATE_111: 111,
    CREATE_112: 112,
    // Thay thế
    REPLACE_120: 120,
    REPLACE_123: 123,
    // Điều chỉnh
    ADJUST_121: 121,
    ADJUST_124: 124,
    // Điều chỉnh chiết khấu
    ADJUST_DISCOUNT_122: 122,
    ADJUST_DISCOUNT_126: 126,
    // Cập nhật
    UPDATE_200: 200,
    UPDATE_203: 203,
    UPDATE_204: 204,
    // Huỷ
    CANCEL_201: 201,
    CANCEL_202: 202,
    // Ký HSM
    SIGN_HSM_205: 205,
    SIGN_HSM_206: 206,
    // Giải trình CQT
    EXPLAIN_300: 300,
    EXPLAIN_304: 304,
    // Xoá bỏ nháp
    DELETE_DRAFT_301: 301,
    DELETE_DRAFT_303: 303,
    // Upload file
    UPLOAD_FILE_500: 500,
    // Lấy thông tin
    GET_INFO_800: 800,
    GET_STATUS_801: 801,
    GET_HISTORY_802: 802,
    GET_PDF_803: 803,
    GET_LINK_804: 804,
    GET_XML_805: 805,
    GET_PDF_808: 808,
    GET_XML_809: 809,
    GET_RANGE_810: 810,
    GET_PDF_BY_MTC_811: 811,
    GET_CONVERTED_PDF_BY_MTC_812: 812,
    GET_XML_BY_MTC_813: 813,
    GET_TAX_STATUS_850: 850,
    // Khác
    RESEND_EMAIL_901: 901,
    LOOKUP_TAX_904: 904,
  };

  test.each(Object.entries(expectedCmdTypes))('%s = %d', (key, value) => {
    expect(BKAV_CMD_TYPES[key]).toBe(value);
  });

  test('có đủ số lượng CmdType', () => {
    expect(Object.keys(BKAV_CMD_TYPES)).toHaveLength(
      Object.keys(expectedCmdTypes).length,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. BKAV_TAX_RATE_IDS
// ─────────────────────────────────────────────────────────────────────────────
describe('BKAV_TAX_RATE_IDS', () => {
  test.each([
    ['TAX_0', 1],
    ['TAX_5', 2],
    ['TAX_10', 3],
    ['TAX_8', 9],
    ['TAX_KCT', 4],
    ['TAX_KKK', 5],
    ['TAX_OTHER', 6],
  ])('%s = %d', (key, value) => {
    expect(BKAV_TAX_RATE_IDS[key]).toBe(value);
  });

  test('có đúng 7 loại thuế suất', () => {
    expect(Object.keys(BKAV_TAX_RATE_IDS)).toHaveLength(7);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. BKAV_PAY_METHOD_IDS
// ─────────────────────────────────────────────────────────────────────────────
describe('BKAV_PAY_METHOD_IDS', () => {
  test.each([
    ['CASH', 1],
    ['TRANSFER', 2],
    ['CASH_TRANSFER', 3],
  ])('%s = %d', (key, value) => {
    expect(BKAV_PAY_METHOD_IDS[key]).toBe(value);
  });

  test('có đúng 3 phương thức thanh toán', () => {
    expect(Object.keys(BKAV_PAY_METHOD_IDS)).toHaveLength(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. INVOICE_RELATION_TYPES
// ─────────────────────────────────────────────────────────────────────────────
describe('INVOICE_RELATION_TYPES', () => {
  test('có đúng 3 loại quan hệ hoá đơn', () => {
    expect(Object.keys(INVOICE_RELATION_TYPES)).toHaveLength(3);
  });

  test.each([
    ['REPLACEMENT', 'replacement'],
    ['ADJUSTMENT', 'adjustment'],
    ['ADJUSTMENT_DISCOUNT', 'adjustment_discount'],
  ])('%s = "%s"', (key, value) => {
    expect(INVOICE_RELATION_TYPES[key]).toBe(value);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. BKAV_MAX_INVOICES_PER_REQUEST
// ─────────────────────────────────────────────────────────────────────────────
describe('BKAV_MAX_INVOICES_PER_REQUEST', () => {
  test('giới hạn tối đa 30 hoá đơn mỗi request', () => {
    expect(BKAV_MAX_INVOICES_PER_REQUEST).toBe(30);
  });

  test('là kiểu number', () => {
    expect(typeof BKAV_MAX_INVOICES_PER_REQUEST).toBe('number');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. AdapterFactory
// ─────────────────────────────────────────────────────────────────────────────
describe('AdapterFactory', () => {
  test('providerType "bkav" → tạo BkavAdapter', () => {
    const adapter = AdapterFactory.create({
      providerType: 'bkav',
      bkav: {
        partnerGUID: '00000000-0000-0000-0000-000000000001',
        partnerToken: `${Buffer.alloc(32, 1).toString('base64')}:${Buffer.alloc(16, 2).toString('base64')}`,
        endpoint: 'https://wsdemo.ehoadon.vn/WSPublicEHoaDon.asmx',
        cmdType: 112,
      },
    });
    const BkavAdapter = require('../../src/modules/invoice/adapters/BkavAdapter');
    expect(adapter).toBeInstanceOf(BkavAdapter);
  });

  test('providerType "sepay" → ném lỗi chưa hỗ trợ', () => {
    expect(() =>
      AdapterFactory.create({ providerType: 'sepay' }),
    ).toThrow('SePay adapter chưa được implement');
  });

  test('providerType không hợp lệ → ném lỗi không hỗ trợ', () => {
    expect(() =>
      AdapterFactory.create({ providerType: 'unknown_provider' }),
    ).toThrow('Không hỗ trợ provider type: unknown_provider');
  });

  test('thiếu providerType → ném lỗi bắt buộc', () => {
    expect(() => AdapterFactory.create({})).toThrow(
      'providerConfig và providerType là bắt buộc',
    );
  });

  test('providerConfig là null → ném lỗi bắt buộc', () => {
    expect(() => AdapterFactory.create(null)).toThrow(
      'providerConfig và providerType là bắt buộc',
    );
  });
});
