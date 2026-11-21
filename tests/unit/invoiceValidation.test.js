const {
  createInvoiceSchema,
  updateInvoiceSchema,
  replaceAdjustInvoiceSchema,
  createProviderSchema,
  updateProviderSchema,
  createInvoiceProductSchema,
  updateInvoiceProductSchema,
} = require('../../src/modules/invoice/invoice.validation');

const {
  INVOICE_PROVIDER_TYPES,
  BKAV_CMD_TYPES,
} = require('../../src/core/constants/invoice');

// ─── Helpers ────────────────────────────────────────────────────────────────

const validate = (schema, data) => schema.validate(data, { abortEarly: false });

const validItem = {
  itemName: 'Dịch vụ A',
  quantity: 1,
  unitPrice: 100000,
  amount: 100000,
};

const validBuyer = {
  type: 'company',
  name: 'Công ty ABC',
  taxCode: '0123456789',
};

const validCreateInvoice = {
  providerId: 'provider-1',
  items: [validItem],
};

const validBkavConfig = {
  partnerGUID: '00000000-0000-0000-0000-000000000001',
  partnerToken: 'token-secret',
  endpoint: 'https://wsdemo.ehoadon.vn/WSPublicEHoaDon.asmx',
};

const validSepayConfig = {
  bearerToken: 'sepay-token-secret',
  endpoint: 'https://api.sepay.vn/invoices',
};

const validCreateProvider = (type = INVOICE_PROVIDER_TYPES.BKAV) => ({
  name: 'Provider A',
  providerType: type,
  ...(type === INVOICE_PROVIDER_TYPES.BKAV ? { bkav: validBkavConfig } : {}),
  ...(type === INVOICE_PROVIDER_TYPES.SEPAY ? { sepay: validSepayConfig } : {}),
  ...(type === INVOICE_PROVIDER_TYPES.BKAV ? { bkav: { ...validBkavConfig } } : {}),
  ...(type === INVOICE_PROVIDER_TYPES.SEPAY ? { sepay: { ...validSepayConfig } } : {}),
});

// ═════════════════════════════════════════════════════════════════════════════
// createInvoiceSchema
// ═════════════════════════════════════════════════════════════════════════════

describe('createInvoiceSchema', () => {
  describe('trường bắt buộc', () => {
    it('thành công với dữ liệu tối thiểu', () => {
      const { error } = validate(createInvoiceSchema, validCreateInvoice);
      expect(error).toBeUndefined();
    });

    it('lỗi khi thiếu providerId', () => {
      const { error } = validate(createInvoiceSchema, { items: [validItem] });
      expect(error).toBeDefined();
      expect(error.details[0].type).toBe('any.required');
    });

    it('lỗi khi providerId là chuỗi rỗng', () => {
      const { error } = validate(createInvoiceSchema, { providerId: '', items: [validItem] });
      expect(error).toBeDefined();
      expect(error.details[0].type).toBe('string.empty');
    });

    it('lỗi khi thiếu items', () => {
      const { error } = validate(createInvoiceSchema, { providerId: 'p1' });
      expect(error).toBeDefined();
      expect(error.details[0].type).toBe('any.required');
    });

    it('lỗi khi items là mảng rỗng', () => {
      const { error } = validate(createInvoiceSchema, { providerId: 'p1', items: [] });
      expect(error).toBeDefined();
      expect(error.details[0].type).toBe('array.min');
    });
  });

  describe('giá trị mặc định', () => {
    it('isDraft mặc định là true', () => {
      const { value } = validate(createInvoiceSchema, validCreateInvoice);
      expect(value.isDraft).toBe(true);
    });

    it('paymentMethod mặc định là "TM/CK"', () => {
      const { value } = validate(createInvoiceSchema, validCreateInvoice);
      expect(value.paymentMethod).toBe('TM/CK');
    });

    it('currency mặc định là "VND"', () => {
      const { value } = validate(createInvoiceSchema, validCreateInvoice);
      expect(value.currency).toBe('VND');
    });

    it('exchangeRate mặc định là 1', () => {
      const { value } = validate(createInvoiceSchema, validCreateInvoice);
      expect(value.exchangeRate).toBe(1);
    });

    it('invoiceNo mặc định là 0', () => {
      const { value } = validate(createInvoiceSchema, validCreateInvoice);
      expect(value.invoiceNo).toBe(0);
    });

    it('note, billCode, userDefine mặc định là chuỗi rỗng', () => {
      const { value } = validate(createInvoiceSchema, validCreateInvoice);
      expect(value.note).toBe('');
      expect(value.billCode).toBe('');
      expect(value.userDefine).toBe('');
    });

    it('invoiceForm, invoiceSerial mặc định là null', () => {
      const { value } = validate(createInvoiceSchema, validCreateInvoice);
      expect(value.invoiceForm).toBeNull();
      expect(value.invoiceSerial).toBeNull();
    });

    it('invoiceDate mặc định là null', () => {
      const { value } = validate(createInvoiceSchema, validCreateInvoice);
      expect(value.invoiceDate).toBeNull();
    });

    it('relatedInvoiceId, relationType mặc định là null', () => {
      const { value } = validate(createInvoiceSchema, validCreateInvoice);
      expect(value.relatedInvoiceId).toBeNull();
      expect(value.relationType).toBeNull();
    });

    it('sourceModule, sourceId mặc định là null', () => {
      const { value } = validate(createInvoiceSchema, validCreateInvoice);
      expect(value.sourceModule).toBeNull();
      expect(value.sourceId).toBeNull();
    });
  });

  describe('paymentMethod — giá trị hợp lệ / không hợp lệ', () => {
    it.each(['TM', 'CK', 'TM/CK'])('chấp nhận "%s"', (method) => {
      const { error } = validate(createInvoiceSchema, { ...validCreateInvoice, paymentMethod: method });
      expect(error).toBeUndefined();
    });

    it('từ chối giá trị không hợp lệ', () => {
      const { error } = validate(createInvoiceSchema, { ...validCreateInvoice, paymentMethod: 'VISA' });
      expect(error).toBeDefined();
      expect(error.details[0].type).toBe('any.only');
    });
  });

  describe('exchangeRate', () => {
    it('từ chối giá trị âm', () => {
      const { error } = validate(createInvoiceSchema, { ...validCreateInvoice, exchangeRate: -1 });
      expect(error).toBeDefined();
      expect(error.details[0].type).toBe('number.min');
    });
  });

  describe('invoiceNo', () => {
    it('từ chối số âm', () => {
      const { error } = validate(createInvoiceSchema, { ...validCreateInvoice, invoiceNo: -1 });
      expect(error).toBeDefined();
    });

    it('từ chối số thập phân', () => {
      const { error } = validate(createInvoiceSchema, { ...validCreateInvoice, invoiceNo: 1.5 });
      expect(error).toBeDefined();
      expect(error.details[0].type).toBe('number.integer');
    });
  });

  describe('relationType — giá trị hợp lệ', () => {
    it.each(['replacement', 'adjustment', 'adjustment_discount', null])(
      'chấp nhận "%s"',
      (val) => {
        const { error } = validate(createInvoiceSchema, { ...validCreateInvoice, relationType: val });
        expect(error).toBeUndefined();
      },
    );

    it('từ chối giá trị không hợp lệ', () => {
      const { error } = validate(createInvoiceSchema, { ...validCreateInvoice, relationType: 'cancel' });
      expect(error).toBeDefined();
    });
  });

  describe('isDraft', () => {
    it('chấp nhận false (phát hành ngay)', () => {
      const { error, value } = validate(createInvoiceSchema, { ...validCreateInvoice, isDraft: false });
      expect(error).toBeUndefined();
      expect(value.isDraft).toBe(false);
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// buyer sub-schema (kiểm tra qua createInvoiceSchema)
// ═════════════════════════════════════════════════════════════════════════════

describe('buyerSchema (qua createInvoiceSchema)', () => {
  const withBuyer = (buyer) => ({ ...validCreateInvoice, buyer });

  describe('giá trị mặc định', () => {
    it('buyer có giá trị mặc định khi không truyền', () => {
      const { value } = validate(createInvoiceSchema, validCreateInvoice);
      expect(value.buyer).toBeDefined();
      expect(value.buyer.type).toBe('company');
      expect(value.buyer.code).toBe('');
      expect(value.buyer.name).toBe('');
    });
  });

  describe('buyer.type — giá trị hợp lệ', () => {
    it.each(['company', 'personal'])('chấp nhận "%s"', (type) => {
      const { error } = validate(createInvoiceSchema, withBuyer({ type }));
      expect(error).toBeUndefined();
    });

    it('từ chối giá trị không hợp lệ', () => {
      const { error } = validate(createInvoiceSchema, withBuyer({ type: 'government' }));
      expect(error).toBeDefined();
    });
  });

  describe('buyer.code — chấp nhận chuỗi rỗng (trường mới)', () => {
    it('chấp nhận chuỗi rỗng', () => {
      const { error, value } = validate(createInvoiceSchema, withBuyer({ code: '' }));
      expect(error).toBeUndefined();
      expect(value.buyer.code).toBe('');
    });

    it('chấp nhận chuỗi có giá trị', () => {
      const { error, value } = validate(createInvoiceSchema, withBuyer({ code: 'KH001' }));
      expect(error).toBeUndefined();
      expect(value.buyer.code).toBe('KH001');
    });

    it('trim khoảng trắng', () => {
      const { value } = validate(createInvoiceSchema, withBuyer({ code: '  KH001  ' }));
      expect(value.buyer.code).toBe('KH001');
    });
  });

  describe('buyer.email', () => {
    it('chấp nhận email hợp lệ', () => {
      const { error } = validate(createInvoiceSchema, withBuyer({ email: 'test@example.com' }));
      expect(error).toBeUndefined();
    });

    it('chấp nhận chuỗi rỗng', () => {
      const { error } = validate(createInvoiceSchema, withBuyer({ email: '' }));
      expect(error).toBeUndefined();
    });

    it('từ chối email không hợp lệ', () => {
      const { error } = validate(createInvoiceSchema, withBuyer({ email: 'not-an-email' }));
      expect(error).toBeDefined();
      expect(error.details[0].type).toBe('string.email');
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// invoiceItemSchema (kiểm tra qua createInvoiceSchema.items)
// ═════════════════════════════════════════════════════════════════════════════

describe('invoiceItemSchema (qua createInvoiceSchema.items)', () => {
  const withItems = (items) => ({ ...validCreateInvoice, items });

  describe('giá trị mặc định', () => {
    it('gán mặc định cho tất cả các trường', () => {
      const { value } = validate(createInvoiceSchema, { providerId: 'p1', items: [{ itemName: 'X' }] });
      const item = value.items[0];
      expect(item.productId).toBeNull();
      expect(item.itemCode).toBe('');
      expect(item.unitName).toBe('');
      expect(item.quantity).toBe(0);
      expect(item.unitPrice).toBe(0);
      expect(item.amount).toBe(0);
      expect(item.taxRateId).toBe(3);
      expect(item.taxRate).toBe(10);
      expect(item.taxAmount).toBe(0);
      expect(item.discountRate).toBe(0);
      expect(item.discountAmount).toBe(0);
      expect(item.isDiscount).toBe(false);
      expect(item.itemTypeId).toBe(0);
      expect(item.userDefineDetails).toBe('');
      expect(item.isIncrease).toBeNull();
    });
  });

  describe('taxRate — min -4 (invoiceItem)', () => {
    it('chấp nhận taxRate = -4', () => {
      const { error } = validate(createInvoiceSchema, withItems([{ ...validItem, taxRate: -4 }]));
      expect(error).toBeUndefined();
    });

    it('chấp nhận taxRate = -1 (KCT)', () => {
      const { error } = validate(createInvoiceSchema, withItems([{ ...validItem, taxRate: -1 }]));
      expect(error).toBeUndefined();
    });

    it('chấp nhận taxRate = -2 (KKK)', () => {
      const { error } = validate(createInvoiceSchema, withItems([{ ...validItem, taxRate: -2 }]));
      expect(error).toBeUndefined();
    });

    it('từ chối taxRate < -4', () => {
      const { error } = validate(createInvoiceSchema, withItems([{ ...validItem, taxRate: -5 }]));
      expect(error).toBeDefined();
      expect(error.details[0].type).toBe('number.min');
    });

    it('từ chối taxRate > 100', () => {
      const { error } = validate(createInvoiceSchema, withItems([{ ...validItem, taxRate: 101 }]));
      expect(error).toBeDefined();
      expect(error.details[0].type).toBe('number.max');
    });
  });

  describe('quantity / unitPrice — cho phép số âm (hoá đơn điều chỉnh)', () => {
    it('chấp nhận quantity âm', () => {
      const { error } = validate(createInvoiceSchema, withItems([{ ...validItem, quantity: -5 }]));
      expect(error).toBeUndefined();
    });

    it('chấp nhận unitPrice âm', () => {
      const { error } = validate(createInvoiceSchema, withItems([{ ...validItem, unitPrice: -100000 }]));
      expect(error).toBeUndefined();
    });

    it('chấp nhận amount âm', () => {
      const { error } = validate(createInvoiceSchema, withItems([{ ...validItem, amount: -500000 }]));
      expect(error).toBeUndefined();
    });
  });

  describe('taxRateId', () => {
    it('từ chối taxRateId = 0 (min 1)', () => {
      const { error } = validate(createInvoiceSchema, withItems([{ ...validItem, taxRateId: 0 }]));
      expect(error).toBeDefined();
      expect(error.details[0].type).toBe('number.min');
    });

    it('từ chối số thập phân', () => {
      const { error } = validate(createInvoiceSchema, withItems([{ ...validItem, taxRateId: 1.5 }]));
      expect(error).toBeDefined();
      expect(error.details[0].type).toBe('number.integer');
    });
  });

  describe('discountRate / discountAmount — không cho phép số âm', () => {
    it('từ chối discountRate âm', () => {
      const { error } = validate(createInvoiceSchema, withItems([{ ...validItem, discountRate: -1 }]));
      expect(error).toBeDefined();
      expect(error.details[0].type).toBe('number.min');
    });

    it('từ chối discountRate > 100', () => {
      const { error } = validate(createInvoiceSchema, withItems([{ ...validItem, discountRate: 101 }]));
      expect(error).toBeDefined();
    });

    it('từ chối discountAmount âm', () => {
      const { error } = validate(createInvoiceSchema, withItems([{ ...validItem, discountAmount: -1 }]));
      expect(error).toBeDefined();
    });
  });

  describe('productId', () => {
    it('chấp nhận null', () => {
      const { error, value } = validate(createInvoiceSchema, withItems([{ ...validItem, productId: null }]));
      expect(error).toBeUndefined();
      expect(value.items[0].productId).toBeNull();
    });

    it('chấp nhận chuỗi rỗng', () => {
      const { error } = validate(createInvoiceSchema, withItems([{ ...validItem, productId: '' }]));
      expect(error).toBeUndefined();
    });
  });

  describe('isIncrease', () => {
    it.each([true, false, null])('chấp nhận %p', (val) => {
      const { error } = validate(createInvoiceSchema, withItems([{ ...validItem, isIncrease: val }]));
      expect(error).toBeUndefined();
    });
  });

  describe('unknown keys — cho phép trường bổ sung', () => {
    it('giữ nguyên trường không khai báo', () => {
      const { error, value } = validate(createInvoiceSchema, withItems([{ ...validItem, customField: 'xyz' }]));
      expect(error).toBeUndefined();
      expect(value.items[0].customField).toBe('xyz');
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// updateInvoiceSchema
// ═════════════════════════════════════════════════════════════════════════════

describe('updateInvoiceSchema', () => {
  it('thành công khi cập nhật ít nhất 1 trường', () => {
    const { error } = validate(updateInvoiceSchema, { note: 'Ghi chú mới' });
    expect(error).toBeUndefined();
  });

  it('lỗi khi body rỗng (min 1 key)', () => {
    const { error } = validate(updateInvoiceSchema, {});
    expect(error).toBeDefined();
    expect(error.details[0].type).toBe('object.min');
  });

  it('không yêu cầu providerId', () => {
    const { error } = validate(updateInvoiceSchema, { currency: 'USD' });
    expect(error).toBeUndefined();
  });

  it('items không bắt buộc nhưng nếu có phải >= 1 phần tử', () => {
    const { error: noItems } = validate(updateInvoiceSchema, { note: 'ok' });
    expect(noItems).toBeUndefined();

    const { error: emptyItems } = validate(updateInvoiceSchema, { items: [] });
    expect(emptyItems).toBeDefined();
    expect(emptyItems.details[0].type).toBe('array.min');
  });

  it('chấp nhận isDraft', () => {
    const { error } = validate(updateInvoiceSchema, { isDraft: false });
    expect(error).toBeUndefined();
  });

  it('không có giá trị mặc định (partial update)', () => {
    const { value } = validate(updateInvoiceSchema, { note: 'test' });
    expect(value.paymentMethod).toBeUndefined();
    expect(value.currency).toBeUndefined();
  });

  it('chấp nhận paymentMethod hợp lệ', () => {
    const { error } = validate(updateInvoiceSchema, { paymentMethod: 'CK' });
    expect(error).toBeUndefined();
  });

  it('từ chối paymentMethod không hợp lệ', () => {
    const { error } = validate(updateInvoiceSchema, { paymentMethod: 'MOMO' });
    expect(error).toBeDefined();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// replaceAdjustInvoiceSchema
// ═════════════════════════════════════════════════════════════════════════════

describe('replaceAdjustInvoiceSchema', () => {
  const validReplace = {
    reason: 'Sai thông tin người mua',
    items: [validItem],
  };

  describe('trường bắt buộc', () => {
    it('thành công với dữ liệu tối thiểu', () => {
      const { error } = validate(replaceAdjustInvoiceSchema, validReplace);
      expect(error).toBeUndefined();
    });

    it('lỗi khi thiếu reason', () => {
      const { error } = validate(replaceAdjustInvoiceSchema, { items: [validItem] });
      expect(error).toBeDefined();
      expect(error.details[0].type).toBe('any.required');
    });

    it('lỗi khi reason là chuỗi rỗng', () => {
      const { error } = validate(replaceAdjustInvoiceSchema, { reason: '', items: [validItem] });
      expect(error).toBeDefined();
      expect(error.details[0].type).toBe('string.empty');
    });

    it('lỗi khi thiếu items', () => {
      const { error } = validate(replaceAdjustInvoiceSchema, { reason: 'Lý do' });
      expect(error).toBeDefined();
      expect(error.details[0].type).toBe('any.required');
    });

    it('lỗi khi items rỗng', () => {
      const { error } = validate(replaceAdjustInvoiceSchema, { reason: 'Lý do', items: [] });
      expect(error).toBeDefined();
      expect(error.details[0].type).toBe('array.min');
    });
  });

  describe('trường tuỳ chọn', () => {
    it('chấp nhận buyer, paymentMethod, currency', () => {
      const { error } = validate(replaceAdjustInvoiceSchema, {
        ...validReplace,
        buyer: validBuyer,
        paymentMethod: 'TM',
        currency: 'USD',
        exchangeRate: 23000,
      });
      expect(error).toBeUndefined();
    });

    it('chấp nhận invoiceForm, invoiceSerial, invoiceDate', () => {
      const { error } = validate(replaceAdjustInvoiceSchema, {
        ...validReplace,
        invoiceForm: '01GTKT0/001',
        invoiceSerial: 'AA/22E',
        invoiceDate: new Date(),
      });
      expect(error).toBeUndefined();
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// createProviderSchema
// ═════════════════════════════════════════════════════════════════════════════

describe('createProviderSchema', () => {
  describe('trường bắt buộc', () => {
    it('thành công với provider BKAV', () => {
      const { error } = validate(createProviderSchema, validCreateProvider(INVOICE_PROVIDER_TYPES.BKAV));
      expect(error).toBeUndefined();
    });

    it('thành công với provider SePay', () => {
      const { error } = validate(createProviderSchema, validCreateProvider(INVOICE_PROVIDER_TYPES.SEPAY));
      expect(error).toBeUndefined();
    });

    it('lỗi khi thiếu name', () => {
      const data = { ...validCreateProvider(), name: undefined };
      const { error } = validate(createProviderSchema, data);
      expect(error).toBeDefined();
    });

    it('lỗi khi name là chuỗi rỗng', () => {
      const data = { ...validCreateProvider(), name: '' };
      const { error } = validate(createProviderSchema, data);
      expect(error).toBeDefined();
      expect(error.details[0].type).toBe('string.empty');
    });

    it('lỗi khi thiếu providerType', () => {
      const { error } = validate(createProviderSchema, { name: 'P1', bkav: validBkavConfig });
      expect(error).toBeDefined();
    });

    it('từ chối providerType không hợp lệ', () => {
      const { error } = validate(createProviderSchema, { name: 'P1', providerType: 'vnpt' });
      expect(error).toBeDefined();
      expect(error.details[0].type).toBe('any.only');
    });
  });

  describe('providerType hợp lệ', () => {
    it.each(Object.values(INVOICE_PROVIDER_TYPES))('chấp nhận "%s"', (type) => {
      const { error } = validate(createProviderSchema, validCreateProvider(type));
      expect(error).toBeUndefined();
    });
  });

  describe('giá trị mặc định', () => {
    it('isActive mặc định là true', () => {
      const { value } = validate(createProviderSchema, validCreateProvider());
      expect(value.isActive).toBe(true);
    });

    it('isDefault mặc định là false', () => {
      const { value } = validate(createProviderSchema, validCreateProvider());
      expect(value.isDefault).toBe(false);
    });

    it('emailNotification.enabled mặc định là false', () => {
      const { value } = validate(createProviderSchema, validCreateProvider());
      expect(value.emailNotification.enabled).toBe(false);
    });

    it('invoiceForm, invoiceSerial mặc định là null', () => {
      const { value } = validate(createProviderSchema, validCreateProvider());
      expect(value.invoiceForm).toBeNull();
      expect(value.invoiceSerial).toBeNull();
    });

    it('sellerTaxCode mặc định là null', () => {
      const { value } = validate(createProviderSchema, validCreateProvider());
      expect(value.sellerTaxCode).toBeNull();
    });
  });

  describe('sellerTaxCode', () => {
    it('chấp nhận tối đa 14 ký tự', () => {
      const { error } = validate(createProviderSchema, { ...validCreateProvider(), sellerTaxCode: '01234567890123' });
      expect(error).toBeUndefined();
    });

    it('từ chối hơn 14 ký tự', () => {
      const { error } = validate(createProviderSchema, { ...validCreateProvider(), sellerTaxCode: '012345678901234' });
      expect(error).toBeDefined();
      expect(error.details[0].type).toBe('string.max');
    });
  });

  describe('bkavConfig — khi providerType = bkav', () => {
    it('lỗi khi thiếu partnerGUID', () => {
      const data = validCreateProvider(INVOICE_PROVIDER_TYPES.BKAV);
      delete data.bkav.partnerGUID;
      const { error } = validate(createProviderSchema, data);
      expect(error).toBeDefined();
    });

    it('lỗi khi thiếu partnerToken', () => {
      const data = validCreateProvider(INVOICE_PROVIDER_TYPES.BKAV);
      delete data.bkav.partnerToken;
      const { error } = validate(createProviderSchema, data);
      expect(error).toBeDefined();
    });

    it('lỗi khi thiếu endpoint', () => {
      const data = validCreateProvider(INVOICE_PROVIDER_TYPES.BKAV);
      delete data.bkav.endpoint;
      const { error } = validate(createProviderSchema, data);
      expect(error).toBeDefined();
    });

    it('lỗi khi endpoint không phải URL hợp lệ', () => {
      const data = validCreateProvider(INVOICE_PROVIDER_TYPES.BKAV);
      data.bkav.endpoint = 'not-a-url';
      const { error } = validate(createProviderSchema, data);
      expect(error).toBeDefined();
      expect(error.details[0].type).toBe('string.uri');
    });
  });

  describe('bkavConfig — CmdType validates chống BKAV_CMD_TYPES', () => {
    const allCmdTypes = Object.values(BKAV_CMD_TYPES);

    it('mặc định là CREATE_112', () => {
      const { value } = validate(createProviderSchema, validCreateProvider(INVOICE_PROVIDER_TYPES.BKAV));
      expect(value.bkav.cmdType).toBe(BKAV_CMD_TYPES.CREATE_112);
    });

    it.each(allCmdTypes)('chấp nhận cmdType = %p', (cmd) => {
      const data = validCreateProvider(INVOICE_PROVIDER_TYPES.BKAV);
      data.bkav.cmdType = cmd;
      const { error } = validate(createProviderSchema, data);
      expect(error).toBeUndefined();
    });

    it('từ chối cmdType không nằm trong BKAV_CMD_TYPES', () => {
      const data = validCreateProvider(INVOICE_PROVIDER_TYPES.BKAV);
      data.bkav.cmdType = 999;
      const { error } = validate(createProviderSchema, data);
      expect(error).toBeDefined();
      expect(error.details[0].type).toBe('any.only');
    });
  });

  describe('bkavConfig — invoiceTypeId 1-11', () => {
    it('mặc định là 1', () => {
      const { value } = validate(createProviderSchema, validCreateProvider(INVOICE_PROVIDER_TYPES.BKAV));
      expect(value.bkav.invoiceTypeId).toBe(1);
    });

    it('chấp nhận giá trị 1', () => {
      const data = validCreateProvider(INVOICE_PROVIDER_TYPES.BKAV);
      data.bkav.invoiceTypeId = 1;
      const { error } = validate(createProviderSchema, data);
      expect(error).toBeUndefined();
    });

    it('chấp nhận giá trị 11', () => {
      const data = validCreateProvider(INVOICE_PROVIDER_TYPES.BKAV);
      data.bkav.invoiceTypeId = 11;
      const { error } = validate(createProviderSchema, data);
      expect(error).toBeUndefined();
    });

    it('từ chối giá trị 0', () => {
      const data = validCreateProvider(INVOICE_PROVIDER_TYPES.BKAV);
      data.bkav.invoiceTypeId = 0;
      const { error } = validate(createProviderSchema, data);
      expect(error).toBeDefined();
      expect(error.details[0].type).toBe('number.min');
    });

    it('từ chối giá trị 12', () => {
      const data = validCreateProvider(INVOICE_PROVIDER_TYPES.BKAV);
      data.bkav.invoiceTypeId = 12;
      const { error } = validate(createProviderSchema, data);
      expect(error).toBeDefined();
      expect(error.details[0].type).toBe('number.max');
    });
  });

  describe('bkavConfig — receiveTypeId 1-4', () => {
    it('mặc định là 3', () => {
      const { value } = validate(createProviderSchema, validCreateProvider(INVOICE_PROVIDER_TYPES.BKAV));
      expect(value.bkav.receiveTypeId).toBe(3);
    });

    it('từ chối giá trị 0', () => {
      const data = validCreateProvider(INVOICE_PROVIDER_TYPES.BKAV);
      data.bkav.receiveTypeId = 0;
      const { error } = validate(createProviderSchema, data);
      expect(error).toBeDefined();
    });

    it('từ chối giá trị 5', () => {
      const data = validCreateProvider(INVOICE_PROVIDER_TYPES.BKAV);
      data.bkav.receiveTypeId = 5;
      const { error } = validate(createProviderSchema, data);
      expect(error).toBeDefined();
    });
  });

  describe('bkavConfig — autoSign mặc định false', () => {
    it('mặc định là false', () => {
      const { value } = validate(createProviderSchema, validCreateProvider(INVOICE_PROVIDER_TYPES.BKAV));
      expect(value.bkav.autoSign).toBe(false);
    });
  });

  describe('sepayConfig — khi providerType = sepay', () => {
    it('lỗi khi thiếu bearerToken', () => {
      const data = validCreateProvider(INVOICE_PROVIDER_TYPES.SEPAY);
      delete data.sepay.bearerToken;
      const { error } = validate(createProviderSchema, data);
      expect(error).toBeDefined();
    });

    it('lỗi khi thiếu endpoint', () => {
      const data = validCreateProvider(INVOICE_PROVIDER_TYPES.SEPAY);
      delete data.sepay.endpoint;
      const { error } = validate(createProviderSchema, data);
      expect(error).toBeDefined();
    });

    it('providerAccountId mặc định chuỗi rỗng', () => {
      const { value } = validate(createProviderSchema, validCreateProvider(INVOICE_PROVIDER_TYPES.SEPAY));
      expect(value.sepay.providerAccountId).toBe('');
    });

    it('templateCode mặc định chuỗi rỗng', () => {
      const { value } = validate(createProviderSchema, validCreateProvider(INVOICE_PROVIDER_TYPES.SEPAY));
      expect(value.sepay.templateCode).toBe('');
    });
  });

  describe('conditional validation — bkav/sepay theo providerType', () => {
    it('bkav là null khi providerType = sepay', () => {
      const { value } = validate(createProviderSchema, validCreateProvider(INVOICE_PROVIDER_TYPES.SEPAY));
      expect(value.bkav).toBeNull();
    });

    it('sepay là null khi providerType = bkav', () => {
      const { value } = validate(createProviderSchema, validCreateProvider(INVOICE_PROVIDER_TYPES.BKAV));
      expect(value.sepay).toBeNull();
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// updateProviderSchema
// ═════════════════════════════════════════════════════════════════════════════

describe('updateProviderSchema', () => {
  it('thành công khi cập nhật ít nhất 1 trường', () => {
    const { error } = validate(updateProviderSchema, { name: 'Provider mới' });
    expect(error).toBeUndefined();
  });

  it('lỗi khi body rỗng (min 1 key)', () => {
    const { error } = validate(updateProviderSchema, {});
    expect(error).toBeDefined();
    expect(error.details[0].type).toBe('object.min');
  });

  it('không yêu cầu providerType (không đổi được)', () => {
    const { error } = validate(updateProviderSchema, { isActive: false });
    expect(error).toBeUndefined();
  });

  describe('bkav — partial update', () => {
    it('chấp nhận cập nhật 1 trường bkav', () => {
      const { error } = validate(updateProviderSchema, {
        bkav: { endpoint: 'https://new-endpoint.vn/ws' },
      });
      expect(error).toBeUndefined();
    });

    it('chấp nhận bkav = null', () => {
      const { error } = validate(updateProviderSchema, { bkav: null });
      expect(error).toBeUndefined();
    });

    it('từ chối endpoint không phải URL', () => {
      const { error } = validate(updateProviderSchema, {
        bkav: { endpoint: 'not-url' },
      });
      expect(error).toBeDefined();
    });

    it('cmdType chỉ chấp nhận giá trị trong BKAV_CMD_TYPES', () => {
      const { error: good } = validate(updateProviderSchema, {
        bkav: { cmdType: BKAV_CMD_TYPES.CREATE_100 },
      });
      expect(good).toBeUndefined();

      const { error: bad } = validate(updateProviderSchema, {
        bkav: { cmdType: 777 },
      });
      expect(bad).toBeDefined();
    });

    it('invoiceTypeId 1-11 khi cập nhật', () => {
      const { error: ok } = validate(updateProviderSchema, { bkav: { invoiceTypeId: 5 } });
      expect(ok).toBeUndefined();

      const { error: low } = validate(updateProviderSchema, { bkav: { invoiceTypeId: 0 } });
      expect(low).toBeDefined();

      const { error: high } = validate(updateProviderSchema, { bkav: { invoiceTypeId: 12 } });
      expect(high).toBeDefined();
    });
  });

  describe('sepay — partial update', () => {
    it('chấp nhận cập nhật bearerToken', () => {
      const { error } = validate(updateProviderSchema, {
        sepay: { bearerToken: 'new-token' },
      });
      expect(error).toBeUndefined();
    });

    it('chấp nhận sepay = null', () => {
      const { error } = validate(updateProviderSchema, { sepay: null });
      expect(error).toBeUndefined();
    });
  });

  describe('sellerTaxCode', () => {
    it('chấp nhận tối đa 14 ký tự', () => {
      const { error } = validate(updateProviderSchema, { sellerTaxCode: '01234567890123' });
      expect(error).toBeUndefined();
    });

    it('từ chối hơn 14 ký tự', () => {
      const { error } = validate(updateProviderSchema, { sellerTaxCode: '012345678901234' });
      expect(error).toBeDefined();
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// createInvoiceProductSchema
// ═════════════════════════════════════════════════════════════════════════════

describe('createInvoiceProductSchema', () => {
  const validProduct = {
    code: 'SKU001',
    name: 'Dịch vụ tư vấn',
  };

  describe('trường bắt buộc', () => {
    it('thành công với dữ liệu tối thiểu', () => {
      const { error } = validate(createInvoiceProductSchema, validProduct);
      expect(error).toBeUndefined();
    });

    it('lỗi khi thiếu code', () => {
      const { error } = validate(createInvoiceProductSchema, { name: 'X' });
      expect(error).toBeDefined();
    });

    it('lỗi khi code là chuỗi rỗng', () => {
      const { error } = validate(createInvoiceProductSchema, { code: '', name: 'X' });
      expect(error).toBeDefined();
      expect(error.details[0].type).toBe('string.empty');
    });

    it('lỗi khi thiếu name', () => {
      const { error } = validate(createInvoiceProductSchema, { code: 'SKU001' });
      expect(error).toBeDefined();
    });

    it('lỗi khi name là chuỗi rỗng', () => {
      const { error } = validate(createInvoiceProductSchema, { code: 'SKU001', name: '' });
      expect(error).toBeDefined();
      expect(error.details[0].type).toBe('string.empty');
    });
  });

  describe('code — tự động uppercase', () => {
    it('chuyển thành chữ in hoa', () => {
      const { value } = validate(createInvoiceProductSchema, { ...validProduct, code: 'sku001' });
      expect(value.code).toBe('SKU001');
    });
  });

  describe('giá trị mặc định', () => {
    it('unitName mặc định là "Lần"', () => {
      const { value } = validate(createInvoiceProductSchema, validProduct);
      expect(value.unitName).toBe('Lần');
    });

    it('unitPrice mặc định là 0', () => {
      const { value } = validate(createInvoiceProductSchema, validProduct);
      expect(value.unitPrice).toBe(0);
    });

    it('taxRateId mặc định là 3', () => {
      const { value } = validate(createInvoiceProductSchema, validProduct);
      expect(value.taxRateId).toBe(3);
    });

    it('taxRate mặc định là 10', () => {
      const { value } = validate(createInvoiceProductSchema, validProduct);
      expect(value.taxRate).toBe(10);
    });

    it('itemTypeId mặc định là 0', () => {
      const { value } = validate(createInvoiceProductSchema, validProduct);
      expect(value.itemTypeId).toBe(0);
    });

    it('description mặc định là chuỗi rỗng', () => {
      const { value } = validate(createInvoiceProductSchema, validProduct);
      expect(value.description).toBe('');
    });

    it('isActive mặc định là true', () => {
      const { value } = validate(createInvoiceProductSchema, validProduct);
      expect(value.isActive).toBe(true);
    });
  });

  describe('taxRate — min -2 (product)', () => {
    it('chấp nhận taxRate = -2', () => {
      const { error } = validate(createInvoiceProductSchema, { ...validProduct, taxRate: -2 });
      expect(error).toBeUndefined();
    });

    it('chấp nhận taxRate = -1 (KCT)', () => {
      const { error } = validate(createInvoiceProductSchema, { ...validProduct, taxRate: -1 });
      expect(error).toBeUndefined();
    });

    it('từ chối taxRate = -3 (nhỏ hơn min -2 của product)', () => {
      const { error } = validate(createInvoiceProductSchema, { ...validProduct, taxRate: -3 });
      expect(error).toBeDefined();
      expect(error.details[0].type).toBe('number.min');
    });

    it('chấp nhận taxRate = 100', () => {
      const { error } = validate(createInvoiceProductSchema, { ...validProduct, taxRate: 100 });
      expect(error).toBeUndefined();
    });

    it('từ chối taxRate > 100', () => {
      const { error } = validate(createInvoiceProductSchema, { ...validProduct, taxRate: 101 });
      expect(error).toBeDefined();
      expect(error.details[0].type).toBe('number.max');
    });
  });

  describe('unitPrice — không cho phép số âm (product)', () => {
    it('chấp nhận unitPrice = 0', () => {
      const { error } = validate(createInvoiceProductSchema, { ...validProduct, unitPrice: 0 });
      expect(error).toBeUndefined();
    });

    it('từ chối unitPrice âm', () => {
      const { error } = validate(createInvoiceProductSchema, { ...validProduct, unitPrice: -1 });
      expect(error).toBeDefined();
      expect(error.details[0].type).toBe('number.min');
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// updateInvoiceProductSchema
// ═════════════════════════════════════════════════════════════════════════════

describe('updateInvoiceProductSchema', () => {
  it('thành công khi cập nhật ít nhất 1 trường', () => {
    const { error } = validate(updateInvoiceProductSchema, { name: 'Tên mới' });
    expect(error).toBeUndefined();
  });

  it('lỗi khi body rỗng (min 1 key)', () => {
    const { error } = validate(updateInvoiceProductSchema, {});
    expect(error).toBeDefined();
    expect(error.details[0].type).toBe('object.min');
  });

  describe('code — uppercase khi cập nhật', () => {
    it('chuyển thành chữ in hoa', () => {
      const { value } = validate(updateInvoiceProductSchema, { code: 'abc' });
      expect(value.code).toBe('ABC');
    });
  });

  describe('taxRate — min -2 (product)', () => {
    it('chấp nhận taxRate = -2', () => {
      const { error } = validate(updateInvoiceProductSchema, { taxRate: -2 });
      expect(error).toBeUndefined();
    });

    it('từ chối taxRate = -3', () => {
      const { error } = validate(updateInvoiceProductSchema, { taxRate: -3 });
      expect(error).toBeDefined();
      expect(error.details[0].type).toBe('number.min');
    });
  });

  describe('unitPrice — không cho phép số âm', () => {
    it('từ chối unitPrice âm', () => {
      const { error } = validate(updateInvoiceProductSchema, { unitPrice: -100 });
      expect(error).toBeDefined();
      expect(error.details[0].type).toBe('number.min');
    });
  });

  it('không có giá trị mặc định (partial update)', () => {
    const { value } = validate(updateInvoiceProductSchema, { name: 'X' });
    expect(value.unitName).toBeUndefined();
    expect(value.unitPrice).toBeUndefined();
    expect(value.taxRate).toBeUndefined();
  });
});
