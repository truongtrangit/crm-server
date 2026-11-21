const zlib = require('zlib');
const axios = require('axios');
const BkavAdapter = require('../../src/modules/invoice/adapters/BkavAdapter');
const BaseInvoiceAdapter = require('../../src/modules/invoice/adapters/BaseInvoiceAdapter');
const {
  BKAV_CMD_TYPES,
  BKAV_PAY_METHOD_IDS,
  INVOICE_STATUSES,
  INVOICE_RELATION_TYPES,
} = require('../../src/core/constants/invoice');

// ─── Helper ──────────────────────────────────────────────────────────────────
const makeAdapter = (cmdType = 112, overrides = {}) =>
  new BkavAdapter({
    bkav: {
      partnerGUID: '00000000-0000-0000-0000-000000000001',
      partnerToken: `${Buffer.alloc(32, 1).toString('base64')}:${Buffer.alloc(16, 2).toString('base64')}`,
      endpoint: 'https://wsdemo.ehoadon.vn/WSPublicEHoaDon.asmx',
      cmdType,
      ...overrides,
    },
  });

// ═════════════════════════════════════════════════════════════════════════════
describe('BkavAdapter — Extended (offline)', () => {
  // ───────────────────────────────────────────────────────────────────────────
  // 1. Constructor
  // ───────────────────────────────────────────────────────────────────────────
  describe('Constructor', () => {
    test('khởi tạo thành công với cấu hình hợp lệ', () => {
      const adapter = makeAdapter();
      expect(adapter.partnerGUID).toBe('00000000-0000-0000-0000-000000000001');
      expect(adapter.endpoint).toBe(
        'https://wsdemo.ehoadon.vn/WSPublicEHoaDon.asmx',
      );
      expect(adapter.cmdType).toBe(112);
      expect(adapter.aesKey).toHaveLength(32);
      expect(adapter.aesIV).toHaveLength(16);
    });

    test('ném lỗi khi thiếu partnerGUID', () => {
      expect(
        () =>
          new BkavAdapter({
            bkav: {
              partnerToken: `${Buffer.alloc(32, 1).toString('base64')}:${Buffer.alloc(16, 2).toString('base64')}`,
              endpoint: 'https://wsdemo.ehoadon.vn/WSPublicEHoaDon.asmx',
            },
          }),
      ).toThrow('Cấu hình BKAV không đầy đủ');
    });

    test('ném lỗi khi thiếu partnerToken', () => {
      expect(
        () =>
          new BkavAdapter({
            bkav: {
              partnerGUID: '00000000-0000-0000-0000-000000000001',
              endpoint: 'https://wsdemo.ehoadon.vn/WSPublicEHoaDon.asmx',
            },
          }),
      ).toThrow('Cấu hình BKAV không đầy đủ');
    });

    test('ném lỗi khi thiếu endpoint', () => {
      expect(
        () =>
          new BkavAdapter({
            bkav: {
              partnerGUID: '00000000-0000-0000-0000-000000000001',
              partnerToken: `${Buffer.alloc(32, 1).toString('base64')}:${Buffer.alloc(16, 2).toString('base64')}`,
            },
          }),
      ).toThrow('Cấu hình BKAV không đầy đủ');
    });

    test('ném lỗi khi partnerToken bị che (masked) = "***"', () => {
      expect(
        () =>
          makeAdapter(112, { partnerToken: '***' }),
      ).toThrow('dữ liệu đã bị che');
    });

    test('ném lỗi khi partnerGUID bị che (masked) = "***"', () => {
      expect(
        () =>
          makeAdapter(112, { partnerGUID: '***' }),
      ).toThrow('dữ liệu đã bị che');
    });

    test('ném lỗi khi partnerGUID bị che dạng viết tắt (a1b2...c3d4)', () => {
      expect(
        () =>
          makeAdapter(112, { partnerGUID: 'a1b2...c3d4' }),
      ).toThrow('dữ liệu đã bị che');
    });

    test('ném lỗi khi partnerToken không đúng format Key:IV', () => {
      expect(
        () =>
          makeAdapter(112, { partnerToken: 'invalid-no-colon' }),
      ).toThrow('PartnerToken không đúng định dạng Key:IV');
    });

    test('ném lỗi khi AES Key không đủ 32 bytes', () => {
      const shortKey = Buffer.alloc(16, 1).toString('base64');
      const iv = Buffer.alloc(16, 2).toString('base64');
      expect(
        () => makeAdapter(112, { partnerToken: `${shortKey}:${iv}` }),
      ).toThrow('AES Key phải 32 bytes');
    });

    test('ném lỗi khi AES IV không đủ 16 bytes', () => {
      const key = Buffer.alloc(32, 1).toString('base64');
      const shortIV = Buffer.alloc(8, 2).toString('base64');
      expect(
        () => makeAdapter(112, { partnerToken: `${key}:${shortIV}` }),
      ).toThrow('AES IV phải 16 bytes');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. _buildCommandObject
  // ───────────────────────────────────────────────────────────────────────────
  describe('_buildCommandObject', () => {
    const adapter = makeAdapter();

    test('gán BuyerCode từ invoice.buyer.code', () => {
      const cmd = adapter._buildCommandObject({
        id: 'INV-1',
        buyer: { code: 'KH001', name: 'Công ty A' },
        items: [],
      });
      expect(cmd.Invoice.BuyerCode).toBe('KH001');
    });

    test('gán SellerTaxCode từ config', () => {
      const a = makeAdapter(112, { sellerTaxCode: '0309999999' });
      // sellerTaxCode nằm trong config gốc (providerConfig) chứ không phải bkav sub-object
      // BaseInvoiceAdapter gán this.config = providerConfig → this.config.sellerTaxCode
      a.config.sellerTaxCode = '0309999999';
      const cmd = a._buildCommandObject({ id: 'INV-1', items: [] });
      expect(cmd.Invoice.SellerTaxCode).toBe('0309999999');
    });

    test('InvoiceStatusID = 1 khi tạo mới (không có relationType)', () => {
      const cmd = adapter._buildCommandObject({ id: 'INV-1', items: [] });
      expect(cmd.Invoice.InvoiceStatusID).toBe(1);
    });

    test('InvoiceStatusID = 2 khi thay thế', () => {
      const cmd = adapter._buildCommandObject({
        id: 'INV-1',
        relationType: INVOICE_RELATION_TYPES.REPLACEMENT,
        items: [],
      });
      expect(cmd.Invoice.InvoiceStatusID).toBe(2);
    });

    test('InvoiceStatusID = 3 khi điều chỉnh', () => {
      const cmd = adapter._buildCommandObject({
        id: 'INV-1',
        relationType: INVOICE_RELATION_TYPES.ADJUSTMENT,
        items: [],
      });
      expect(cmd.Invoice.InvoiceStatusID).toBe(3);
    });

    test('TypeCreateInvoice = 0 khi tạo mới', () => {
      const cmd = adapter._buildCommandObject({ id: 'INV-1', items: [] });
      expect(cmd.Invoice.TypeCreateInvoice).toBe(0);
    });

    test('TypeCreateInvoice = 1 khi thay thế', () => {
      const cmd = adapter._buildCommandObject({
        id: 'INV-1',
        relationType: INVOICE_RELATION_TYPES.REPLACEMENT,
        items: [],
      });
      expect(cmd.Invoice.TypeCreateInvoice).toBe(1);
    });

    test('TypeCreateInvoice = 3 khi điều chỉnh tăng', () => {
      const cmd = adapter._buildCommandObject({
        id: 'INV-1',
        relationType: INVOICE_RELATION_TYPES.ADJUSTMENT,
        isIncrease: true,
        items: [],
      });
      expect(cmd.Invoice.TypeCreateInvoice).toBe(3);
    });

    test('TypeCreateInvoice = 4 khi điều chỉnh giảm', () => {
      const cmd = adapter._buildCommandObject({
        id: 'INV-1',
        relationType: INVOICE_RELATION_TYPES.ADJUSTMENT,
        isIncrease: false,
        items: [],
      });
      expect(cmd.Invoice.TypeCreateInvoice).toBe(4);
    });

    test('gán OriginalInvoiceIdentify qua _formatOriginalIdentify', () => {
      const cmd = adapter._buildCommandObject({
        id: 'INV-1',
        relationType: INVOICE_RELATION_TYPES.REPLACEMENT,
        relatedInvoiceIdentify: '1_C22TAA_0000001',
        items: [],
      });
      expect(cmd.Invoice.OriginalInvoiceIdentify).toBe(
        '[1]_[C22TAA]_[0000001]',
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. _formatOriginalIdentify
  // ───────────────────────────────────────────────────────────────────────────
  describe('_formatOriginalIdentify', () => {
    const adapter = makeAdapter();

    test('trả chuỗi rỗng khi identify falsy', () => {
      expect(adapter._formatOriginalIdentify(null)).toBe('');
      expect(adapter._formatOriginalIdentify(undefined)).toBe('');
      expect(adapter._formatOriginalIdentify('')).toBe('');
    });

    test('giữ nguyên khi đã có dấu ngoặc vuông', () => {
      const val = '[1]_[C22TAA]_[0000001]';
      expect(adapter._formatOriginalIdentify(val)).toBe(val);
    });

    test('chuyển chuỗi phân cách gạch dưới thành dạng bracket', () => {
      expect(adapter._formatOriginalIdentify('1_C22TAA_0000001')).toBe(
        '[1]_[C22TAA]_[0000001]',
      );
    });

    test('bọc GUID (chứa dấu gạch ngang, ≥ 32 ký tự) vào bracket', () => {
      const guid = '12345678-1234-1234-1234-123456789012';
      expect(adapter._formatOriginalIdentify(guid)).toBe(`[${guid}]`);
    });

    test('trả nguyên giá trị khi không khớp pattern nào', () => {
      expect(adapter._formatOriginalIdentify('free-text')).toBe('free-text');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. _mapPayMethodId
  // ───────────────────────────────────────────────────────────────────────────
  describe('_mapPayMethodId', () => {
    const adapter = makeAdapter();

    test.each([
      ['TM', BKAV_PAY_METHOD_IDS.CASH],
      ['CK', BKAV_PAY_METHOD_IDS.TRANSFER],
      ['TM/CK', BKAV_PAY_METHOD_IDS.CASH_TRANSFER],
    ])('method "%s" → PayMethodID %p', (method, expected) => {
      expect(adapter._mapPayMethodId(method)).toBe(expected);
    });

    test('giá trị không xác định → mặc định CASH_TRANSFER', () => {
      expect(adapter._mapPayMethodId('UNKNOWN')).toBe(
        BKAV_PAY_METHOD_IDS.CASH_TRANSFER,
      );
      expect(adapter._mapPayMethodId(undefined)).toBe(
        BKAV_PAY_METHOD_IDS.CASH_TRANSFER,
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. _formatDate
  // ───────────────────────────────────────────────────────────────────────────
  describe('_formatDate', () => {
    const adapter = makeAdapter();

    test('format ngày hợp lệ thành yyyy-MM-dd', () => {
      const result = adapter._formatDate('2024-03-15T00:00:00Z');
      // Tuỳ timezone có thể lệch 1 ngày — chỉ kiểm tra format
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    test('trả chuỗi rỗng khi date null/undefined', () => {
      expect(adapter._formatDate(null)).toBe('');
      expect(adapter._formatDate(undefined)).toBe('');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 6. mapBkavStatusToCrmStatus
  // ───────────────────────────────────────────────────────────────────────────
  describe('mapBkavStatusToCrmStatus', () => {
    const adapter = makeAdapter();

    test.each([
      [1, INVOICE_STATUSES.PENDING_SIGN],
      [5, INVOICE_STATUSES.PENDING_SIGN],
      [7, INVOICE_STATUSES.PENDING_SIGN],
      [11, INVOICE_STATUSES.PENDING_SIGN],
      [14, INVOICE_STATUSES.PENDING_SIGN],
    ])('statusId %p → PENDING_SIGN', (id, expected) => {
      expect(adapter.mapBkavStatusToCrmStatus(id)).toBe(expected);
    });

    test.each([
      [2, INVOICE_STATUSES.ISSUED],
      [6, INVOICE_STATUSES.ISSUED],
      [8, INVOICE_STATUSES.ISSUED],
      [15, INVOICE_STATUSES.ISSUED],
    ])('statusId %p → ISSUED', (id, expected) => {
      expect(adapter.mapBkavStatusToCrmStatus(id)).toBe(expected);
    });

    test.each([
      [3, INVOICE_STATUSES.CANCELLED],
      [4, INVOICE_STATUSES.CANCELLED],
      [12, INVOICE_STATUSES.CANCELLED],
      [13, INVOICE_STATUSES.CANCELLED],
    ])('statusId %p → CANCELLED', (id, expected) => {
      expect(adapter.mapBkavStatusToCrmStatus(id)).toBe(expected);
    });

    test('statusId 9 → REPLACED', () => {
      expect(adapter.mapBkavStatusToCrmStatus(9)).toBe(
        INVOICE_STATUSES.REPLACED,
      );
    });

    test('statusId 10 → ADJUSTED', () => {
      expect(adapter.mapBkavStatusToCrmStatus(10)).toBe(
        INVOICE_STATUSES.ADJUSTED,
      );
    });

    test('statusId không xác định → null', () => {
      expect(adapter.mapBkavStatusToCrmStatus(999)).toBeNull();
      expect(adapter.mapBkavStatusToCrmStatus(undefined)).toBeNull();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 7. issue
  // ───────────────────────────────────────────────────────────────────────────
  describe('issue', () => {
    test('phát hành thành công — trả invoiceGUID, invoiceNo, lookupCode', async () => {
      const adapter = makeAdapter();
      adapter._execCommand = jest.fn().mockResolvedValue({
        success: true,
        data: [
          {
            Status: 0,
            InvoiceGUID: 'aaaa-bbbb-cccc-dddd',
            InvoiceNo: 123,
            MTC: 'MTC001',
          },
        ],
        rawResponse: {},
      });

      const res = await adapter.issue({ id: 'INV-1', items: [] });
      expect(res.success).toBe(true);
      expect(res.invoiceGUID).toBe('aaaa-bbbb-cccc-dddd');
      expect(res.invoiceNo).toBe(123);
      expect(res.lookupCode).toBe('MTC001');
    });

    test('thất bại khi BKAV trả inner Status ≠ 0', async () => {
      const adapter = makeAdapter();
      adapter._execCommand = jest.fn().mockResolvedValue({
        success: true,
        data: [{ Status: 1, MessLog: 'Dữ liệu không hợp lệ' }],
        rawResponse: {},
      });

      const res = await adapter.issue({ id: 'INV-1', items: [] });
      expect(res.success).toBe(false);
      expect(res.error).toBe('Dữ liệu không hợp lệ');
      expect(res.errorCode).toBe(1);
    });

    test('thất bại khi InvoiceGUID trả về rỗng (all zeros)', async () => {
      const adapter = makeAdapter();
      adapter._execCommand = jest.fn().mockResolvedValue({
        success: true,
        data: [
          {
            Status: 0,
            InvoiceGUID: '00000000-0000-0000-0000-000000000000',
            MessLog: 'Lỗi nội bộ BKAV',
          },
        ],
        rawResponse: {},
      });

      const res = await adapter.issue({ id: 'INV-1', items: [] });
      expect(res.success).toBe(false);
      expect(res.error).toContain('Lỗi nội bộ BKAV');
    });

    test('thất bại khi _execCommand trả success=false', async () => {
      const adapter = makeAdapter();
      adapter._execCommand = jest.fn().mockResolvedValue({
        success: false,
        error: 'Network error',
        rawResponse: null,
      });

      const res = await adapter.issue({ id: 'INV-1', items: [] });
      expect(res.success).toBe(false);
      expect(res.error).toBe('Network error');
    });

    test('thất bại khi _execCommand ném exception', async () => {
      const adapter = makeAdapter();
      adapter._execCommand = jest
        .fn()
        .mockRejectedValue(new Error('timeout'));

      const res = await adapter.issue({ id: 'INV-1', items: [] });
      expect(res.success).toBe(false);
      expect(res.error).toBe('timeout');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 8. updateDraft
  // ───────────────────────────────────────────────────────────────────────────
  describe('updateDraft', () => {
    test('cập nhật nháp thành công — gửi CmdType 204 với InvoiceGUID', async () => {
      const adapter = makeAdapter();
      adapter._execCommand = jest.fn().mockResolvedValue({
        success: true,
        data: [{ Status: 0 }],
        rawResponse: {},
      });

      const res = await adapter.updateDraft({
        id: 'INV-1',
        providerInvoiceGUID: 'guid-123',
        items: [],
      });
      expect(res.success).toBe(true);

      const call = adapter._execCommand.mock.calls[0][0];
      expect(call.CmdType).toBe(BKAV_CMD_TYPES.UPDATE_204);
      const parsed = JSON.parse(call.CommandObject);
      expect(parsed[0].Invoice.InvoiceGUID).toBe('guid-123');
    });

    test('thất bại khi chưa có providerInvoiceGUID', async () => {
      const adapter = makeAdapter();
      const res = await adapter.updateDraft({ id: 'INV-1', items: [] });
      expect(res.success).toBe(false);
      expect(res.error).toContain('InvoiceGUID');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 9. cancel
  // ───────────────────────────────────────────────────────────────────────────
  describe('cancel', () => {
    test('huỷ thành công — gửi CmdType 202 kèm InvoiceTypeID', async () => {
      const adapter = makeAdapter();
      adapter._execCommand = jest.fn().mockResolvedValue({
        success: true,
        data: [{ Status: 0 }],
        rawResponse: {},
      });

      const res = await adapter.cancel(
        { id: 'INV-1', providerInvoiceGUID: 'guid-abc' },
        'Sai thông tin',
      );
      expect(res.success).toBe(true);

      const call = adapter._execCommand.mock.calls[0][0];
      expect(call.CmdType).toBe(BKAV_CMD_TYPES.CANCEL_202);
      const parsed = JSON.parse(call.CommandObject);
      expect(parsed[0].Invoice.InvoiceTypeID).toBe(1);
      expect(parsed[0].Invoice.InvoiceGUID).toBe('guid-abc');
      expect(parsed[0].Invoice.Reason).toBe('Sai thông tin');
    });

    test('thất bại khi BKAV trả inner Status ≠ 0', async () => {
      const adapter = makeAdapter();
      adapter._execCommand = jest.fn().mockResolvedValue({
        success: true,
        data: [{ Status: 2, MessLog: 'HĐ đã huỷ trước đó' }],
        rawResponse: {},
      });

      const res = await adapter.cancel({
        id: 'INV-1',
        providerInvoiceGUID: 'guid-abc',
      });
      expect(res.success).toBe(false);
      expect(res.error).toBe('HĐ đã huỷ trước đó');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 10. deleteDraft
  // ───────────────────────────────────────────────────────────────────────────
  describe('deleteDraft', () => {
    test('xoá nháp thành công — gửi CmdType 301 kèm InvoiceTypeID', async () => {
      const adapter = makeAdapter();
      adapter._execCommand = jest.fn().mockResolvedValue({
        success: true,
        data: [{ Status: 0 }],
        rawResponse: {},
      });

      const res = await adapter.deleteDraft({
        id: 'INV-1',
        providerInvoiceGUID: 'guid-abc',
      });
      expect(res.success).toBe(true);

      const call = adapter._execCommand.mock.calls[0][0];
      expect(call.CmdType).toBe(BKAV_CMD_TYPES.DELETE_DRAFT_301);
      const parsed = JSON.parse(call.CommandObject);
      expect(parsed[0].Invoice.InvoiceTypeID).toBe(1);
    });

    test('trả success: true (no-op) khi chưa có providerInvoiceGUID', async () => {
      const adapter = makeAdapter();
      adapter._execCommand = jest.fn();

      const res = await adapter.deleteDraft({ id: 'INV-1' });
      expect(res.success).toBe(true);
      expect(adapter._execCommand).not.toHaveBeenCalled();
    });

    test('thất bại khi BKAV trả inner Status ≠ 0', async () => {
      const adapter = makeAdapter();
      adapter._execCommand = jest.fn().mockResolvedValue({
        success: true,
        data: [{ Status: 3, MessLog: 'Không tìm thấy HĐ nháp' }],
        rawResponse: {},
      });

      const res = await adapter.deleteDraft({
        id: 'INV-1',
        providerInvoiceGUID: 'guid-abc',
      });
      expect(res.success).toBe(false);
      expect(res.error).toBe('Không tìm thấy HĐ nháp');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 11. signWithHSM
  // ───────────────────────────────────────────────────────────────────────────
  describe('signWithHSM', () => {
    test('ký thành công — gửi CmdType 205 với InvoiceGUID', async () => {
      const adapter = makeAdapter();
      adapter._execCommand = jest.fn().mockResolvedValue({
        success: true,
        data: [{ Status: 0, InvoiceNo: 456, MTC: 'MTC-X' }],
        rawResponse: {},
      });

      const res = await adapter.signWithHSM({
        id: 'INV-1',
        providerInvoiceGUID: 'guid-sign',
      });
      expect(res.success).toBe(true);
      expect(res.invoiceNo).toBe(456);
      expect(res.lookupCode).toBe('MTC-X');

      const call = adapter._execCommand.mock.calls[0][0];
      expect(call.CmdType).toBe(BKAV_CMD_TYPES.SIGN_HSM_205);
      expect(call.CommandObject).toBe('guid-sign');
    });

    test('thất bại khi chưa có providerInvoiceGUID', async () => {
      const adapter = makeAdapter();
      const res = await adapter.signWithHSM({ id: 'INV-1' });
      expect(res.success).toBe(false);
      expect(res.error).toContain('InvoiceGUID');
    });

    test('thất bại khi BKAV trả inner Status ≠ 0', async () => {
      const adapter = makeAdapter();
      adapter._execCommand = jest.fn().mockResolvedValue({
        success: true,
        data: [{ Status: 1, MessLog: 'HSM lỗi chứng thư số' }],
        rawResponse: {},
      });

      const res = await adapter.signWithHSM({
        id: 'INV-1',
        providerInvoiceGUID: 'guid-sign',
      });
      expect(res.success).toBe(false);
      expect(res.error).toBe('HSM lỗi chứng thư số');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 12. signBatchWithHSM
  // ───────────────────────────────────────────────────────────────────────────
  describe('signBatchWithHSM', () => {
    test('ký hàng loạt thành công', async () => {
      const adapter = makeAdapter();
      adapter._execCommand = jest.fn().mockResolvedValue({
        success: true,
        data: [{ Status: 0 }, { Status: 0 }],
        rawResponse: {},
      });

      const res = await adapter.signBatchWithHSM(['guid-1', 'guid-2']);
      expect(res.success).toBe(true);

      const call = adapter._execCommand.mock.calls[0][0];
      expect(call.CmdType).toBe(BKAV_CMD_TYPES.SIGN_HSM_206);
      const parsed = JSON.parse(call.CommandObject);
      expect(parsed).toEqual([
        { InvoiceGUID: 'guid-1' },
        { InvoiceGUID: 'guid-2' },
      ]);
    });

    test('thất bại khi danh sách GUID rỗng', async () => {
      const adapter = makeAdapter();
      const res = await adapter.signBatchWithHSM([]);
      expect(res.success).toBe(false);
      expect(res.error).toContain('trống');
    });

    test('thất bại khi có phần tử lỗi (partial failure)', async () => {
      const adapter = makeAdapter();
      adapter._execCommand = jest.fn().mockResolvedValue({
        success: true,
        data: [
          { Status: 0 },
          { Status: 1, MessLog: 'HĐ guid-2 đã ký rồi' },
        ],
        rawResponse: {},
      });

      const res = await adapter.signBatchWithHSM(['guid-1', 'guid-2']);
      expect(res.success).toBe(false);
      expect(res.error).toBe('HĐ guid-2 đã ký rồi');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 13. explainToCQT
  // ───────────────────────────────────────────────────────────────────────────
  describe('explainToCQT', () => {
    test('giải trình thành công — gửi CmdType 300', async () => {
      const adapter = makeAdapter();
      adapter._execCommand = jest.fn().mockResolvedValue({
        success: true,
        data: [{ Status: 0 }],
        rawResponse: {},
      });

      const res = await adapter.explainToCQT({
        invoiceGUID: 'guid-explain',
        reason: 'Sai sót kê khai',
        notify: true,
        dateNotify: '2024-06-01',
        numberNotify: 'TB-001',
      });
      expect(res.success).toBe(true);

      const call = adapter._execCommand.mock.calls[0][0];
      expect(call.CmdType).toBe(BKAV_CMD_TYPES.EXPLAIN_300);
      const parsed = JSON.parse(call.CommandObject);
      expect(parsed[0].Invoice.InvoiceGUID).toBe('guid-explain');
      expect(parsed[0].Invoice.Reason).toBe('Sai sót kê khai');
      expect(parsed[0].Invoice.Notify).toBe(true);
      expect(parsed[0].Invoice.DateNotify).toBe('2024-06-01');
      expect(parsed[0].Invoice.NumberNotify).toBe('TB-001');
    });

    test('thất bại khi BKAV trả inner Status ≠ 0', async () => {
      const adapter = makeAdapter();
      adapter._execCommand = jest.fn().mockResolvedValue({
        success: true,
        data: [{ Status: 2, MessLog: 'HĐ không hợp lệ để giải trình' }],
        rawResponse: {},
      });

      const res = await adapter.explainToCQT({
        invoiceGUID: 'guid-explain',
        reason: 'Test',
      });
      expect(res.success).toBe(false);
      expect(res.error).toBe('HĐ không hợp lệ để giải trình');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 14. explainReplacedToCQT
  // ───────────────────────────────────────────────────────────────────────────
  describe('explainReplacedToCQT', () => {
    test('giải trình thay thế thành công — gửi CmdType 304', async () => {
      const adapter = makeAdapter();
      adapter._execCommand = jest.fn().mockResolvedValue({
        success: true,
        data: [{ Status: 0 }],
        rawResponse: {},
      });

      const res = await adapter.explainReplacedToCQT({
        invoiceGUID: 'guid-replaced',
        reason: 'HĐ bị thay thế do sai tên',
      });
      expect(res.success).toBe(true);

      const call = adapter._execCommand.mock.calls[0][0];
      expect(call.CmdType).toBe(BKAV_CMD_TYPES.EXPLAIN_304);
      const parsed = JSON.parse(call.CommandObject);
      expect(parsed[0].Invoice.InvoiceGUID).toBe('guid-replaced');
      expect(parsed[0].Invoice.Reason).toBe('HĐ bị thay thế do sai tên');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 15. lookupTaxCode
  // ───────────────────────────────────────────────────────────────────────────
  describe('lookupTaxCode', () => {
    test('tra cứu MST thành công — gửi CmdType 904', async () => {
      const adapter = makeAdapter();
      const taxInfo = { TaxCode: '0309999999', CompanyName: 'Công ty ABC' };
      adapter._execCommand = jest.fn().mockResolvedValue({
        success: true,
        data: [taxInfo],
        rawResponse: {},
      });

      const res = await adapter.lookupTaxCode('0309999999');
      expect(res.success).toBe(true);
      expect(res.data).toEqual(taxInfo);

      const call = adapter._execCommand.mock.calls[0][0];
      expect(call.CmdType).toBe(904);
      expect(call.CommandObject).toBe('0309999999');
    });

    test('thất bại khi _execCommand trả success=false', async () => {
      const adapter = makeAdapter();
      adapter._execCommand = jest.fn().mockResolvedValue({
        success: false,
        error: 'MST không tồn tại',
      });

      const res = await adapter.lookupTaxCode('0000000000');
      expect(res.success).toBe(false);
      expect(res.data).toBeNull();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 16. getInfo
  // ───────────────────────────────────────────────────────────────────────────
  describe('getInfo', () => {
    test('lấy thông tin thành công — trả crmStatus tương ứng', async () => {
      const adapter = makeAdapter();
      adapter._execCommand = jest.fn().mockResolvedValue({
        success: true,
        data: [{ Invoice: { InvoiceStatusID: 2, InvoiceNo: 100 } }],
        rawResponse: {},
      });

      const res = await adapter.getInfo({
        id: 'INV-1',
        providerInvoiceGUID: 'guid-info',
      });
      expect(res.success).toBe(true);
      expect(res.crmStatus).toBe(INVOICE_STATUSES.ISSUED);
      expect(res.data.Invoice.InvoiceNo).toBe(100);

      const call = adapter._execCommand.mock.calls[0][0];
      expect(call.CmdType).toBe(BKAV_CMD_TYPES.GET_INFO_800);
      expect(call.CommandObject).toBe('guid-info');
    });

    test('thất bại khi _execCommand trả success=false', async () => {
      const adapter = makeAdapter();
      adapter._execCommand = jest.fn().mockResolvedValue({
        success: false,
        error: 'Không tìm thấy HĐ',
        rawResponse: {},
      });

      const res = await adapter.getInfo({ id: 'INV-1' });
      expect(res.success).toBe(false);
      expect(res.error).toBe('Không tìm thấy HĐ');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 17. testConnection
  // ───────────────────────────────────────────────────────────────────────────
  describe('testConnection', () => {
    test('kết nối thành công — trả message OK và endpoint', async () => {
      const adapter = makeAdapter();
      adapter._execCommand = jest.fn().mockResolvedValue({
        success: true,
        data: null,
        rawResponse: {},
      });

      const res = await adapter.testConnection();
      expect(res.success).toBe(true);
      expect(res.message).toContain('thành công');
      expect(res.endpoint).toBe(
        'https://wsdemo.ehoadon.vn/WSPublicEHoaDon.asmx',
      );
    });

    test('thất bại khi decrypt lỗi (sai credentials)', async () => {
      const adapter = makeAdapter();
      adapter._execCommand = jest.fn().mockResolvedValue({
        success: false,
        error:
          'Không giải mã được response từ BKAV. Kiểm tra PartnerGUID và PartnerToken',
        rawResponse: null,
      });

      const res = await adapter.testConnection();
      expect(res.success).toBe(false);
      expect(res.message).toContain('Không giải mã');
      expect(res.endpoint).toBe(
        'https://wsdemo.ehoadon.vn/WSPublicEHoaDon.asmx',
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 18. Crypto & Wire Protocol (_encrypt / _decrypt / _execCommand)
  // ───────────────────────────────────────────────────────────────────────────
  describe('Crypto & _execCommand (AES-256-CBC + GZip)', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('_encrypt và _decrypt round-trip chính xác', () => {
      const adapter = makeAdapter();
      const plain = Buffer.from('Xin chào BKAV eHoaDon 123!', 'utf-8');
      const encrypted = adapter._encrypt(plain);
      expect(encrypted.equals(plain)).toBe(false);
      const decrypted = adapter._decrypt(encrypted);
      expect(decrypted.toString('utf-8')).toBe('Xin chào BKAV eHoaDon 123!');
    });

    test('_execCommand giải mã GZip + AES thành công và parse JSON Object', async () => {
      const adapter = makeAdapter();
      const bkavResponseObj = {
        Status: 0,
        Object: JSON.stringify([{ InvoiceGUID: 'guid-xyz', InvoiceNo: 77, Status: 0 }]),
      };
      const compressed = zlib.gzipSync(Buffer.from(JSON.stringify(bkavResponseObj), 'utf-8'));
      const encryptedBase64 = adapter._encrypt(compressed).toString('base64');

      const postSpy = jest.spyOn(axios, 'post').mockResolvedValue({
        data: { d: encryptedBase64 },
      });

      const res = await adapter._execCommand({ CmdType: 800, CommandObject: 'guid-xyz' });
      expect(postSpy).toHaveBeenCalledWith(
        'https://wsdemo.ehoadon.vn/WSPublicEHoaDon.asmx/ExecCommand',
        expect.objectContaining({
          partnerGUID: '00000000-0000-0000-0000-000000000001',
          CommandData: expect.any(String),
        }),
        expect.any(Object),
      );
      expect(res.success).toBe(true);
      expect(res.data).toEqual([{ InvoiceGUID: 'guid-xyz', InvoiceNo: 77, Status: 0 }]);
    });

    test('_execCommand trả lỗi khi BKAV trả Status ≠ 0 ở top-level', async () => {
      const adapter = makeAdapter();
      const bkavResponseObj = { Status: 1, Object: 'PartnerGUID không hợp lệ' };
      const compressed = zlib.gzipSync(Buffer.from(JSON.stringify(bkavResponseObj), 'utf-8'));
      const encryptedBase64 = adapter._encrypt(compressed).toString('base64');

      jest.spyOn(axios, 'post').mockResolvedValue({ data: { d: encryptedBase64 } });

      const res = await adapter._execCommand({ CmdType: 800, CommandObject: 'x' });
      expect(res.success).toBe(false);
      expect(res.errorCode).toBe(1);
      expect(res.error).toBe('PartnerGUID không hợp lệ');
    });

    test('_execCommand trả lỗi khi response rỗng hoặc plain-text error', async () => {
      const adapter = makeAdapter();
      jest.spyOn(axios, 'post').mockResolvedValueOnce({ data: { d: '' } });
      const emptyRes = await adapter._execCommand({ CmdType: 800, CommandObject: 'x' });
      expect(emptyRes.success).toBe(false);
      expect(emptyRes.error).toContain('rỗng');

      jest.spyOn(axios, 'post').mockResolvedValueOnce({ data: { d: 'Partner not found' } });
      const plainErr = await adapter._execCommand({ CmdType: 800, CommandObject: 'x' });
      expect(plainErr.success).toBe(false);
      expect(plainErr.error).toBe('Partner not found');
    });

    test('_execCommand trả lỗi giải mã khi ciphertext không hợp lệ', async () => {
      const adapter = makeAdapter();
      jest.spyOn(axios, 'post').mockResolvedValue({ data: { d: Buffer.from('bad-cipher').toString('base64') } });
      const res = await adapter._execCommand({ CmdType: 800, CommandObject: 'x' });
      expect(res.success).toBe(false);
      expect(res.error).toContain('Không giải mã được response từ BKAV');
    });

    test('download dừng sớm khi gặp lỗi timeout mạng (không gọi lặp 3 lần thành 90s)', async () => {
      const adapter = makeAdapter();
      const timeoutErr = Object.assign(new Error('timeout of 30000ms exceeded'), {
        code: 'ECONNABORTED',
      });
      const execSpy = jest
        .spyOn(adapter, '_execCommand')
        .mockRejectedValue(timeoutErr);

      const res = await adapter.download(
        { id: 'INV-1', lookupCode: 'MTC1', providerInvoiceGUID: 'guid-1' },
        'pdf',
      );
      expect(res.success).toBe(false);
      expect(execSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 19. BaseInvoiceAdapter (abstract base class)
  // ───────────────────────────────────────────────────────────────────────────
  describe('BaseInvoiceAdapter', () => {
    test('không cho phép khởi tạo trực tiếp BaseInvoiceAdapter', () => {
      expect(() => new BaseInvoiceAdapter({})).toThrow('abstract class');
    });

    test('subclass chưa override method sẽ ném lỗi chưa được implement', async () => {
      class DummyAdapter extends BaseInvoiceAdapter {}
      const dummy = new DummyAdapter({ providerType: 'dummy' });
      await expect(dummy.issue({})).rejects.toThrow('Method issue() chưa được implement');
      await expect(dummy.cancel({}, 'reason')).rejects.toThrow('Method cancel() chưa được implement');
      await expect(dummy.getInfo({})).rejects.toThrow('Method getInfo() chưa được implement');
      await expect(dummy.download({})).rejects.toThrow('Method download() chưa được implement');
      await expect(dummy.testConnection()).rejects.toThrow('Method testConnection() chưa được implement');
    });
  });
});
