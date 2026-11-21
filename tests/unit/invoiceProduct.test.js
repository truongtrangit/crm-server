const {
  createInvoiceProductSchema,
  updateInvoiceProductSchema,
} = require('../../src/modules/invoice/invoice.validation');
const InvoiceService = require('../../src/modules/invoice/invoice.service');
const InvoiceProduct = require('../../src/modules/invoice/invoiceProduct.model');

describe('InvoiceProduct Validation & Service', () => {
  describe('createInvoiceProductSchema', () => {
    it('accepts valid product payload', () => {
      const payload = {
        code: 'COURSE_AI_PRO',
        name: 'Khóa học AI Automation Master',
        unitName: 'Khóa',
        unitPrice: 5000000,
        taxRate: 10,
        taxRateId: 3,
        description: 'Khóa học đào tạo chuyên sâu',
      };
      const { error, value } = createInvoiceProductSchema.validate(payload);
      expect(error).toBeUndefined();
      expect(value.code).toBe('COURSE_AI_PRO');
      expect(value.isActive).toBe(true);
      expect(value.unitName).toBe('Khóa');
    });

    it('requires code and name', () => {
      const { error: codeErr } = createInvoiceProductSchema.validate({ name: 'Test' });
      expect(codeErr).toBeDefined();

      const { error: nameErr } = createInvoiceProductSchema.validate({ code: 'TEST' });
      expect(nameErr).toBeDefined();
    });

    it('uppercases and trims code', () => {
      const { value } = createInvoiceProductSchema.validate({
        code: '  course_ai  ',
        name: 'AI Course',
      });
      expect(value.code).toBe('COURSE_AI');
    });
  });

  describe('_resolveItems in InvoiceService', () => {
    it('auto-fills item details from InvoiceProduct when itemCode matches', async () => {
      const mockProduct = {
        id: 'IVP-20261111-0001',
        code: 'COURSE_VIP',
        name: 'Khóa học VIP',
        unitName: 'Khóa',
        unitPrice: 10000000,
        taxRate: 10,
        taxRateId: 3,
        itemTypeId: 0,
      };

      jest.spyOn(InvoiceProduct, 'findOne').mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockProduct),
      });

      const rawItems = [
        {
          itemCode: 'course_vip',
          quantity: 2,
        },
      ];

      const resolved = await InvoiceService._resolveItems(rawItems);
      expect(resolved.length).toBe(1);
      expect(resolved[0].itemName).toBe('Khóa học VIP');
      expect(resolved[0].unitName).toBe('Khóa');
      expect(resolved[0].unitPrice).toBe(10000000);
      expect(resolved[0].amount).toBe(20000000);
      expect(resolved[0].taxRate).toBe(10);
      expect(resolved[0].taxRateId).toBe(3);
      expect(resolved[0].taxAmount).toBe(2000000);

      InvoiceProduct.findOne.mockRestore();
    });

    it('keeps custom price and overrides if specified', async () => {
      const mockProduct = {
        id: 'IVP-20261111-0002',
        code: 'TOPUP',
        name: 'Nạp tiền Credit',
        unitName: 'Lần',
        unitPrice: 100000,
        taxRate: -1,
        taxRateId: 4,
        itemTypeId: 0,
      };

      jest.spyOn(InvoiceProduct, 'findOne').mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockProduct),
      });

      const rawItems = [
        {
          itemCode: 'TOPUP',
          quantity: 1,
          unitPrice: 500000,
        },
      ];

      const resolved = await InvoiceService._resolveItems(rawItems);
      expect(resolved[0].unitPrice).toBe(500000);
      expect(resolved[0].amount).toBe(500000);
      expect(resolved[0].taxRate).toBe(-1);
      expect(resolved[0].taxRateId).toBe(4);
      expect(resolved[0].taxAmount).toBe(0);

      InvoiceProduct.findOne.mockRestore();
    });
  });

  describe('_calculateTotals with discount rows (TC-CREATE-05)', () => {
    it('correctly deducts discount row from total amount before tax while tax applies only to goods', () => {
      const items = [
        {
          itemName: 'Mặt hàng 1',
          amount: 1000000,
          taxRate: 10,
          taxAmount: 100000,
          isDiscount: false,
          itemTypeId: 0,
        },
        {
          itemName: 'Chiết khấu thương mại',
          amount: 100000,
          taxRate: 0,
          taxAmount: 0,
          isDiscount: true,
          itemTypeId: 30,
        },
      ];

      const totals = InvoiceService._calculateTotals(items);
      expect(totals.totalDiscountAmount).toBe(100000);
      expect(totals.totalAmountBeforeTax).toBe(900000);
      expect(totals.totalTaxAmount).toBe(100000);
      expect(totals.totalAmount).toBe(1000000);
    });

    it('_resolveItems zeroes out tax for discount rows', async () => {
      const rawItems = [
        {
          itemName: 'Chiết khấu thương mại',
          quantity: 1,
          unitPrice: 100000,
          taxRate: 10, // Giả sử client vô tình gửi taxRate
          isDiscount: true,
          itemTypeId: 30,
        },
      ];

      const resolved = await InvoiceService._resolveItems(rawItems);
      expect(resolved[0].amount).toBe(100000);
      expect(resolved[0].taxRate).toBe(0);
      expect(resolved[0].taxRateId).toBe(1);
      expect(resolved[0].taxAmount).toBe(0);
      expect(resolved[0].isDiscount).toBe(true);
    });
  });
});

