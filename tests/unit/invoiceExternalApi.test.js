let mockIdSeq = 0;
jest.mock('../../src/core/utils/id', () => ({
  generateMonotonicId: jest.fn(async (prefix) => {
    mockIdSeq += 1;
    return `${prefix}-20261120-${String(mockIdSeq).padStart(4, '0')}`;
  }),
  ID_PREFIXES: { INVOICE: 'INV', INVOICE_PROVIDER: 'IPR', INVOICE_PRODUCT: 'IVP' },
}));

const axios = require('axios');
const AdapterFactory = require('../../src/modules/invoice/adapters/AdapterFactory');
const InvoiceService = require('../../src/modules/invoice/invoice.service');
const Invoice = require('../../src/modules/invoice/invoice.model');
const InvoiceProvider = require('../../src/modules/invoice/invoiceProvider.model');
const InvoiceProduct = require('../../src/modules/invoice/invoiceProduct.model');
const ZCodeIdempotencyKey = require('../../src/modules/zcode/zcodeIdempotencyKey.model');
const {
  externalCreateInvoiceSchema,
  externalInvoiceItemSchema,
} = require('../../src/modules/invoice/invoice.validation');
const {
  normalizeIp,
  matchesIpOrCidr,
  getConfiguredPartners,
  findPartnerByIdentifier,
  isIpAllowedForPartner,
  createExternalInvoicePartnerAuth,
  authenticateExternalInvoicePartner,
  verifyExternalInvoiceIdempotency,
} = require('../../src/core/middleware/externalInvoiceAuth');
const env = require('../../src/core/config/env');
const {
  INVOICE_STATUSES,
  INVOICE_SOURCE_MODULES,
  BKAV_TAX_RATE_IDS,
  BKAV_MAX_INVOICES_PER_REQUEST,
} = require('../../src/core/constants/invoice');

describe('Invoice External API (Multi-Partner: Key.vn & Dynamic 3rd-Party Partners)', () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // 1. Multi-Partner Config & Auth Middleware
  // ═══════════════════════════════════════════════════════════════════════════
  describe('externalInvoiceAuth multi-partner middleware', () => {
    const mockPartnersEnv = {
      invoiceExternalPartners: env.buildInvoiceExternalPartners({
        KEYVN_API_KEY: 'keyvn_secret_key',
        KEYVN_ALLOWED_IPS: '1.1.1.1, 10.0.0.1',
        INVOICE_PARTNER_PARTNERB_API_KEY: 'partnerb_secret_key',
        INVOICE_PARTNER_PARTNERB_ALLOWED_IPS: '2.2.2.2',
        INVOICE_EXTERNAL_PARTNERS: JSON.stringify({
          partnerc: {
            name: 'Partner C',
            apiKey: 'partnerc_secret_key',
            allowedIps: ['3.3.3.3', '3.3.3.4'],
            sourceModule: 'partner_c',
            system: 'PARTNER_C',
          },
        }),
      }),
    };

    test('buildInvoiceExternalPartners tách biệt hoàn toàn cấu hình apiKey & allowedIps cho keyvn, đối tác động INVOICE_PARTNER_<NAME> và JSON INVOICE_EXTERNAL_PARTNERS', () => {
      const partners = getConfiguredPartners(mockPartnersEnv);
      expect(partners).toHaveLength(3);

      const keyvn = findPartnerByIdentifier('key.vn', partners);
      const partnerB = findPartnerByIdentifier('partnerb.vn', partners);
      const partnerC = findPartnerByIdentifier('partnerc', partners);

      expect(keyvn).toMatchObject({
        id: 'keyvn',
        sourceModule: INVOICE_SOURCE_MODULES.ZCODE,
        system: 'ZCODE',
        apiKey: 'keyvn_secret_key',
        allowedIps: '1.1.1.1, 10.0.0.1',
      });
      expect(partnerB).toMatchObject({
        id: 'partnerb',
        sourceModule: 'partnerb',
        system: 'PARTNERB',
        apiKey: 'partnerb_secret_key',
        allowedIps: '2.2.2.2',
      });
      expect(partnerC).toMatchObject({
        id: 'partnerc',
        sourceModule: 'partner_c',
        system: 'PARTNER_C',
        apiKey: 'partnerc_secret_key',
        allowedIps: '3.3.3.3,3.3.3.4',
      });
    });

    test('authenticateExternalInvoicePartner nhận diện đúng từng đối tác và gắn sourceModule/system riêng biệt', () => {
      const authMiddleware = createExternalInvoicePartnerAuth(mockPartnersEnv);

      // 1. Key.vn gọi từ IP 1.1.1.1
      const reqKeyvn = {
        header: jest.fn((h) => (h === 'X-API-Key' ? 'keyvn_secret_key' : null)),
        headers: {},
        ip: '1.1.1.1',
      };
      const resKeyvn = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const nextKeyvn = jest.fn();

      authMiddleware(reqKeyvn, resKeyvn, nextKeyvn);
      expect(nextKeyvn).toHaveBeenCalledTimes(1);
      expect(reqKeyvn.externalCaller).toBe('zcode');
      expect(reqKeyvn.externalPartner.id).toBe('keyvn');

      // 2. PartnerB (khai báo động qua INVOICE_PARTNER_PARTNERB_*) gọi từ IP 2.2.2.2
      const reqPartnerB = {
        header: jest.fn((h) =>
          h === 'X-API-Key' ? 'partnerb_secret_key' : null,
        ),
        headers: {},
        ip: '2.2.2.2',
      };
      const resPartnerB = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const nextPartnerB = jest.fn();

      authMiddleware(reqPartnerB, resPartnerB, nextPartnerB);
      expect(nextPartnerB).toHaveBeenCalledTimes(1);
      expect(reqPartnerB.externalCaller).toBe('partnerb');
      expect(reqPartnerB.externalPartner.id).toBe('partnerb');
      expect(reqPartnerB.externalPartner.system).toBe('PARTNERB');
    });

    test('Cô lập IP allowlist theo từng đối tác: IP của keyvn (1.1.1.1) gọi bằng key của partnerb sẽ bị chặn 403 PARTNERB_IP_FORBIDDEN', () => {
      const authMiddleware = createExternalInvoicePartnerAuth(mockPartnersEnv);
      const req = {
        header: jest.fn((h) =>
          h === 'X-API-Key' ? 'partnerb_secret_key' : null,
        ),
        headers: {},
        ip: '1.1.1.1', // IP của keyvn, không nằm trong INVOICE_PARTNER_PARTNERB_ALLOWED_IPS (2.2.2.2)
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      authMiddleware(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'PARTNERB_IP_FORBIDDEN',
        }),
      );
    });

    test('Khi gửi kèm header X-Partner-Id, bắt buộc X-API-Key phải khớp đúng đối tác đó (chặn dùng nhầm key giữa các đối tác)', () => {
      const authMiddleware = createExternalInvoicePartnerAuth(mockPartnersEnv);
      const req = {
        header: jest.fn((h) => {
          if (h === 'X-API-Key') return 'keyvn_secret_key';
          if (h === 'X-Partner-Id') return 'partnerb';
          return null;
        }),
        headers: {},
        ip: '1.1.1.1',
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      authMiddleware(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
    });

    test('authenticateExternalInvoicePartner mặc định chấp nhận ZCODE_API_KEY và từ chối key sai với 401', () => {
      const reqOk = {
        header: jest.fn((h) => (h === 'X-API-Key' ? env.zcodeApiKey : null)),
        headers: {},
        ip: '127.0.0.1',
      };
      const resOk = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const nextOk = jest.fn();
      authenticateExternalInvoicePartner(reqOk, resOk, nextOk);
      expect(nextOk).toHaveBeenCalledTimes(1);
      expect(reqOk.externalCaller).toBe(INVOICE_SOURCE_MODULES.ZCODE);

      const reqBad = {
        header: jest.fn(() => 'wrong-key'),
        headers: {},
        ip: '127.0.0.1',
      };
      const resBad = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const nextBad = jest.fn();
      authenticateExternalInvoicePartner(reqBad, resBad, nextBad);
      expect(nextBad).not.toHaveBeenCalled();
      expect(resBad.status).toHaveBeenCalledWith(401);
      expect(reqBad.zcodeSecurityContext.apiKeyValid).toBe(false);
    });

    test('isIpAllowedForPartner hỗ trợ ::ffff: IPv4-mapped IPv6, dải mạng CIDR và 0.0.0.0', () => {
      expect(normalizeIp('::ffff:103.112.10.20')).toBe('103.112.10.20');
      expect(matchesIpOrCidr('::ffff:103.112.10.20', '103.112.10.20')).toBe(true);
      expect(matchesIpOrCidr('103.112.10.25', '103.112.10.0/24')).toBe(true);
      expect(matchesIpOrCidr('103.112.11.25', '103.112.10.0/24')).toBe(false);

      expect(isIpAllowedForPartner('10.0.0.1', { allowedIps: '' })).toBe(true);
      expect(
        isIpAllowedForPartner('10.0.0.1', { allowedIps: '0.0.0.0, 1.2.3.4' }),
      ).toBe(true);
      expect(
        isIpAllowedForPartner('::ffff:1.2.3.4', { allowedIps: '1.2.3.4' }),
      ).toBe(true);
      expect(
        isIpAllowedForPartner('::ffff:10.0.5.99', { allowedIps: '10.0.5.0/24' }),
      ).toBe(true);
      expect(
        isIpAllowedForPartner('10.0.0.1', { allowedIps: '1.2.3.4, 10.0.5.0/24' }),
      ).toBe(false);
    });

    test('verifyExternalInvoiceIdempotency trả 409 INVOICE_EXTERNAL_IN_PROGRESS khi 2 request trùng key đến đồng thời', async () => {
      const dupErr = Object.assign(new Error('duplicate key'), { code: 11000 });
      jest.spyOn(ZCodeIdempotencyKey, 'create').mockRejectedValueOnce(dupErr);
      jest.spyOn(ZCodeIdempotencyKey, 'findOne').mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue({
          key: 'inv_ext:keyvn:same-key',
          status: 'processing',
        }),
      });

      const req = {
        header: jest.fn((h) => (h === 'X-Idempotency-Key' ? 'same-key' : null)),
        headers: {},
        externalPartner: { id: 'keyvn' },
        ip: '127.0.0.1',
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await verifyExternalInvoiceIdempotency(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'INVOICE_EXTERNAL_IN_PROGRESS' }),
      );
      jest.restoreAllMocks();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. Validation Schema
  // ═══════════════════════════════════════════════════════════════════════════
  describe('externalCreateInvoiceSchema & externalInvoiceItemSchema', () => {
    test('chấp nhận dòng hàng hoá chỉ truyền productId/id hoặc itemCode/productCode + quantity', () => {
      expect(
        externalInvoiceItemSchema.validate({ itemCode: 'ZB5000', quantity: 2 })
          .error,
      ).toBeUndefined();
      expect(
        externalInvoiceItemSchema.validate({
          productId: 'IVP-20261120-0001',
          quantity: 1,
        }).error,
      ).toBeUndefined();
      expect(
        externalInvoiceItemSchema.validate({
          id: 'IVP-20261120-0001',
          quantity: 3,
        }).error,
      ).toBeUndefined();
    });

    test('chấp nhận dòng hàng hoá inline khi truyền ĐẦY ĐỦ toàn bộ field bắt buộc theo từng loại dòng', () => {
      // goods: phải đủ itemName, unitName, quantity, unitPrice, taxRate
      expect(
        externalInvoiceItemSchema.validate({
          itemType: 'goods',
          itemName: 'Dòng goods',
          unitName: 'Gói',
          quantity: 1,
          unitPrice: 100000,
          taxRate: 10,
        }).error,
      ).toBeUndefined();

      // promotion: phải đủ itemName, unitName, quantity
      expect(
        externalInvoiceItemSchema.validate({
          itemType: 'promotion',
          itemName: 'Dòng KM',
          unitName: 'Tháng',
          quantity: 1,
        }).error,
      ).toBeUndefined();

      // discount: phải đủ itemName + amount > 0
      expect(
        externalInvoiceItemSchema.validate({
          itemType: 'discount',
          itemName: 'Chiết khấu',
          amount: 50000,
        }).error,
      ).toBeUndefined();

      // note: chỉ cần itemName
      expect(
        externalInvoiceItemSchema.validate({
          itemType: 'note',
          itemName: 'Ghi chú đơn hàng',
        }).error,
      ).toBeUndefined();

      // vehicle: đủ 5 trường goods + userDefineDetails
      expect(
        externalInvoiceItemSchema.validate({
          itemType: 'vehicle',
          itemName: 'Xe máy Honda',
          unitName: 'Chiếc',
          quantity: 1,
          unitPrice: 40000000,
          taxRate: 10,
          userDefineDetails: { SKhung: 'ABC', SMay: 'XYZ' },
        }).error,
      ).toBeUndefined();
    });

    test('từ chối dòng hàng hoá tự định nghĩa (không có productId/itemCode) nếu thiếu bất kỳ field bắt buộc nào (unitName, quantity, unitPrice, taxRate)', () => {
      const { error } = externalInvoiceItemSchema.validate({
        itemName: 'Gói dịch vụ thiếu field',
        quantity: 1,
      });
      expect(error).toBeDefined();
      expect(error.message).toContain('unitName');
      expect(error.message).toContain('unitPrice');
      expect(error.message).toContain('taxRate');
    });

    test('externalCreateInvoiceSchema mặc định isDraft = false, paymentMethod = TM/CK', () => {
      const { error, value } = externalCreateInvoiceSchema.validate({
        sourceId: 'KEYVN-1',
        items: [{ itemCode: 'ZB5000', quantity: 1 }],
      });
      expect(error).toBeUndefined();
      expect(value.isDraft).toBe(false);
      expect(value.paymentMethod).toBe('TM/CK');
      expect(value.providerId).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. Service: Single, Custom Template, Batch Array & Deduplication
  // ═══════════════════════════════════════════════════════════════════════════
  describe('InvoiceService.createExternalInvoices', () => {
    const mockProvider = {
      id: 'IPR-DEFAULT-01',
      name: 'BKAV Demo',
      providerType: 'bkav',
      invoiceForm: '1',
      invoiceSerial: 'C26MVK',
      isActive: true,
      isDefault: true,
      bkav: { autoSign: false, cmdType: 112 },
    };

    const mockSkuProduct = {
      id: 'IVP-20261120-0001',
      code: 'ZB5000',
      name: 'Gói ZCode ZB5000',
      unitName: 'Gói',
      unitPrice: 500000,
      taxRate: 10,
      taxRateId: 3,
      itemTypeId: 0,
      isActive: true,
    };

    beforeEach(() => {
      jest.clearAllMocks();
      jest.spyOn(InvoiceProvider, 'findOne').mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockProvider),
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('Single mode (SKU): tự động điền thông tin từ InvoiceProduct và phát hành qua provider mặc định', async () => {
      jest.spyOn(Invoice, 'findOne').mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });
      jest.spyOn(InvoiceProduct, 'findOne').mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockSkuProduct),
      });
      jest.spyOn(Invoice, 'create').mockImplementation(async (doc) => ({
        ...doc,
        toObject: () => doc,
      }));
      const issueSpy = jest
        .spyOn(InvoiceService, '_issueViaProvider')
        .mockImplementation(async (inv) => ({
          ...inv,
          status: INVOICE_STATUSES.PENDING_SIGN,
          invoiceNo: 15,
          lookupCode: 'MTC15',
        }));

      const res = await InvoiceService.createExternalInvoices(
        {
          sourceId: 'KEYVN-ORD-001',
          buyer: { type: 'company', name: 'A', unitName: 'Cty ABC', taxCode: '0101234567' },
          items: [{ itemCode: 'zb5000', quantity: 2 }],
        },
        { caller: INVOICE_SOURCE_MODULES.ZCODE },
      );

      expect(res.isBatch).toBe(false);
      expect(res.duplicate).toBe(false);
      expect(issueSpy).toHaveBeenCalledTimes(1);
      expect(res.invoice.sourceModule).toBe('zcode');
      expect(res.invoice.sourceId).toBe('KEYVN-ORD-001');
      expect(res.invoice.billCode).toBe('KEYVN-ORD-001');
      expect(res.invoice.totalAmountBeforeTax).toBe(1000000);
      expect(res.invoice.totalTaxAmount).toBe(100000);
      expect(res.invoice.totalAmount).toBe(1100000);
      expect(res.invoice.items[0].itemName).toBe('Gói ZCode ZB5000');
      expect(res.invoice.items[0].unitName).toBe('Gói');
    });

    test('Single mode (SKU không tồn tại / bị tắt): báo lỗi 400 rõ ràng', async () => {
      jest.spyOn(Invoice, 'findOne').mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });
      jest.spyOn(InvoiceProduct, 'findOne').mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      await expect(
        InvoiceService.createExternalInvoices(
          {
            sourceId: 'KEYVN-BAD-SKU',
            items: [{ itemCode: 'UNKNOWN_SKU', quantity: 1 }],
          },
          { caller: 'zcode' },
        ),
      ).rejects.toThrow('Không tìm thấy sản phẩm đang hoạt động với mã SKU "UNKNOWN_SKU"');
    });

    test('Custom inline template: hỗ trợ goods + promotion + discount + note + tự suy taxRateId 8% → 9', async () => {
      jest.spyOn(Invoice, 'findOne').mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });
      jest.spyOn(Invoice, 'create').mockImplementation(async (doc) => ({
        ...doc,
        toObject: () => doc,
      }));

      const res = await InvoiceService.createExternalInvoices(
        {
          isDraft: true,
          sourceId: 'CUSTOM-001',
          items: [
            {
              itemType: 'goods',
              itemName: 'Dịch vụ tuỳ chỉnh',
              unitName: 'Gói',
              quantity: 1,
              unitPrice: 1000000,
              taxRate: 8,
            },
            {
              itemType: 'promotion',
              itemName: 'Tặng kèm 1 tháng',
              unitName: 'Tháng',
              quantity: 1,
              unitPrice: 999999, // bị ép về 0 vì là khuyến mãi
            },
            {
              itemType: 'discount',
              itemName: 'Chiết khấu VIP',
              amount: 100000,
            },
            {
              itemType: 'note',
              itemName: 'Đơn hàng từ đối tác X',
            },
          ],
        },
        { caller: 'partner_x' },
      );

      expect(res.isBatch).toBe(false);
      expect(res.invoice.status).toBe(INVOICE_STATUSES.DRAFT);
      expect(res.invoice.buyer.name).toBe('Khách lẻ');
      expect(res.invoice.items).toHaveLength(4);
      // Hàng thường 8% → taxRateId = 9, tax = 80000
      expect(res.invoice.items[0].taxRateId).toBe(BKAV_TAX_RATE_IDS.TAX_8);
      expect(res.invoice.items[0].taxAmount).toBe(80000);
      // Khuyến mãi → itemTypeId = 15, amount = 0
      expect(res.invoice.items[1].itemTypeId).toBe(15);
      expect(res.invoice.items[1].amount).toBe(0);
      // Chiết khấu → isDiscount = true, amount = 100000
      expect(res.invoice.items[2].isDiscount).toBe(true);
      expect(res.invoice.items[2].taxAmount).toBe(0);
      // Ghi chú → itemTypeId = 4, quantity = 0
      expect(res.invoice.items[3].itemTypeId).toBe(4);
      expect(res.invoice.items[3].quantity).toBe(0);
      // Tổng: 1,000,000 - 100,000 CK = 900,000 trước thuế + 80,000 VAT = 980,000
      expect(res.invoice.totalAmountBeforeTax).toBe(900000);
      expect(res.invoice.totalDiscountAmount).toBe(100000);
      expect(res.invoice.totalTaxAmount).toBe(80000);
      expect(res.invoice.totalAmount).toBe(980000);
    });

    test('Batch array: prefetch Product 1 lần, tái sử dụng Provider 1 lần, mỗi phần tử xuất 1 hoá đơn riêng, phần tử lỗi không làm hỏng các phần tử khác', async () => {
      jest.spyOn(Invoice, 'findOne').mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });
      const productFindSpy = jest
        .spyOn(InvoiceProduct, 'find')
        .mockReturnValue({
          lean: jest.fn().mockResolvedValue([mockSkuProduct]),
        });
      let seq = 0;
      jest.spyOn(Invoice, 'create').mockImplementation(async (doc) => {
        seq += 1;
        const created = { ...doc, id: `INV-BATCH-${seq}` };
        return { ...created, toObject: () => created };
      });
      jest.spyOn(InvoiceService, '_issueViaProvider').mockImplementation(async (inv) => ({
        ...inv,
        status: INVOICE_STATUSES.ISSUED,
        invoiceNo: 100 + seq,
      }));

      const batchPayload = [
        {
          sourceId: 'ORD-1',
          buyer: { type: 'personal', name: 'KH 1' },
          items: [{ itemCode: 'ZB5000', quantity: 1 }],
        },
        {
          sourceId: 'ORD-2-INVALID',
          buyer: { type: 'personal', name: 'KH 2' },
          items: [{ itemCode: 'NON_EXISTENT', quantity: 1 }],
        },
        {
          sourceId: 'ORD-3',
          buyer: { type: 'personal', name: 'KH 3' },
          items: [
            {
              itemName: 'Hàng tự do',
              unitName: 'Lần',
              quantity: 2,
              unitPrice: 100000,
              taxRate: 0,
            },
          ],
        },
      ];

      const res = await InvoiceService.createExternalInvoices(batchPayload, {
        caller: 'zcode',
      });

      // Chống N+1: chỉ 1 query prefetch product và 1 query provider cho cả batch
      expect(productFindSpy).toHaveBeenCalledTimes(1);
      expect(InvoiceProvider.findOne).toHaveBeenCalledTimes(1);

      expect(res.isBatch).toBe(true);
      expect(res.total).toBe(3);
      expect(res.successCount).toBe(2);
      expect(res.failCount).toBe(1);
      expect(res.results[0].success).toBe(true);
      expect(res.results[0].invoice.id).toMatch(/^INV-BATCH-/);
      expect(res.results[1].success).toBe(false);
      expect(res.results[1].error).toContain('NON_EXISTENT');
      expect(res.results[2].success).toBe(true);
      expect(res.results[2].invoice.totalAmount).toBe(200000);
    });

    test('Bảo mật: chống giả mạo sourceModule từ client body và lọc sourceModule khi tra cứu GET /:id (chống IDOR)', async () => {
      jest.spyOn(Invoice, 'findOne').mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });
      jest.spyOn(Invoice, 'create').mockImplementation(async (doc) => ({
        ...doc,
        toObject: () => doc,
      }));

      // Partner B cố tình gửi sourceModule: 'zcode' trong body → phải bị ép về 'partnerb'
      const created = await InvoiceService.createExternalInvoices(
        {
          isDraft: true,
          sourceModule: 'zcode',
          sourceId: 'SPOOF-001',
          items: [
            {
              itemType: 'goods',
              itemName: 'Dịch vụ B',
              unitName: 'Gói',
              quantity: 1,
              unitPrice: 100000,
              taxRate: 10,
            },
          ],
        },
        { caller: 'partnerb' },
      );
      expect(created.invoice.sourceModule).toBe('partnerb');

      // Tra cứu getExternalInvoiceByRef bắt buộc truyền filter sourceModule = caller
      const findOneSpy = jest.spyOn(Invoice, 'findOne').mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null),
        }),
      });
      await expect(
        InvoiceService.getExternalInvoiceByRef('KEYVN-ORD-001', 'partnerb'),
      ).rejects.toThrow('Không tìm thấy hoá đơn');
      expect(findOneSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceModule: 'partnerb',
        }),
      );
    });

    test('Chống Race Condition: 2 request đến đồng thời với cùng (sourceModule, sourceId) chỉ tạo 1 hoá đơn, request thứ 2 trả duplicate=true', async () => {
      let createdRecord = null;
      jest.spyOn(Invoice, 'findOne').mockImplementation(() => ({
        lean: jest.fn().mockImplementation(async () => createdRecord),
      }));
      const createSpy = jest.spyOn(Invoice, 'create').mockImplementation(async (doc) => {
        await new Promise((r) => setTimeout(r, 30));
        createdRecord = { ...doc };
        return { ...doc, toObject: () => doc };
      });

      const payload = {
        isDraft: true,
        sourceId: 'CONCURRENT-ORD-01',
        items: [
          {
            itemType: 'goods',
            itemName: 'Dịch vụ',
            unitName: 'Gói',
            quantity: 1,
            unitPrice: 100000,
            taxRate: 10,
          },
        ],
      };

      const [r1, r2] = await Promise.all([
        InvoiceService.createExternalInvoices(payload, { caller: 'zcode' }),
        InvoiceService.createExternalInvoices(payload, { caller: 'zcode' }),
      ]);

      expect(createSpy).toHaveBeenCalledTimes(1);
      expect([r1.duplicate, r2.duplicate].sort()).toEqual([false, true]);
      expect(r1.invoice.id).toBe(r2.invoice.id);
    });

    test('syncFromProvider giữ nguyên taxRate = 0% (không bị biến thành 10%)', async () => {
      const mockInvDoc = {
        id: 'INV-TAX0',
        providerId: mockProvider.id,
        providerInvoiceGUID: 'guid-tax0',
        items: [],
        save: jest.fn().mockResolvedValue(true),
        toObject() {
          return this;
        },
      };
      jest.spyOn(Invoice, 'findOne').mockResolvedValue(mockInvDoc);
      const AdapterFactory = require('../../src/modules/invoice/adapters/AdapterFactory');
      jest.spyOn(AdapterFactory, 'create').mockReturnValue({
        getInfo: jest.fn().mockResolvedValue({
          success: true,
          crmStatus: INVOICE_STATUSES.ISSUED,
          data: {
            Invoice: { InvoiceNo: 10, InvoiceStatusID: 2 },
            ListInvoiceDetailsWS: [
              {
                ItemName: 'Dịch vụ VAT 0%',
                UnitName: 'Gói',
                Qty: 1,
                Price: 500000,
                Amount: 500000,
                TaxRateID: 1,
                TaxRate: 0,
                TaxAmount: 0,
              },
            ],
          },
        }),
      });

      await InvoiceService.syncFromProvider('INV-TAX0');
      expect(mockInvDoc.items[0].taxRate).toBe(0);
      expect(mockInvDoc.items[0].taxAmount).toBe(0);
    });

    test('Per-item deduplication: trả về hoá đơn cũ với duplicate=true khi trùng sourceId', async () => {
      const existingInv = {
        id: 'INV-EXISTING-01',
        status: INVOICE_STATUSES.ISSUED,
        sourceModule: 'zcode',
        sourceId: 'KEYVN-DUP-01',
        billCode: 'KEYVN-DUP-01',
        invoiceNo: 55,
        lookupCode: 'MTC55',
        totalAmount: 550000,
        items: [],
      };
      jest.spyOn(Invoice, 'findOne').mockReturnValue({
        lean: jest.fn().mockResolvedValue(existingInv),
      });
      const createSpy = jest.spyOn(Invoice, 'create');

      const res = await InvoiceService.createExternalInvoices(
        {
          sourceId: 'KEYVN-DUP-01',
          items: [{ itemCode: 'ZB5000', quantity: 1 }],
        },
        { caller: 'zcode' },
      );

      expect(res.duplicate).toBe(true);
      expect(res.invoice.id).toBe('INV-EXISTING-01');
      expect(createSpy).not.toHaveBeenCalled();
    });

    test('từ chối mảng rỗng hoặc vượt quá 30 hoá đơn mỗi request', async () => {
      await expect(
        InvoiceService.createExternalInvoices([], { caller: 'zcode' }),
      ).rejects.toThrow('không được để trống');

      const tooMany = Array.from({ length: BKAV_MAX_INVOICES_PER_REQUEST + 1 }, (_, i) => ({
        sourceId: `ORD-${i}`,
        items: [{ itemName: 'A', quantity: 1, unitPrice: 1000 }],
      }));
      await expect(
        InvoiceService.createExternalInvoices(tooMany, { caller: 'zcode' }),
      ).rejects.toThrow(`tối đa ${BKAV_MAX_INVOICES_PER_REQUEST}`);
    });

    test('getExternalInvoiceTemplate trả về đầy đủ enums và examples cho dev bên thứ 3', async () => {
      jest.spyOn(InvoiceProduct, 'find').mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([mockSkuProduct]),
        }),
      });

      const tpl = await InvoiceService.getExternalInvoiceTemplate();
      expect(tpl.maxInvoicesPerRequest).toBe(BKAV_MAX_INVOICES_PER_REQUEST);
      expect(tpl.enums.itemType).toHaveLength(5);
      expect(tpl.enums.taxRates).toHaveLength(7);
      expect(tpl.activeProductsCount).toBe(1);
      expect(tpl.examples.singleBySku.items[0].itemCode).toBe('ZB5000');
      expect(Array.isArray(tpl.examples.batchArray)).toBe(true);
    });

    test('Public Customer Lookup (getPublicInvoiceByCode): trả lookupUrl sạch cho khách hàng theo MTC và chặn dò quét bằng mã tuần tự INV-...', async () => {
      // 1. Chặn dò quét bằng mã tuần tự nội bộ INV-YYYYMMDD-XXXX hoặc mã ngắn < 6 ký tự
      await expect(
        InvoiceService.getPublicInvoiceByCode('INV-20261120-0001'),
      ).rejects.toThrow('Mã tra cứu hoá đơn không hợp lệ');
      await expect(
        InvoiceService.getPublicInvoiceByCode('123'),
      ).rejects.toThrow('Mã tra cứu hoá đơn không hợp lệ');

      // 2. Tra cứu hợp lệ theo lookupCode (MTC)
      jest.spyOn(Invoice, 'findOne').mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            id: 'INV-20261120-0014',
            status: INVOICE_STATUSES.ISSUED,
            providerType: 'bkav',
            invoiceForm: '1',
            invoiceSerial: 'C26MVK',
            invoiceNo: 14,
            lookupCode: 'UBOXN28UY5',
            maCuaCQT: 'M1-26-ANIHZ-00000000014',
            buyer: {
              type: 'company',
              name: 'Nguyễn Văn A',
              unitName: 'CÔNG TY ABC',
              taxCode: '0101234567',
              address: 'Hà Nội',
            },
            items: [
              {
                itemCode: 'ZB5000',
                itemName: 'Gói ZCode ZB5000',
                unitName: 'Gói',
                quantity: 1,
                unitPrice: 500000,
                amount: 500000,
                taxRate: 10,
                taxAmount: 50000,
              },
            ],
            totalAmountBeforeTax: 500000,
            totalTaxAmount: 50000,
            totalAmount: 550000,
            currency: 'VND',
            providerCallLogs: [{ action: 'issue', success: true }],
            sourceModule: 'zcode',
            createdBy: 'external:zcode',
          }),
        }),
      });

      const pub = await InvoiceService.getPublicInvoiceByCode('uboxn28uy5');
      expect(pub.lookupCode).toBe('UBOXN28UY5');
      expect(pub.lookupUrl).toBe(
        `${env.invoicePublicUrl || env.publicAppUrl}/tra-cuu-hoa-don/UBOXN28UY5`,
      );
      expect(pub.invoiceNo).toBe(14);
      // Không rò rỉ dữ liệu nội bộ CRM ra API public
      expect(pub.providerCallLogs).toBeUndefined();
      expect(pub.sourceModule).toBeUndefined();
      expect(pub.createdBy).toBeUndefined();
    });

    test('resolveInvoicePublicBaseUrl tách biệt khỏi CLIENT_URL (CORS): ưu tiên INVOICE_PUBLIC_URL -> PUBLIC_APP_URL, không lấy IP/CORS wildcard', () => {
      // 1. Ưu tiên INVOICE_PUBLIC_URL và tự động loại bỏ trailing slash
      expect(
        env.resolveInvoicePublicBaseUrl({
          NODE_ENV: 'production',
          CLIENT_URL: 'http://188.166.241.110,http://final.vn',
          PUBLIC_APP_URL: 'https://final.vn/',
          INVOICE_PUBLIC_URL: 'https://hoadon.final.vn///',
        }),
      ).toBe('https://hoadon.final.vn');

      // 2. Fallback sang PUBLIC_APP_URL khi không có INVOICE_PUBLIC_URL (bỏ qua CLIENT_URL)
      expect(
        env.resolveInvoicePublicBaseUrl({
          NODE_ENV: 'production',
          CLIENT_URL: 'http://188.166.241.110,http://final.vn',
          PUBLIC_APP_URL: 'https://final.vn/',
        }),
      ).toBe('https://final.vn');

      // 3. Trên production, nếu không cấu hình PUBLIC_APP_URL / INVOICE_PUBLIC_URL -> trả rỗng (không leak origin từ CLIENT_URL)
      expect(
        env.resolveInvoicePublicBaseUrl({
          NODE_ENV: 'production',
          CLIENT_URL: 'http://188.166.241.110,https://final.vn',
        }),
      ).toBe('');

      // 4. Từ chối giá trị không hợp lệ như '*' hoặc thiếu http(s)://
      expect(
        env.resolveInvoicePublicBaseUrl({
          NODE_ENV: 'production',
          PUBLIC_APP_URL: '*',
          INVOICE_PUBLIC_URL: 'final.vn',
        }),
      ).toBe('');

      // 5. Môi trường dev/test không cấu hình -> mặc định http://localhost:3001 (port CRM Client)
      expect(
        env.resolveInvoicePublicBaseUrl({
          NODE_ENV: 'development',
          CLIENT_URL: '*',
        }),
      ).toBe('http://localhost:3001');
    });

    test('lookupTaxInfo: tra cứu theo CCCD 12 số đọc được tên cá nhân/chủ hộ từ BKAV (ChuDoanhNghiep/TenNNT) và fallback qua CRM history khi BKAV trả tên rỗng', async () => {
      // 1. Validate độ dài < 10 ký tự
      await expect(InvoiceService.lookupTaxInfo('12345')).rejects.toThrow(
        'Mã số thuế / CCCD không hợp lệ',
      );

      // 2. BKAV trả thông tin cá nhân/hộ KD theo CCCD 12 số (TenChinhThuc rỗng nhưng ChuDoanhNghiep có tên)
      jest.spyOn(InvoiceProvider, 'findOne').mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockProvider),
        }),
      });
      jest.spyOn(AdapterFactory, 'create').mockReturnValue({
        lookupTaxCode: jest.fn().mockResolvedValue({
          success: true,
          data: {
            MaSoThue: '079095123456',
            TenChinhThuc: '',
            ChuDoanhNghiep: 'NGUYỄN VĂN CÁ NHÂN',
            DiaChiGiaoDichChinh: '123 Lê Lợi, Quận 1, TP.HCM',
            TrangThaiHoatDong: 'NNT đang hoạt động',
          },
        }),
      });

      const res1 = await InvoiceService.lookupTaxInfo('079095123456');
      expect(res1).toMatchObject({
        taxCode: '079095123456',
        cccd: '079095123456',
        name: 'NGUYỄN VĂN CÁ NHÂN',
        owner: 'NGUYỄN VĂN CÁ NHÂN',
        address: '123 Lê Lợi, Quận 1, TP.HCM',
        source: 'bkav',
      });

      // 3. Khi BKAV trả về object rỗng { TenChinhThuc: '' } -> KHÔNG được short-circuit trả { name: '' }, phải rơi xuống fallback (CRM history theo buyer.cccd)
      jest.spyOn( axios, 'get' ).mockRejectedValue(new Error('Network offline in unit test'));
      jest.spyOn(AdapterFactory, 'create').mockReturnValue({
        lookupTaxCode: jest.fn().mockResolvedValue({
          success: true,
          data: { MaSoThue: '001099888777', TenChinhThuc: '' },
        }),
      });
      jest.spyOn(Invoice, 'findOne').mockReturnValue({
        sort: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue({
              buyer: {
                type: 'personal',
                name: 'Trần Thị Khách Hàng',
                cccd: '001099888777',
                address: 'Hà Nội',
                email: 'khach@example.com',
                phone: '0909123456',
              },
            }),
          }),
        }),
      });

      const res2 = await InvoiceService.lookupTaxInfo('001099888777');
      expect(res2).toMatchObject({
        cccd: '001099888777',
        name: 'Trần Thị Khách Hàng',
        address: 'Hà Nội',
        email: 'khach@example.com',
        phone: '0909123456',
        source: 'crm_history',
      });
    });
  });
});
