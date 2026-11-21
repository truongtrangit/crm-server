const BkavAdapter = require('../../src/modules/invoice/adapters/BkavAdapter');
const { BKAV_CMD_TYPES, BKAV_TAX_RATE_IDS } = require('../../src/core/constants/invoice');

const makeAdapter = (cmdType) =>
  new BkavAdapter({
    bkav: {
      partnerGUID: '00000000-0000-0000-0000-000000000001',
      partnerToken: `${Buffer.alloc(32, 1).toString('base64')}:${Buffer.alloc(16, 2).toString('base64')}`,
      endpoint: 'https://wsdemo.ehoadon.vn/WSPublicEHoaDon.asmx',
      cmdType,
    },
  });

describe('BkavAdapter (offline)', () => {
  describe('_buildDetailsList — TaxRateID/TaxRate chuẩn BKAV', () => {
    const adapter = makeAdapter(112);
    const build = (taxRate, extra = {}) =>
      adapter._buildDetailsList({
        items: [{ itemName: 'A', quantity: 1, unitPrice: 100, amount: 100, taxRate, taxAmount: 10, ...extra }],
      })[0];

    test.each([
      [0, BKAV_TAX_RATE_IDS.TAX_0],
      [5, BKAV_TAX_RATE_IDS.TAX_5],
      [8, BKAV_TAX_RATE_IDS.TAX_8],
      [10, BKAV_TAX_RATE_IDS.TAX_10],
      [-1, 4],
      [-2, 5],
    ])('taxRate %p → TaxRateID %p', (rate, id) => {
      const row = build(rate);
      expect(row.TaxRateID).toBe(id);
      expect(row.TaxRate).toBe(rate);
    });

    test('KCT/KKK/0% không có tiền thuế', () => {
      expect(build(-1).TaxAmount).toBe(0);
      expect(build(-2).TaxAmount).toBe(0);
      expect(build(0).TaxAmount).toBe(0);
      expect(build(10).TaxAmount).toBe(10);
    });

    test('chiết khấu tổng chỉ thêm khi chưa có dòng isDiscount', () => {
      const withTotal = adapter._buildDetailsList({
        totalDiscountAmount: 50,
        items: [{ itemName: 'A', amount: 100, taxRate: 10 }],
      });
      expect(withTotal).toHaveLength(2);
      expect(withTotal[1].IsDiscount).toBe(true);
      expect(withTotal[1].Amount).toBe(50);

      const already = adapter._buildDetailsList({
        totalDiscountAmount: 50,
        items: [{ itemName: 'A', amount: 100, taxRate: 10 }, { itemName: 'CK', amount: 50, isDiscount: true, taxRate: 10 }],
      });
      expect(already).toHaveLength(2);
    });

    test('giữ nguyên ItemTypeID 15 (KM), 21 (Xe) và chuyển 30 (CK) thành 0 + IsDiscount=true theo Phụ lục 6 FAQ', () => {
      const rows = adapter._buildDetailsList({
        items: [
          { itemName: 'Hàng KM', itemTypeId: 15, taxRate: 0 },
          { itemName: 'Xe ô tô', itemTypeId: 21, taxRate: 10, userDefineDetails: '[{"FieldName":"SKhung","FieldValue":"123"}]' },
          { itemName: 'Chiết khấu', itemTypeId: 30, amount: 50, taxRate: 0 },
        ],
      });
      expect(rows[0].ItemTypeID).toBe(15);
      expect(rows[0].IsDiscount).toBe(false);
      expect(rows[1].ItemTypeID).toBe(21);
      expect(rows[2].ItemTypeID).toBe(0);
      expect(rows[2].IsDiscount).toBe(true);
    });
  });

  describe('_determineCmdType', () => {
    test('111 được đổi sang 112 (CRM luôn gửi InvoiceNo=0)', () => {
      expect(makeAdapter(111)._determineCmdType({})).toBe(BKAV_CMD_TYPES.CREATE_112);
    });
    test('thay thế / điều chỉnh khi BKAV cấp số → 123 / 124', () => {
      const a = makeAdapter(112);
      expect(a._determineCmdType({ relationType: 'replacement' })).toBe(123);
      expect(a._determineCmdType({ relationType: 'adjustment' })).toBe(124);
    });
    test('thay thế / điều chỉnh khi chưa cấp số → 120 / 121', () => {
      const a = makeAdapter(110);
      expect(a._determineCmdType({ relationType: 'replacement' })).toBe(120);
      expect(a._determineCmdType({ relationType: 'adjustment' })).toBe(121);
    });
  });

  describe('download', () => {
    test('dùng 808 theo PartnerInvoiceStringID và trả base64 PDF', async () => {
      const a = makeAdapter(112);
      a._execCommand = jest.fn().mockResolvedValue({ success: true, data: [{ PDF: 'QUJD', XML: null }] });
      const res = await a.download({ id: 'INV1', lookupCode: 'MTC1' }, 'pdf');
      expect(a._execCommand).toHaveBeenCalledWith({ CmdType: 808, CommandObject: 'INV1' });
      expect(res).toEqual({ success: true, format: 'pdf', base64: 'QUJD' });
    });

    test('fallback sang 813 theo mã tra cứu khi 809 không có dữ liệu', async () => {
      const a = makeAdapter(112);
      a._execCommand = jest
        .fn()
        .mockResolvedValueOnce({ success: true, data: [{ XML: null }] })
        .mockResolvedValueOnce({ success: true, data: [{ XML: 'PHhtbC8+' }] });
      const res = await a.download({ id: 'INV1', lookupCode: 'MTC1' }, 'xml');
      expect(a._execCommand).toHaveBeenLastCalledWith({ CmdType: 813, CommandObject: 'MTC1' });
      expect(res.base64).toBe('PHhtbC8+');
    });

    test('thất bại khi BKAV không trả file', async () => {
      const a = makeAdapter(112);
      a._execCommand = jest.fn().mockResolvedValue({ success: false, error: 'boom' });
      const res = await a.download({ id: 'INV1' }, 'pdf');
      expect(res.success).toBe(false);
    });
  });
});

