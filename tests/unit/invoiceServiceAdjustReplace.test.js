const InvoiceService = require('../../src/modules/invoice/invoice.service');
const Invoice = require('../../src/modules/invoice/invoice.model');
const InvoiceProvider = require('../../src/modules/invoice/invoiceProvider.model');
const AdapterFactory = require('../../src/modules/invoice/adapters/AdapterFactory');
const {
  INVOICE_STATUSES,
  INVOICE_RELATION_TYPES,
  BKAV_CMD_TYPES,
} = require('../../src/core/constants/invoice');

describe('InvoiceService — adjustInvoice & replaceInvoice call logs', () => {
  const mockOriginalInvoice = {
    id: 'INV-ORIGINAL-001',
    providerId: 'PROV-1',
    providerType: 'bkav',
    invoiceForm: '1',
    invoiceSerial: 'C22TAA',
    invoiceNo: 123,
    status: INVOICE_STATUSES.ISSUED,
    providerInvoiceGUID: 'guid-orig-001',
    providerCallLogs: [],
  };

  const mockProvider = {
    id: 'PROV-1',
    name: 'BKAV Demo',
    providerType: 'bkav',
    isActive: true,
    bkav: {
      partnerGUID: '00000000-0000-0000-0000-000000000001',
      partnerToken: `${Buffer.alloc(32, 1).toString('base64')}:${Buffer.alloc(16, 2).toString('base64')}`,
      endpoint: 'https://wsdemo.ehoadon.vn/WSPublicEHoaDon.asmx',
      cmdType: 112,
    },
  };

  const samplePayload = {
    reason: 'Điều chỉnh số tiền do sai đơn giá',
    items: [
      {
        itemName: 'Dịch vụ A',
        quantity: 1,
        unitPrice: 200000,
        amount: 200000,
        taxRate: 10,
        taxAmount: 20000,
      },
    ],
  };

  let mockAdapter;

  beforeEach(() => {
    jest.clearAllMocks();

    mockAdapter = {
      _determineCmdType: jest.fn((inv) =>
        inv.relationType === INVOICE_RELATION_TYPES.REPLACEMENT
          ? BKAV_CMD_TYPES.REPLACE_123
          : BKAV_CMD_TYPES.ADJUST_124,
      ),
      issue: jest.fn().mockResolvedValue({
        success: true,
        invoiceGUID: 'guid-new-002',
        invoiceNo: 124,
        lookupCode: 'MTC-NEW',
        rawResponse: {},
      }),
    };

    jest.spyOn(AdapterFactory, 'create').mockReturnValue(mockAdapter);
    jest.spyOn(InvoiceProvider, 'findOne').mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockProvider),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // adjustInvoice
  // ═══════════════════════════════════════════════════════════════════════════
  describe('adjustInvoice', () => {
    test('thành công (ISSUED) → ghi _appendCallLog vào HĐ gốc với action "adjust" và cmdType 124', async () => {
      const origDoc = {
        ...mockOriginalInvoice,
        providerCallLogs: [],
      };

      jest.spyOn(Invoice, 'findOne').mockResolvedValue(origDoc);
      jest.spyOn(InvoiceService, '_resolveItems').mockResolvedValue(samplePayload.items);
      jest.spyOn(InvoiceService, '_generateInvoiceId').mockResolvedValue('INV-NEW-ADJUST');
      jest.spyOn(Invoice, 'create').mockResolvedValue({});
      jest.spyOn(Invoice.prototype, 'save').mockResolvedValue({});
      const updateSpy = jest.spyOn(Invoice, 'findOneAndUpdate').mockResolvedValue({});

      jest.spyOn(InvoiceService, '_issueViaProvider').mockResolvedValue({
        id: 'INV-NEW-ADJUST',
        status: INVOICE_STATUSES.ISSUED,
        providerInvoiceGUID: 'guid-new-002',
      });

      const res = await InvoiceService.adjustInvoice('INV-ORIGINAL-001', samplePayload, 'user-1');

      expect(res.status).toBe(INVOICE_STATUSES.ISSUED);
      expect(updateSpy).toHaveBeenCalledWith(
        { id: 'INV-ORIGINAL-001' },
        {
          $set: {
            status: INVOICE_STATUSES.ADJUSTED,
            providerErrorMessage: null,
            providerCallLogs: expect.arrayContaining([
              expect.objectContaining({
                action: 'adjust',
                cmdType: BKAV_CMD_TYPES.ADJUST_124,
                success: true,
              }),
            ]),
          },
        },
      );
    });

    test('thành công nhưng chờ ký (PENDING_SIGN) → ghi _appendCallLog vào HĐ gốc', async () => {
      const origDoc = {
        ...mockOriginalInvoice,
        providerCallLogs: [],
      };

      jest.spyOn(Invoice, 'findOne').mockResolvedValue(origDoc);
      jest.spyOn(InvoiceService, '_resolveItems').mockResolvedValue(samplePayload.items);
      jest.spyOn(InvoiceService, '_generateInvoiceId').mockResolvedValue('INV-NEW-ADJUST');
      jest.spyOn(Invoice.prototype, 'save').mockResolvedValue({});
      const updateSpy = jest.spyOn(Invoice, 'findOneAndUpdate').mockResolvedValue({});

      jest.spyOn(InvoiceService, '_issueViaProvider').mockResolvedValue({
        id: 'INV-NEW-ADJUST',
        status: INVOICE_STATUSES.PENDING_SIGN,
        providerInvoiceGUID: 'guid-new-002',
      });

      const res = await InvoiceService.adjustInvoice('INV-ORIGINAL-001', samplePayload, 'user-1');

      expect(res.status).toBe(INVOICE_STATUSES.PENDING_SIGN);
      expect(updateSpy).toHaveBeenCalledWith(
        { id: 'INV-ORIGINAL-001' },
        {
          $set: {
            providerCallLogs: expect.arrayContaining([
              expect.objectContaining({
                action: 'adjust',
                cmdType: BKAV_CMD_TYPES.ADJUST_124,
                success: true,
              }),
            ]),
          },
        },
      );
    });

    test('thất bại (ERROR) → xoá draft lỗi và ghi _appendCallLog kèm errorMessage vào HĐ gốc', async () => {
      const origDoc = {
        ...mockOriginalInvoice,
        providerCallLogs: [],
      };

      jest.spyOn(Invoice, 'findOne').mockResolvedValue(origDoc);
      jest.spyOn(InvoiceService, '_resolveItems').mockResolvedValue(samplePayload.items);
      jest.spyOn(InvoiceService, '_generateInvoiceId').mockResolvedValue('INV-NEW-ADJUST');
      jest.spyOn(Invoice.prototype, 'save').mockResolvedValue({});
      const deleteSpy = jest.spyOn(Invoice, 'deleteOne').mockResolvedValue({});
      const updateSpy = jest.spyOn(Invoice, 'findOneAndUpdate').mockResolvedValue({});

      jest.spyOn(InvoiceService, '_issueViaProvider').mockResolvedValue({
        id: 'INV-NEW-ADJUST',
        status: INVOICE_STATUSES.ERROR,
        providerErrorCode: 'ERR_124',
        providerErrorMessage: 'Hóa đơn đã bị điều chỉnh trước đó',
      });

      const res = await InvoiceService.adjustInvoice('INV-ORIGINAL-001', samplePayload, 'user-1');

      expect(deleteSpy).toHaveBeenCalledWith({ id: 'INV-NEW-ADJUST' });
      expect(updateSpy).toHaveBeenCalledWith(
        { id: 'INV-ORIGINAL-001' },
        {
          $set: {
            providerErrorMessage: 'Lỗi điều chỉnh: Hóa đơn đã bị điều chỉnh trước đó',
            providerCallLogs: expect.arrayContaining([
              expect.objectContaining({
                action: 'adjust',
                cmdType: BKAV_CMD_TYPES.ADJUST_124,
                success: false,
                errorCode: 'ERR_124',
                errorMessage: 'Lỗi điều chỉnh: Hóa đơn đã bị điều chỉnh trước đó',
              }),
            ]),
          },
        },
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // replaceInvoice
  // ═══════════════════════════════════════════════════════════════════════════
  describe('replaceInvoice', () => {
    test('thành công (ISSUED) → ghi _appendCallLog vào HĐ gốc với action "replace" và cmdType 123', async () => {
      const origDoc = {
        ...mockOriginalInvoice,
        providerCallLogs: [],
      };

      jest.spyOn(Invoice, 'findOne').mockResolvedValue(origDoc);
      jest.spyOn(InvoiceService, '_resolveItems').mockResolvedValue(samplePayload.items);
      jest.spyOn(InvoiceService, '_generateInvoiceId').mockResolvedValue('INV-NEW-REPLACE');
      jest.spyOn(Invoice.prototype, 'save').mockResolvedValue({});
      const updateSpy = jest.spyOn(Invoice, 'findOneAndUpdate').mockResolvedValue({});

      jest.spyOn(InvoiceService, '_issueViaProvider').mockResolvedValue({
        id: 'INV-NEW-REPLACE',
        status: INVOICE_STATUSES.ISSUED,
        providerInvoiceGUID: 'guid-new-replace',
      });

      const res = await InvoiceService.replaceInvoice('INV-ORIGINAL-001', samplePayload, 'user-1');

      expect(res.status).toBe(INVOICE_STATUSES.ISSUED);
      expect(updateSpy).toHaveBeenCalledWith(
        { id: 'INV-ORIGINAL-001' },
        {
          $set: {
            status: INVOICE_STATUSES.REPLACED,
            providerErrorMessage: null,
            providerCallLogs: expect.arrayContaining([
              expect.objectContaining({
                action: 'replace',
                cmdType: BKAV_CMD_TYPES.REPLACE_123,
                success: true,
              }),
            ]),
          },
        },
      );
    });

    test('thất bại (ERROR) → xoá draft lỗi và ghi _appendCallLog kèm errorMessage vào HĐ gốc', async () => {
      const origDoc = {
        ...mockOriginalInvoice,
        providerCallLogs: [],
      };

      jest.spyOn(Invoice, 'findOne').mockResolvedValue(origDoc);
      jest.spyOn(InvoiceService, '_resolveItems').mockResolvedValue(samplePayload.items);
      jest.spyOn(InvoiceService, '_generateInvoiceId').mockResolvedValue('INV-NEW-REPLACE');
      jest.spyOn(Invoice.prototype, 'save').mockResolvedValue({});
      const deleteSpy = jest.spyOn(Invoice, 'deleteOne').mockResolvedValue({});
      const updateSpy = jest.spyOn(Invoice, 'findOneAndUpdate').mockResolvedValue({});

      jest.spyOn(InvoiceService, '_issueViaProvider').mockResolvedValue({
        id: 'INV-NEW-REPLACE',
        status: INVOICE_STATUSES.ERROR,
        providerErrorCode: 'ERR_123',
        providerErrorMessage: 'Hóa đơn đã bị thay thế trước đó',
      });

      const res = await InvoiceService.replaceInvoice('INV-ORIGINAL-001', samplePayload, 'user-1');

      expect(deleteSpy).toHaveBeenCalledWith({ id: 'INV-NEW-REPLACE' });
      expect(updateSpy).toHaveBeenCalledWith(
        { id: 'INV-ORIGINAL-001' },
        {
          $set: {
            providerErrorMessage: 'Lỗi thay thế: Hóa đơn đã bị thay thế trước đó',
            providerCallLogs: expect.arrayContaining([
              expect.objectContaining({
                action: 'replace',
                cmdType: BKAV_CMD_TYPES.REPLACE_123,
                success: false,
                errorCode: 'ERR_123',
                errorMessage: 'Lỗi thay thế: Hóa đơn đã bị thay thế trước đó',
              }),
            ]),
          },
        },
      );
    });
  });
});
