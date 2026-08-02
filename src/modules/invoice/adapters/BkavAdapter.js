const crypto = require('crypto');
const zlib = require('zlib');
const axios = require('axios');
const BaseInvoiceAdapter = require('./BaseInvoiceAdapter');
const logger = require('../../../core/utils/logger');
const {
  BKAV_CMD_TYPES,
  BKAV_PAY_METHOD_IDS,
  BKAV_TAX_RATE_IDS,
  BKAV_RECEIVE_TYPES,
  BKAV_INVOICE_TYPES,
} = require('../../../core/constants/invoice');

/**
 * ─── BkavAdapter ─────────────────────────────────────────────────────────────
 * Adapter tích hợp BKAV eHoaDon WebService (SOAP).
 *
 * Luồng gửi: JSON → GZip compress → AES-256-CBC encrypt → Base64 → SOAP XML
 * Luồng nhận: SOAP XML → Base64 decode → AES-256-CBC decrypt → GZip decompress → JSON
 *
 * Reference: FAQ_WebServices_Bkav.docx.pdf
 */
class BkavAdapter extends BaseInvoiceAdapter {
  constructor(providerConfig) {
    super(providerConfig);
    const { bkav } = providerConfig;
    if (!bkav || !bkav.partnerGUID || !bkav.partnerToken || !bkav.endpoint) {
      throw new Error('Cấu hình BKAV không đầy đủ (partnerGUID, partnerToken, endpoint)');
    }
    this.partnerGUID = bkav.partnerGUID;
    this.endpoint = bkav.endpoint;
    this.cmdType = bkav.cmdType || BKAV_CMD_TYPES.CREATE_111;
    this.invoiceTypeId = bkav.invoiceTypeId || BKAV_INVOICE_TYPES.GTGT;
    this.receiveTypeId = bkav.receiveTypeId || BKAV_RECEIVE_TYPES.EMAIL_SMS;

    // Parse PartnerToken → Key + IV (Base64 format, separated by ':')
    const tokenParts = bkav.partnerToken.split(':');
    if (tokenParts.length !== 2) {
      throw new Error('PartnerToken không đúng định dạng Key:IV (Base64)');
    }
    this.aesKey = Buffer.from(tokenParts[0], 'base64');
    this.aesIV = Buffer.from(tokenParts[1], 'base64');

    // Validate key/IV size
    if (this.aesKey.length !== 32) {
      throw new Error(`AES Key phải 32 bytes (256-bit), nhận được ${this.aesKey.length} bytes`);
    }
    if (this.aesIV.length !== 16) {
      throw new Error(`AES IV phải 16 bytes, nhận được ${this.aesIV.length} bytes`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Public Methods (Adapter Interface)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Phát hành hoá đơn lên BKAV.
   */
  async issue(invoice) {
    try {
      const commandObject = this._buildCommandObject(invoice);
      const commandData = {
        CmdType: this.cmdType,
        CommandObject: JSON.stringify([commandObject]),
      };

      logger.info(`[BkavAdapter] Issuing invoice ${invoice.id} with CmdType ${this.cmdType}`);

      const result = await this._execCommand(commandData);

      if (!result.success) {
        return {
          success: false,
          error: result.error,
          errorCode: result.errorCode,
          rawResponse: result.rawResponse,
        };
      }

      // Parse BKAV response
      const data = result.data;
      // Trường hợp data là array
      const invoiceResult = Array.isArray(data) ? data[0] : data;

      return {
        success: true,
        invoiceGUID: invoiceResult?.InvoiceGUID || invoiceResult?.invoiceGUID || null,
        invoiceNo: invoiceResult?.InvoiceNo || invoiceResult?.invoiceNo || 0,
        lookupCode: invoiceResult?.MTC || invoiceResult?.mtc || null,
        rawResponse: result.rawResponse,
      };
    } catch (err) {
      logger.error(`[BkavAdapter] Issue error for ${invoice.id}:`, err.message);
      return {
        success: false,
        error: err.message,
        rawResponse: null,
      };
    }
  }

  /**
   * Huỷ bỏ hoá đơn trên BKAV (CmdType 200).
   */
  async cancel(invoice, reason = '') {
    try {
      const commandData = {
        CmdType: BKAV_CMD_TYPES.CANCEL_200,
        CommandObject: JSON.stringify([{
          InvoiceGUID: invoice.providerInvoiceGUID,
          // PartnerInvoiceID (nếu dùng): invoice.id
        }]),
      };

      logger.info(`[BkavAdapter] Cancelling invoice ${invoice.id} (GUID: ${invoice.providerInvoiceGUID})`);

      const result = await this._execCommand(commandData);
      return {
        success: result.success,
        rawResponse: result.rawResponse,
        error: result.error || null,
      };
    } catch (err) {
      logger.error(`[BkavAdapter] Cancel error for ${invoice.id}:`, err.message);
      return { success: false, error: err.message, rawResponse: null };
    }
  }

  /**
   * Lấy thông tin hoá đơn từ BKAV (CmdType 800).
   */
  async getInfo(invoice) {
    try {
      const commandData = {
        CmdType: BKAV_CMD_TYPES.GET_INFO_800,
        CommandObject: JSON.stringify([{
          InvoiceGUID: invoice.providerInvoiceGUID,
        }]),
      };

      const result = await this._execCommand(commandData);
      if (!result.success) {
        return { success: false, data: null, rawResponse: result.rawResponse, error: result.error };
      }

      const data = Array.isArray(result.data) ? result.data[0] : result.data;
      return { success: true, data, rawResponse: result.rawResponse, error: null };
    } catch (err) {
      logger.error(`[BkavAdapter] GetInfo error for ${invoice.id}:`, err.message);
      return { success: false, data: null, rawResponse: null, error: err.message };
    }
  }

  /**
   * Download PDF/XML — BKAV trả về link hoặc base64 content.
   * Cần dùng BKAV Portal hoặc custom CmdType.
   */
  async download(invoice, format = 'pdf') {
    // BKAV không có API download riêng qua ExecCommand.
    // PDF/XML thường lấy qua portal link hoặc lookup code.
    // Trả về lookup link nếu có.
    const lookupCode = invoice.lookupCode;
    if (lookupCode) {
      return {
        success: true,
        url: `https://tracuu.ehoadon.vn/TraCuuHoaDon?mtc=${lookupCode}`,
        format,
      };
    }
    return { success: false, error: 'Không có mã tra cứu (MTC)' };
  }

  /**
   * Test kết nối tới BKAV — thử gọi CmdType 800 với GUID rỗng.
   */
  async testConnection() {
    try {
      const commandData = {
        CmdType: BKAV_CMD_TYPES.GET_INFO_800,
        CommandObject: JSON.stringify([{ InvoiceGUID: '00000000-0000-0000-0000-000000000000' }]),
      };

      const result = await this._execCommand(commandData);

      // Nếu nhận được response (kể cả lỗi "không tìm thấy HĐ") → kết nối OK
      return {
        success: true,
        message: 'Kết nối BKAV WebService thành công',
        endpoint: this.endpoint,
        responseStatus: result.success ? 'OK' : result.error,
      };
    } catch (err) {
      return {
        success: false,
        message: `Kết nối thất bại: ${err.message}`,
        endpoint: this.endpoint,
        error: err.message,
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Private: SOAP Communication
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Gọi BKAV ExecCommand WebService.
   * Luồng: JSON → compress → encrypt → base64 → SOAP → gửi → nhận → base64 → decrypt → decompress → JSON
   */
  async _execCommand(commandData) {
    // 1. Serialize CommandData → JSON string
    const jsonStr = JSON.stringify(commandData);
    logger.debug(`[BkavAdapter] CommandData: ${jsonStr.substring(0, 200)}...`);

    // 2. Compress → GZip
    const compressed = zlib.gzipSync(Buffer.from(jsonStr, 'utf-8'));

    // 3. Encrypt → AES-256-CBC
    const encrypted = this._encrypt(compressed);

    // 4. Base64 encode
    const base64Data = encrypted.toString('base64');

    // 5. Build SOAP envelope
    const soapBody = this._buildSoapEnvelope(base64Data);

    // 6. Send HTTP POST
    const response = await axios.post(this.endpoint, soapBody, {
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: 'http://tempuri.org/ExecCommand',
      },
      timeout: 30000,
      maxBodyLength: 10 * 1024 * 1024, // 10MB
    });

    // 7. Parse SOAP response
    const rawXml = response.data;
    const resultBase64 = this._extractSoapResult(rawXml);

    if (!resultBase64) {
      logger.error('[BkavAdapter] Empty SOAP response');
      return { success: false, error: 'BKAV trả về response rỗng', rawResponse: rawXml };
    }

    // 8. Base64 decode → Decrypt → Decompress
    const resultBuffer = Buffer.from(resultBase64, 'base64');
    const decrypted = this._decrypt(resultBuffer);
    const decompressed = zlib.gunzipSync(decrypted);
    const resultJson = JSON.parse(decompressed.toString('utf-8'));

    logger.info(`[BkavAdapter] Response: ${JSON.stringify(resultJson).substring(0, 300)}`);

    // 9. Check BKAV status
    // BKAV trả về: { Status: 0 = success, Object: [...] } hoặc { Status: non-0, Object: "error message" }
    if (resultJson.Status !== undefined && resultJson.Status !== 0) {
      return {
        success: false,
        error: resultJson.Object || `BKAV error code: ${resultJson.Status}`,
        errorCode: resultJson.Status,
        rawResponse: resultJson,
      };
    }

    // Parse Object field
    let data = resultJson.Object;
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch { /* keep as string */ }
    }

    return {
      success: true,
      data,
      rawResponse: resultJson,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Private: Crypto
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * AES-256-CBC encrypt.
   * @param {Buffer} data
   * @returns {Buffer} encrypted data
   */
  _encrypt(data) {
    const cipher = crypto.createCipheriv('aes-256-cbc', this.aesKey, this.aesIV);
    return Buffer.concat([cipher.update(data), cipher.final()]);
  }

  /**
   * AES-256-CBC decrypt.
   * @param {Buffer} data
   * @returns {Buffer} decrypted data
   */
  _decrypt(data) {
    const decipher = crypto.createDecipheriv('aes-256-cbc', this.aesKey, this.aesIV);
    return Buffer.concat([decipher.update(data), decipher.final()]);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Private: SOAP XML
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Build SOAP XML envelope cho ExecCommand.
   */
  _buildSoapEnvelope(base64CommandData) {
    return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
               xmlns:xsd="http://www.w3.org/2001/XMLSchema"
               xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ExecCommand xmlns="http://tempuri.org/">
      <partnerGUID>${this._escapeXml(this.partnerGUID)}</partnerGUID>
      <commandData>${base64CommandData}</commandData>
    </ExecCommand>
  </soap:Body>
</soap:Envelope>`;
  }

  /**
   * Extract ExecCommandResult from SOAP response XML.
   */
  _extractSoapResult(xml) {
    // Tìm nội dung trong <ExecCommandResult>...</ExecCommandResult>
    const match = xml.match(/<ExecCommandResult>([\s\S]*?)<\/ExecCommandResult>/);
    return match ? match[1].trim() : null;
  }

  /**
   * Escape XML special chars.
   */
  _escapeXml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Private: Data Mapping
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Build CommandObject cho tạo hoá đơn (CmdType 100-112).
   * Mapping từ CRM Invoice model → BKAV InvoiceWS format.
   */
  _buildCommandObject(invoice) {
    const cmd = {
      // ─── Thông tin cơ bản ─────────────────────────────────────────────
      Invoice: {
        InvoiceTypeID: this.invoiceTypeId,
        InvoiceDate: this._formatDate(invoice.invoiceDate),
        BuyerName: invoice.buyer?.name || '',
        BuyerTaxCode: invoice.buyer?.taxCode || '',
        BuyerUnitName: invoice.buyer?.unitName || '',
        BuyerAddress: invoice.buyer?.address || '',
        BuyerBankAccount: invoice.buyer?.bankAccount || '',
        BuyerEmail: invoice.buyer?.email || '',
        BuyerPhone: invoice.buyer?.phone || '',
        ReceiveTypeID: this.receiveTypeId,
        ReceiverEmail: invoice.buyer?.email || '',
        ReceiverMobile: invoice.buyer?.phone || '',
        ReceiverAddress: invoice.buyer?.address || '',
        ReceiverName: invoice.buyer?.name || '',
        Note: invoice.note || '',
        BillCode: invoice.billCode || '',
        CurrencyID: invoice.currency || 'VND',
        ExchangeRate: invoice.exchangeRate || 1,
        PayMethodID: this._mapPayMethodId(invoice.paymentMethod),
        UserDefine: invoice.userDefine || '',

        // ─── PMKT quản lý mẫu số / ký hiệu (CmdType 110, 111, 112) ──
        InvoiceForm: invoice.invoiceForm || this.config.invoiceForm || '',
        InvoiceSerial: invoice.invoiceSerial || this.config.invoiceSerial || '',
        InvoiceNo: invoice.invoiceNo || 0,
      },

      // ─── Chi tiết hàng hoá / dịch vụ ─────────────────────────────────
      ListInvoiceDetailsWS: this._buildDetailsList(invoice.items),

      // ─── PartnerInvoiceID — ID nội bộ CRM để BKAV tham chiếu ─────────
      PartnerInvoiceID: invoice.id,
      PartnerInvoiceStringID: invoice.id,
    };

    // Nếu HĐ thay thế / điều chỉnh → thêm field liên kết
    if (invoice.relatedInvoiceId && invoice.relationType) {
      cmd.OriginalInvoiceGUID = invoice.providerInvoiceGUID || '';
    }

    return cmd;
  }

  /**
   * Map invoice items → BKAV ListInvoiceDetailsWS.
   */
  _buildDetailsList(items) {
    if (!items || items.length === 0) return [];

    return items.map((item, idx) => ({
      ItemName: item.itemName || '',
      UnitName: item.unitName || '',
      Qty: item.quantity || 0,
      Price: item.unitPrice || 0,
      Amount: item.amount || 0,
      TaxRateID: item.taxRateId || BKAV_TAX_RATE_IDS.TAX_10,
      TaxRate: item.taxRate !== undefined ? item.taxRate : 10,
      TaxAmount: item.taxAmount || 0,
      DiscountRate: item.discountRate || 0,
      DiscountAmount: item.discountAmount || 0,
      IsDiscount: item.isDiscount || false,
      ItemTypeID: item.itemTypeId || 0,
      UserDefineDetails: item.userDefineDetails || '',
      IsIncrease: item.isIncrease,
      OrderNumber: idx + 1,
    }));
  }

  /**
   * Map CRM payment method → BKAV PayMethodID.
   */
  _mapPayMethodId(method) {
    const map = {
      TM: BKAV_PAY_METHOD_IDS.CASH,
      CK: BKAV_PAY_METHOD_IDS.TRANSFER,
      'TM/CK': BKAV_PAY_METHOD_IDS.CASH_TRANSFER,
    };
    return map[method] || BKAV_PAY_METHOD_IDS.CASH_TRANSFER;
  }

  /**
   * Format date cho BKAV (dd/MM/yyyy).
   */
  _formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }
}

module.exports = BkavAdapter;
