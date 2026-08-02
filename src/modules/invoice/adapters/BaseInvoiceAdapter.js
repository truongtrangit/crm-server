/**
 * ─── BaseInvoiceAdapter ──────────────────────────────────────────────────────
 * Abstract base class cho tất cả invoice provider adapters.
 * Các adapter cụ thể (BKAV, SePay) kế thừa và implement các method này.
 */
class BaseInvoiceAdapter {
  constructor(providerConfig) {
    if (new.target === BaseInvoiceAdapter) {
      throw new Error('BaseInvoiceAdapter là abstract class, không thể khởi tạo trực tiếp');
    }
    this.config = providerConfig;
  }

  /**
   * Phát hành hoá đơn lên nhà cung cấp.
   * @param {Object} invoice - Invoice document từ DB
   * @returns {Promise<Object>} { success, invoiceGUID, invoiceNo, lookupCode, rawResponse, error }
   */
  async issue(invoice) {
    throw new Error('Method issue() chưa được implement');
  }

  /**
   * Huỷ bỏ hoá đơn.
   * @param {Object} invoice - Invoice document từ DB
   * @param {string} reason - Lý do huỷ
   * @returns {Promise<Object>} { success, rawResponse, error }
   */
  async cancel(invoice, reason) {
    throw new Error('Method cancel() chưa được implement');
  }

  /**
   * Lấy thông tin hoá đơn từ provider.
   * @param {Object} invoice - Invoice document từ DB
   * @returns {Promise<Object>} { success, data, rawResponse, error }
   */
  async getInfo(invoice) {
    throw new Error('Method getInfo() chưa được implement');
  }

  /**
   * Lấy PDF/XML hoá đơn.
   * @param {Object} invoice - Invoice document từ DB
   * @param {string} format - 'pdf' | 'xml'
   * @returns {Promise<Buffer|null>}
   */
  async download(invoice, format = 'pdf') {
    throw new Error('Method download() chưa được implement');
  }

  /**
   * Test kết nối tới provider.
   * @returns {Promise<Object>} { success, message, error }
   */
  async testConnection() {
    throw new Error('Method testConnection() chưa được implement');
  }
}

module.exports = BaseInvoiceAdapter;
