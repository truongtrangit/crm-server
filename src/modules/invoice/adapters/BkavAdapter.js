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
  INVOICE_STATUSES,
  INVOICE_RELATION_TYPES,
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
      throw new Error(
        'Cấu hình BKAV không đầy đủ (partnerGUID, partnerToken, endpoint)',
      );
    }
    this.partnerGUID = bkav.partnerGUID;
    this.endpoint = bkav.endpoint;
    this.cmdType = bkav.cmdType || BKAV_CMD_TYPES.CREATE_112;
    this.invoiceTypeId = bkav.invoiceTypeId || BKAV_INVOICE_TYPES.GTGT;
    this.receiveTypeId = bkav.receiveTypeId || BKAV_RECEIVE_TYPES.EMAIL_SMS;

    // Parse PartnerToken → Key + IV (Base64 format, separated by ':')
    if (
      bkav.partnerToken === '***' ||
      bkav.partnerGUID === '***' ||
      /^[a-f0-9]{4}\.\.\.[a-f0-9]{4}$/i.test(bkav.partnerGUID)
    ) {
      throw new Error(
        'PartnerGUID hoặc PartnerToken bị lỗi (dữ liệu đã bị che). Vui lòng mở Cấu hình NCC và nhập lại giá trị thật.',
      );
    }
    const tokenParts = bkav.partnerToken.split(':');
    if (tokenParts.length !== 2) {
      throw new Error(
        'PartnerToken không đúng định dạng Key:IV (Base64). Vui lòng kiểm tra lại cấu hình NCC.',
      );
    }
    this.aesKey = Buffer.from(tokenParts[0], 'base64');
    this.aesIV = Buffer.from(tokenParts[1], 'base64');

    // Validate key/IV size
    if (this.aesKey.length !== 32) {
      throw new Error(
        `AES Key phải 32 bytes (256-bit), nhận được ${this.aesKey.length} bytes`,
      );
    }
    if (this.aesIV.length !== 16) {
      throw new Error(
        `AES IV phải 16 bytes, nhận được ${this.aesIV.length} bytes`,
      );
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
      const effectiveCmdType = this._determineCmdType(invoice);
      const commandObject = this._buildCommandObject(invoice);
      const commandData = {
        CmdType: effectiveCmdType,
        CommandObject: JSON.stringify([commandObject]),
      };

      logger.info(
        `[BkavAdapter] Issuing invoice ${invoice.id} with CmdType ${effectiveCmdType} (relationType: ${invoice.relationType || 'none'})`,
      );

      logger.debug(
        `[BkavAdapter] CommandData: ${JSON.stringify(commandData, null, 2)}`,
      );

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

      // Check inner Status from BKAV item result (Status 0 = success, 1 = error)
      if (
        invoiceResult &&
        invoiceResult.Status !== undefined &&
        invoiceResult.Status !== 0
      ) {
        return {
          success: false,
          error:
            invoiceResult.MessLog ||
            invoiceResult.messLog ||
            'Lỗi từ BKAV (không có thông báo chi tiết)',
          errorCode: invoiceResult.Status,
          rawResponse: result.rawResponse,
        };
      }

      // Check for 00000000-0000-0000-0000-000000000000 GUID which means failure even if Status is missing/0
      const guid =
        invoiceResult?.InvoiceGUID || invoiceResult?.invoiceGUID || null;
      if (guid === '00000000-0000-0000-0000-000000000000') {
        return {
          success: false,
          error:
            invoiceResult?.MessLog ||
            invoiceResult?.messLog ||
            'BKAV trả về InvoiceGUID rỗng',
          rawResponse: result.rawResponse,
        };
      }

      return {
        success: true,
        invoiceGUID: guid,
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
   * Cập nhật hoá đơn nháp trên BKAV (CmdType 204).
   * Dùng khi hoá đơn đã được đẩy lên BKAV (có InvoiceGUID) nhưng vẫn ở trạng thái nháp (mới tạo)
   * và người dùng muốn cập nhật nội dung.
   */
  async updateDraft(invoice) {
    try {
      if (!invoice.providerInvoiceGUID) {
        return {
          success: false,
          error: 'Hoá đơn chưa có InvoiceGUID để cập nhật trên BKAV',
          rawResponse: null,
        };
      }

      const commandObject = this._buildCommandObject(invoice);
      // Bắt buộc phải có InvoiceGUID để cập nhật
      if (commandObject.Invoice) {
        commandObject.Invoice.InvoiceGUID = invoice.providerInvoiceGUID;
      }

      const commandData = {
        CmdType: BKAV_CMD_TYPES.UPDATE_204,
        CommandObject: JSON.stringify([commandObject]),
      };

      logger.info(
        `[BkavAdapter] Updating draft invoice ${invoice.id} with CmdType ${BKAV_CMD_TYPES.UPDATE_204} (GUID: ${invoice.providerInvoiceGUID})`,
      );

      const result = await this._execCommand(commandData);

      if (!result.success) {
        return {
          success: false,
          error: result.error,
          errorCode: result.errorCode,
          rawResponse: result.rawResponse,
        };
      }

      const data = result.data;
      const invoiceResult = Array.isArray(data) ? data[0] : data;

      if (
        invoiceResult &&
        invoiceResult.Status !== undefined &&
        invoiceResult.Status !== 0
      ) {
        return {
          success: false,
          error:
            invoiceResult.MessLog ||
            invoiceResult.messLog ||
            'Lỗi từ BKAV khi cập nhật nháp',
          errorCode: invoiceResult.Status,
          rawResponse: result.rawResponse,
        };
      }

      return {
        success: true,
        rawResponse: result.rawResponse,
      };
    } catch (err) {
      logger.error(
        `[BkavAdapter] Update draft error for ${invoice.id}:`,
        err.message,
      );
      return {
        success: false,
        error: err.message,
        rawResponse: null,
      };
    }
  }

  /**
   * Huỷ bỏ hoá đơn đã phát hành trên BKAV (CmdType 202 — bằng PartnerInvoiceID/GUID).
   * Ref: eHoaDon_WebService_Interface.docx — Mã lệnh 202
   */
  async cancel(invoice, reason = 'Hủy do sai sót') {
    try {
      const commandData = {
        CmdType: BKAV_CMD_TYPES.CANCEL_202,
        CommandObject: JSON.stringify([
          {
            Invoice: {
              InvoiceTypeID: this.invoiceTypeId || 1,
              InvoiceGUID: invoice.providerInvoiceGUID,
              Reason: reason || '',
            },
            // Ref: eHoaDon_WebService_Interface.docx — CommandObject wraps InvoiceDataWS
            PartnerInvoiceID: 0,
            PartnerInvoiceStringID: invoice.id || '',
          },
        ]),
      };

      logger.info(
        `[BkavAdapter] Cancelling invoice ${invoice.id} (GUID: ${invoice.providerInvoiceGUID})`,
      );

      const result = await this._execCommand(commandData);
      const item = Array.isArray(result.data) ? result.data[0] : result.data;
      if (item && item.Status !== undefined && item.Status !== 0) {
        return {
          success: false,
          error: item.MessLog || item.messLog || 'Lỗi huỷ HĐ từ BKAV',
          rawResponse: result.rawResponse,
        };
      }

      return {
        success: result.success,
        rawResponse: result.rawResponse,
        error: result.error || null,
      };
    } catch (err) {
      logger.error(
        `[BkavAdapter] Cancel error for ${invoice.id}:`,
        err.message,
      );
      return { success: false, error: err.message, rawResponse: null };
    }
  }

  /**
   * Xoá bỏ hoá đơn nháp trên BKAV (CmdType 301 — bằng PartnerInvoiceID/GUID).
   * Ref: eHoaDon_WebService_Interface.docx — Mã lệnh 301
   */
  async deleteDraft(invoice) {
    if (!invoice.providerInvoiceGUID) {
      return { success: true };
    }

    try {
      const commandData = {
        CmdType: BKAV_CMD_TYPES.DELETE_DRAFT_301,
        CommandObject: JSON.stringify([
          {
            Invoice: {
              InvoiceTypeID: this.invoiceTypeId || 1,
              InvoiceGUID: invoice.providerInvoiceGUID,
            },
            // Ref: eHoaDon_WebService_Interface.docx — CommandObject wraps InvoiceDataWS
            PartnerInvoiceID: 0,
            PartnerInvoiceStringID: invoice.id || '',
          },
        ]),
      };

      logger.info(
        `[BkavAdapter] Deleting draft invoice ${invoice.id} with CmdType ${BKAV_CMD_TYPES.DELETE_DRAFT_301} (GUID: ${invoice.providerInvoiceGUID})`,
      );

      const result = await this._execCommand(commandData);

      // result.data from BKAV could be an array of status objects for each invoice
      const item = Array.isArray(result.data) ? result.data[0] : result.data;
      if (item && item.Status !== undefined && item.Status !== 0) {
        return {
          success: false,
          error:
            item.MessLog || item.messLog || 'Lỗi xoá hoá đơn nháp trên BKAV',
          rawResponse: result.rawResponse,
        };
      }

      if (!result.success && !item) {
        return {
          success: false,
          error: result.error || 'Lỗi xoá hoá đơn nháp trên BKAV',
          rawResponse: result.rawResponse,
        };
      }

      return {
        success: true,
        rawResponse: result.rawResponse,
      };
    } catch (err) {
      logger.error(
        `[BkavAdapter] Delete draft error for ${invoice.id}:`,
        err.message,
      );
      return { success: false, error: err.message, rawResponse: null };
    }
  }

  /**
   * Tra cứu thông tin Doanh nghiệp theo MST (CmdType 904).
   */
  async lookupTaxCode(code) {
    try {
      const commandData = {
        CmdType: 904,
        CommandObject: code,
      };

      const result = await this._execCommand(commandData);
      if (!result.success) {
        return { success: false, data: null };
      }

      const data = Array.isArray(result.data) ? result.data[0] : result.data;
      return { success: true, data };
    } catch (err) {
      logger.error(
        `[BkavAdapter] lookupTaxCode error for ${code}:`,
        err.message,
      );
      return { success: false, data: null };
    }
  }

  /**
   * Lấy thông tin hoá đơn từ BKAV (CmdType 800).
   * Ref: FAQ mục C.12 — CommandObject là string (GUID hoặc PartnerID), không phải array.
   */
  async getInfo(invoice) {
    try {
      // CmdType 800: CommandObject là string — InvoiceGUID hoặc PartnerInvoiceID
      const lookupId = invoice.providerInvoiceGUID || invoice.id;
      const commandData = {
        CmdType: BKAV_CMD_TYPES.GET_INFO_800,
        CommandObject: lookupId,
      };

      const result = await this._execCommand(commandData);
      if (!result.success) {
        return {
          success: false,
          data: null,
          rawResponse: result.rawResponse,
          error: result.error,
        };
      }

      const data = Array.isArray(result.data) ? result.data[0] : result.data;
      const bkavInvoice = data?.Invoice || data;
      const invoiceStatusId = bkavInvoice?.InvoiceStatusID;
      const crmStatus = this.mapBkavStatusToCrmStatus(invoiceStatusId);

      return {
        success: true,
        data,
        crmStatus,
        rawResponse: result.rawResponse,
        error: null,
      };
    } catch (err) {
      logger.error(
        `[BkavAdapter] GetInfo error for ${invoice.id}:`,
        err.message,
      );
      return {
        success: false,
        data: null,
        rawResponse: null,
        error: err.message,
      };
    }
  }

  /**
   * Map BKAV InvoiceStatusID sang CRM status
   */
  mapBkavStatusToCrmStatus(invoiceStatusId) {
    switch (invoiceStatusId) {
      case 1: // Mới tạo
      case 11: // Trống (Đã cấp số, chờ ký)
      case 5: // Chờ thay thế
      case 7: // Chờ điều chỉnh
      case 14: // Chờ điều chỉnh chiết khấu
        return INVOICE_STATUSES.PENDING_SIGN;
      case 2: // Đã phát hành
      case 6: // Thay thế đã ký
      case 8: // Điều chỉnh đã ký
      case 15: // Điều chỉnh chiết khấu đã ký
        return INVOICE_STATUSES.ISSUED;
      case 3: // Đã hủy
      case 4: // Đã xóa
      case 12: // Không sử dụng
      case 13: // Chờ hủy
        return INVOICE_STATUSES.CANCELLED;
      case 9: // Bị thay thế
        return INVOICE_STATUSES.REPLACED;
      case 10: // Bị điều chỉnh
        return INVOICE_STATUSES.ADJUSTED;
      default:
        return null;
    }
  }

  /**
   * Download PDF/XML — BKAV trả về link hoặc base64 content.
   * Cần dùng BKAV Portal hoặc custom CmdType.
   */
  async download(invoice, format = 'pdf') {
    const isXml = format === 'xml';
    // Ưu tiên theo PartnerInvoiceStringID (808/809), fallback theo Mã tra cứu (811/813) và InvoiceGUID (803/805)
    const attempts = [
      {
        cmd: isXml ? BKAV_CMD_TYPES.GET_XML_809 : BKAV_CMD_TYPES.GET_PDF_808,
        obj: invoice.id,
      },
    ];
    if (invoice.lookupCode) {
      attempts.push({
        cmd: isXml
          ? BKAV_CMD_TYPES.GET_XML_BY_MTC_813
          : BKAV_CMD_TYPES.GET_PDF_BY_MTC_811,
        obj: invoice.lookupCode,
      });
    }
    if (invoice.providerInvoiceGUID) {
      attempts.push({
        cmd: isXml ? BKAV_CMD_TYPES.GET_XML_805 : BKAV_CMD_TYPES.GET_PDF_803,
        obj: invoice.providerInvoiceGUID,
      });
    }

    let lastError = 'Không lấy được file từ BKAV';
    for (const { cmd, obj } of attempts) {
      try {
        const result = await this._execCommand({
          CmdType: cmd,
          CommandObject: obj,
        });
        if (!result.success) {
          lastError = result.error || lastError;
          continue;
        }
        let data = result.data;
        if (typeof data === 'string') {
          try {
            data = JSON.parse(data);
          } catch {
            /* keep string */
          }
        }
        const item = Array.isArray(data) ? data[0] : data;
        const base64 = isXml ? (item?.XML || item?.xml) : (item?.PDF || item?.pdf);
        if (base64) {
          return { success: true, format, base64 };
        }
      } catch (err) {
        lastError = err.message;
      }
    }
    return { success: false, error: lastError };
  }

  /**
   * Ký hoá đơn bằng HSM (CmdType 205).
   * Ref: FAQ mục C.6
   * @param {Object} invoice - Invoice document từ DB (cần providerInvoiceGUID)
   * @returns {Promise<Object>} { success, rawResponse, error }
   */
  async signWithHSM(invoice) {
    try {
      if (!invoice.providerInvoiceGUID) {
        return {
          success: false,
          error: 'Hoá đơn chưa có InvoiceGUID từ BKAV',
          rawResponse: null,
        };
      }

      const commandData = {
        CmdType: BKAV_CMD_TYPES.SIGN_HSM_205,
        CommandObject: invoice.providerInvoiceGUID,
      };

      logger.info(
        `[BkavAdapter] Signing invoice ${invoice.id} with HSM (GUID: ${invoice.providerInvoiceGUID})`,
      );

      const result = await this._execCommand(commandData);
      const item = Array.isArray(result.data) ? result.data[0] : result.data;
      if (item && item.Status !== undefined && item.Status !== 0) {
        return {
          success: false,
          error: item.MessLog || item.messLog || 'Lỗi ký HSM từ BKAV',
          rawResponse: result.rawResponse,
        };
      }

      return {
        success: result.success,
        rawResponse: result.rawResponse,
        error: result.error || null,
        invoiceNo: item?.InvoiceNo || null,
        lookupCode: item?.MTC || null,
      };
    } catch (err) {
      logger.error(
        `[BkavAdapter] HSM sign error for ${invoice.id}:`,
        err.message,
      );
      return { success: false, error: err.message, rawResponse: null };
    }
  }

  /**
   * Ký nhiều hoá đơn bằng HSM (CmdType 206).
   * Ref: FAQ mục C.7
   * @param {Array<string>} invoiceGUIDs - Danh sách InvoiceGUID cần ký
   * @returns {Promise<Object>} { success, rawResponse, error }
   */
  async signBatchWithHSM(invoiceGUIDs) {
    try {
      if (!invoiceGUIDs || invoiceGUIDs.length === 0) {
        return {
          success: false,
          error: 'Danh sách InvoiceGUID trống',
          rawResponse: null,
        };
      }

      const commandData = {
        CmdType: BKAV_CMD_TYPES.SIGN_HSM_206,
        CommandObject: JSON.stringify(
          invoiceGUIDs.map((guid) => ({ InvoiceGUID: guid })),
        ),
      };

      logger.info(
        `[BkavAdapter] Batch signing ${invoiceGUIDs.length} invoices with HSM`,
      );

      const result = await this._execCommand(commandData);
      // For batch, check if all failed or calculate partial success
      let hasError = false;
      let errorMsg = '';
      if (Array.isArray(result.data)) {
        const failedItems = result.data.filter(
          (i) => i.Status !== undefined && i.Status !== 0,
        );
        if (failedItems.length > 0) {
          hasError = true;
          errorMsg =
            failedItems[0].MessLog ||
            failedItems[0].messLog ||
            'Lỗi ký HSM hàng loạt từ BKAV';
        }
      }

      return {
        success: hasError ? false : result.success,
        rawResponse: result.rawResponse,
        error: hasError ? errorMsg : result.error || null,
      };
    } catch (err) {
      logger.error(`[BkavAdapter] HSM batch sign error:`, err.message);
      return { success: false, error: err.message, rawResponse: null };
    }
  }

  /**
   * Giải trình với CQT — HĐ sai sót (CmdType 300).
   * Ref: FAQ mục C.8
   * @param {Object} params - { invoiceGUID, reason, notify, dateNotify, numberNotify }
   * @returns {Promise<Object>} { success, rawResponse, error }
   */
  async explainToCQT(params) {
    try {
      const {
        invoiceGUID,
        reason,
        notify = false,
        dateNotify,
        numberNotify,
      } = params;

      const commandData = {
        CmdType: BKAV_CMD_TYPES.EXPLAIN_300,
        CommandObject: JSON.stringify([
          {
            Invoice: {
              Notify: notify,
              DateNotify: dateNotify || '1900-01-01',
              NumberNotify: numberNotify || '',
              Reason: reason || '',
              InvoiceGUID: invoiceGUID,
            },
          },
        ]),
      };

      logger.info(`[BkavAdapter] Explaining to CQT for GUID: ${invoiceGUID}`);

      const result = await this._execCommand(commandData);
      const item = Array.isArray(result.data) ? result.data[0] : result.data;
      if (item && item.Status !== undefined && item.Status !== 0) {
        return {
          success: false,
          error: item.MessLog || item.messLog || 'Lỗi giải trình từ BKAV',
          rawResponse: result.rawResponse,
        };
      }

      return {
        success: result.success,
        data: result.data,
        rawResponse: result.rawResponse,
        error: result.error || null,
      };
    } catch (err) {
      logger.error(`[BkavAdapter] CQT explain error:`, err.message);
      return { success: false, error: err.message, rawResponse: null };
    }
  }

  /**
   * Giải trình với CQT — HĐ bị thay thế / bị điều chỉnh (CmdType 304).
   * Ref: FAQ mục C.9
   * @param {Object} params - { invoiceGUID, reason }
   * @returns {Promise<Object>} { success, rawResponse, error }
   */
  async explainReplacedToCQT(params) {
    try {
      const { invoiceGUID, reason } = params;

      const commandData = {
        CmdType: BKAV_CMD_TYPES.EXPLAIN_304,
        CommandObject: JSON.stringify([
          {
            Invoice: {
              Reason: reason || '',
              InvoiceGUID: invoiceGUID,
            },
          },
        ]),
      };

      logger.info(
        `[BkavAdapter] Explaining replaced/adjusted to CQT for GUID: ${invoiceGUID}`,
      );

      const result = await this._execCommand(commandData);
      const item = Array.isArray(result.data) ? result.data[0] : result.data;
      if (item && item.Status !== undefined && item.Status !== 0) {
        return {
          success: false,
          error:
            item.MessLog ||
            item.messLog ||
            'Lỗi giải trình HĐ bị thay thế từ BKAV',
          rawResponse: result.rawResponse,
        };
      }

      return {
        success: result.success,
        data: result.data,
        rawResponse: result.rawResponse,
        error: result.error || null,
      };
    } catch (err) {
      logger.error(`[BkavAdapter] CQT explain replaced error:`, err.message);
      return { success: false, error: err.message, rawResponse: null };
    }
  }

  /**
   * Test kết nối tới BKAV — thử gọi CmdType 800 với GUID rỗng.
   */
  async testConnection() {
    try {
      const commandData = {
        CmdType: BKAV_CMD_TYPES.GET_INFO_800,
        CommandObject: '00000000-0000-0000-0000-000000000000',
      };

      const result = await this._execCommand(commandData);

      // Nếu decrypt thất bại → lỗi credentials
      if (
        !result.success &&
        result.error &&
        result.error.includes('Không giải mã')
      ) {
        return {
          success: false,
          message: result.error,
          endpoint: this.endpoint,
        };
      }

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
   * Gọi BKAV ExecCommand WebService (JSON mode).
   * Luồng: JSON → GZip compress → AES-256-CBC encrypt → Base64 → HTTP POST JSON → response → decrypt → decompress → JSON
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

    // 5. Send HTTP POST (JSON mode — endpoint + /ExecCommand)
    const jsonEndpoint = this.endpoint.replace(/\/?$/, '/ExecCommand');
    const response = await axios.post(
      jsonEndpoint,
      {
        partnerGUID: this.partnerGUID,
        CommandData: base64Data,
      },
      {
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        timeout: 30000,
        maxBodyLength: 10 * 1024 * 1024, // 10MB
      },
    );

    // 6. Extract result from JSON response
    // JSON mode trả về: { d: "base64-encrypted-result" } hoặc plain string
    const rawResponse = response.data;
    const resultBase64 =
      typeof rawResponse === 'object' ? rawResponse.d : rawResponse;
    logger.debug(
      `[BkavAdapter] Response type: ${typeof rawResponse}, result length: ${resultBase64?.length || 0}`,
    );

    if (!resultBase64 || typeof resultBase64 !== 'string') {
      logger.error('[BkavAdapter] Empty or invalid response from BKAV');
      return {
        success: false,
        error: 'BKAV trả về response rỗng',
        rawResponse,
      };
    }

    // 7. Nếu response là plain text error (không phải base64) → trả lỗi
    if (
      resultBase64.startsWith('Partner') ||
      resultBase64.startsWith('Error')
    ) {
      return { success: false, error: resultBase64 };
    }

    // 8. Base64 decode → Decrypt → Decompress
    const resultBuffer = Buffer.from(resultBase64, 'base64');
    let resultJson;
    try {
      const decrypted = this._decrypt(resultBuffer);
      const decompressed = zlib.gunzipSync(decrypted);
      resultJson = JSON.parse(decompressed.toString('utf-8'));
    } catch (decryptErr) {
      logger.error(`[BkavAdapter] Decrypt failed: ${decryptErr.message}`);
      return {
        success: false,
        error: `Không giải mã được response từ BKAV. Kiểm tra PartnerGUID và PartnerToken có đúng với môi trường (Demo/Production) không. Chi tiết: ${decryptErr.message}`,
        rawResponse:
          typeof rawResponse === 'string'
            ? rawResponse.substring(0, 500)
            : JSON.stringify(rawResponse).substring(0, 500),
      };
    }

    logger.info(`[BkavAdapter] Response: ${JSON.stringify(resultJson)}`);

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
      } catch {
        /* keep as string */
      }
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
    const cipher = crypto.createCipheriv(
      'aes-256-cbc',
      this.aesKey,
      this.aesIV,
    );
    return Buffer.concat([cipher.update(data), cipher.final()]);
  }

  /**
   * AES-256-CBC decrypt.
   * @param {Buffer} data
   * @returns {Buffer} decrypted data
   */
  _decrypt(data) {
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      this.aesKey,
      this.aesIV,
    );
    return Buffer.concat([decipher.update(data), decipher.final()]);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Private: Data Mapping
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Tự động xác định CmdType dựa trên relationType (tạo mới vs thay thế vs điều chỉnh).
   *
   * Theo eHoaDon_WebService_Interface.docx:
   * - Thay thế (replacement): CmdType 120 (InvoiceNo=0) / 123 (Bkav cấp InvoiceNo)
   * - Điều chỉnh (adjustment): CmdType 121 (InvoiceNo=0) / 124 (Bkav cấp InvoiceNo)
   * - Điều chỉnh chiết khấu (adjustment_discount): CmdType 122 (InvoiceNo=0) / 126 (Bkav cấp InvoiceNo)
   *   → Chưa implement vì CRM chưa có flow "điều chỉnh chiết khấu" trên UI
   */
  _determineCmdType(invoice) {
    // Chuẩn BKAV: 120/121 → InvoiceNo=0 ; 123/124 → BKAV cấp InvoiceNo
    // (thay thế: 120/123, điều chỉnh: 121/124)
    const bkavAssignsNo = [
      BKAV_CMD_TYPES.CREATE_101,
      BKAV_CMD_TYPES.CREATE_112,
      BKAV_CMD_TYPES.CREATE_111,
    ].includes(this.cmdType);

    if (invoice.relationType === 'replacement') {
      return bkavAssignsNo
        ? BKAV_CMD_TYPES.REPLACE_123
        : BKAV_CMD_TYPES.REPLACE_120;
    }
    if (invoice.relationType === 'adjustment') {
      return bkavAssignsNo
        ? BKAV_CMD_TYPES.ADJUST_124
        : BKAV_CMD_TYPES.ADJUST_121;
    }

    // CmdType 111 = "PMKT tự cấp InvoiceNo" (CreateInvoiceWithFormSerialNo).
    // CRM luôn gửi InvoiceNo=0 vì không hỗ trợ user nhập số HĐ thủ công.
    // → Tự động chuyển sang 112 (PMKT cấp Form/Serial, Bkav cấp số HĐ).
    // Ref: Bkav_eHoadon_Layer.cs — CommandType.CreateInvoiceWithFormSerialNo = 111
    if (this.cmdType === BKAV_CMD_TYPES.CREATE_111)
      return BKAV_CMD_TYPES.CREATE_112;
    return this.cmdType;
  }

  _formatOriginalIdentify(identify) {
    if (!identify) return '';
    // Format expected: [Mẫu số]_[Ký hiệu]_[Số HĐ]
    // If it already has brackets, return as is
    if (identify.includes('[') && identify.includes(']')) return identify;

    // If it is delimited by underscore, e.g. 1_C22TAA_0000001
    const parts = identify.split('_');
    if (parts.length === 3) {
      return `[${parts[0]}]_[${parts[1]}]_[${parts[2]}]`;
    }

    // If it is a GUID (contains hyphens and length > 30), BKAV requires [InvoiceGUID]
    if (identify.includes('-') && identify.length >= 32) {
      return `[${identify}]`;
    }

    // Otherwise fallback to what user entered
    return identify;
  }

  /**
   * Build CommandObject từ Invoice model.
   * Ref: FAQ mục B.2a — Cấu trúc các trường thông tin chuẩn
   * Ref: Bkav_eHoadon_Layer.cs — InvoiceWS class
   * Ref: Invoice-Schema.xsd — required fields và valid ranges
   */
  _buildCommandObject(invoice) {
    // InvoiceStatusID: trạng thái loại HĐ theo XSD (minInclusive=1, maxInclusive=4)
    // 1=Tạo mới, 2=Thay thế, 3=Điều chỉnh, 4=Huỷ bỏ
    const invoiceStatusId =
      invoice.relationType === INVOICE_RELATION_TYPES.REPLACEMENT
        ? 2
        : invoice.relationType === INVOICE_RELATION_TYPES.ADJUSTMENT
          ? 3
          : 1;

    // TypeCreateInvoice: 0=Tạo HĐ, 1=Thay thế, 2=Điều chỉnh thông tin,
    //                    3=Điều chỉnh tăng, 4=Điều chỉnh giảm
    // Ref: Bkav_eHoadon_Layer.cs — InvoiceWS.TypeCreateInvoice
    const typeCreateInvoice =
      invoice.relationType === INVOICE_RELATION_TYPES.REPLACEMENT
        ? 1
        : invoice.relationType === INVOICE_RELATION_TYPES.ADJUSTMENT
          ? invoice.isIncrease
            ? 3
            : 4
          : 0;

    const cmd = {
      // ─── Thông tin cơ bản ─────────────────────────────────────────────
      Invoice: {
        InvoiceTypeID: this.invoiceTypeId,
        InvoiceDate: this._formatDate(invoice.invoiceDate),
        // InvoiceStatusID: required field (XSD minInclusive=1, maxInclusive=4)
        // Ref: Invoice-Schema.xsd line 128-134
        InvoiceStatusID: invoiceStatusId,
        // TypeCreateInvoice: phân loại mục đích tạo HĐ
        // Ref: Bkav_eHoadon_Layer.cs — InvoiceWS.TypeCreateInvoice
        TypeCreateInvoice: typeCreateInvoice,
        // SellerTaxCode: MST người bán (optional, maxLength=14)
        // Ref: ListInvoice_EN.xml, Invoice-Schema.xsd
        SellerTaxCode: this.config.sellerTaxCode || '',
        BuyerCode: invoice.buyer?.code || '',
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

        // ─── Fields đặc biệt ────────────────────────────────────────────
        MaCuaCQT: invoice.maCuaCQT || '',
        CCCD: invoice.buyer?.cccd || '',

        // ─── Thông tin liên kết khi HĐ thay thế / điều chỉnh ─────────
        OriginalInvoiceIdentify: this._formatOriginalIdentify(
          invoice.relatedInvoiceIdentify,
        ),
        Reason: invoice.reason || '',
      },

      // ─── Chi tiết hàng hoá / dịch vụ ─────────────────────────────────
      ListInvoiceDetailsWS: this._buildDetailsList(invoice),

      // ─── File đính kèm ────────────────────────────────────────────────
      ListInvoiceAttachFileWS: this._buildAttachFileList(invoice.attachFiles),

      // ─── PartnerInvoiceID — ID nội bộ CRM để BKAV tham chiếu ─────────
      PartnerInvoiceID: 0,
      PartnerInvoiceStringID: invoice.id,
    };

    return cmd;
  }

  /**
   * Map invoice items → BKAV ListInvoiceDetailsWS.
   */
  _buildDetailsList(invoice) {
    const items = invoice.items;
    if (!items || items.length === 0) return [];

    const bkavItems = items.map((item, idx) => {
      let userDefineDetails = item.userDefineDetails || '';

      // Handle Vehicle (ItemTypeID: 21)
      if (item.itemTypeId === 21) {
        try {
          // If userDefineDetails is already JSON string from FE, leave it.
          // Otherwise, we expect FE to send something like: 'SKhung:123|SMay:456' or similar, but ideally FE will send the JSON string.
          // If it's an object, stringify it.
          if (typeof userDefineDetails === 'object') {
            userDefineDetails = JSON.stringify(userDefineDetails);
          }
        } catch (e) {
          logger.warn(
            `Failed to parse vehicle details for item ${item.itemName}`,
            e,
          );
        }
      }

      // TaxRate (%) là nguồn sự thật → suy ra TaxRateID chuẩn BKAV (1..6, 9)
      const finalTaxRate =
        item.taxRate !== undefined && item.taxRate !== null
          ? Number(item.taxRate)
          : 10;
      const TAX_RATE_TO_ID = {
        0: BKAV_TAX_RATE_IDS.TAX_0,
        5: BKAV_TAX_RATE_IDS.TAX_5,
        8: BKAV_TAX_RATE_IDS.TAX_8,
        10: BKAV_TAX_RATE_IDS.TAX_10,
        [-1]: BKAV_TAX_RATE_IDS.TAX_KCT,
        [-2]: BKAV_TAX_RATE_IDS.TAX_KKK,
      };
      const finalTaxRateId =
        TAX_RATE_TO_ID[finalTaxRate] || BKAV_TAX_RATE_IDS.TAX_OTHER;
      // Thuế 0% / KCT / KKK → không có tiền thuế
      const finalTaxAmount = finalTaxRate <= 0 ? 0 : item.taxAmount || 0;

      return {
        ItemName: item.itemName || '',
        UnitName: item.unitName || '',
        Qty: item.quantity || 0,
        Price: item.unitPrice || 0,
        Amount: item.amount || 0,
        TaxRateID: finalTaxRateId,
        TaxRate: finalTaxRate,
        TaxAmount: finalTaxAmount,
        DiscountRate: item.discountRate || 0,
        DiscountAmount: item.discountAmount || 0,
        IsDiscount: item.isDiscount || item.itemTypeId === 30 || false,
        // Ref: FAQ Phụ lục 6 (trang 72-73): 15=Khuyến mãi, 21=Xe ô tô/mô tô là mã chuẩn BKAV;
        // 30 là mã UI nội bộ cho dòng chiết khấu → gửi ItemTypeID=0 kèm IsDiscount=true (FAQ Câu 6)
        ItemTypeID: item.itemTypeId === 30 ? 0 : item.itemTypeId || 0,
        ItemCode: item.itemCode || '',
        UserDefineDetails: userDefineDetails,
        IsIncrease: item.isIncrease,
        OrderNumber: idx + 1,
      };
    });

    // Handle Total Discount (Chiết khấu tổng)
    const hasDiscountRow = (invoice.items || []).some(
      (it) => it.isDiscount || it.itemTypeId === 30,
    );
    const totalDiscount = invoice.totalDiscountAmount || 0;
    if (totalDiscount > 0 && !hasDiscountRow) {
      bkavItems.push({
        ItemName: 'Chiết khấu thương mại',
        UnitName: '',
        Qty: 0,
        Price: 0,
        Amount: totalDiscount,
        TaxRateID: BKAV_TAX_RATE_IDS.TAX_10,
        TaxRate: 10,
        TaxAmount: 0,
        DiscountRate: 0,
        DiscountAmount: 0,
        IsDiscount: true,
        ItemTypeID: 0,
        ItemCode: '',
        UserDefineDetails: '',
        OrderNumber: bkavItems.length + 1,
      });
    }

    return bkavItems;
  }

  /**
   * Map attach files → BKAV ListInvoiceAttachFileWS.
   * Ref: FAQ mục B.22 — Đính kèm file
   */
  _buildAttachFileList(attachFiles) {
    if (!attachFiles || attachFiles.length === 0) return [];

    return attachFiles.map((file) => ({
      FileName: file.fileName || '',
      FileExtension: file.fileExtension || 'pdf',
      FileContent: file.fileContent || '', // Base64 encoded
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
    return `${yyyy}-${mm}-${dd}`;
  }
}

module.exports = BkavAdapter;
