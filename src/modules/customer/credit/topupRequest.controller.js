const topupRequestService = require('./topupRequest.service');
const SystemLogService = require('../../system/log/systemLog.service');
const { sendSuccess } = require('../../../core/utils/http');

class TopupRequestController {
  // ─── External (BotVN) ──────────────────────────────────────────────────────

  getTopupConfig = async (req, res) => {
    const config = await topupRequestService.getTopupConfig();
    return sendSuccess(res, 200, 'Lấy cấu hình nạp tiền thành công', config);
  };

  createTopupRequest = async (req, res) => {
    const customerId = req.user.id || req.user._id;
    const result = await topupRequestService.createTopupRequest(customerId, req.body);
    return sendSuccess(res, 201, 'Tạo yêu cầu nạp tiền thành công', result);
  };

  confirmTransfer = async (req, res) => {
    const customerId = req.user.id || req.user._id;
    const { id } = req.params;
    const result = await topupRequestService.confirmTransfer(customerId, id);
    return sendSuccess(res, 200, 'Xác nhận chuyển khoản thành công', result);
  };

  cancelRequest = async (req, res) => {
    const customerId = req.user.id || req.user._id;
    const { id } = req.params;
    const result = await topupRequestService.cancelRequest(customerId, id);
    return sendSuccess(res, 200, 'Hủy yêu cầu nạp tiền thành công', result);
  };

  getMyRequests = async (req, res) => {
    const customerId = req.user.id || req.user._id;
    const requests = await topupRequestService.getMyRequests(customerId);
    return sendSuccess(res, 200, 'Lấy danh sách yêu cầu nạp thành công', requests);
  };

  getBillingInfo = async (req, res) => {
    const customerId = req.user.id || req.user._id;
    const billingInfo = await topupRequestService.getBillingInfo(customerId);
    return sendSuccess(res, 200, 'Lấy thông tin hoá đơn thành công', billingInfo);
  };

  saveBillingInfo = async (req, res) => {
    const customerId = req.user.id || req.user._id;
    const billingInfo = await topupRequestService.saveBillingInfo(customerId, req.body);
    return sendSuccess(res, 200, 'Lưu thông tin hoá đơn thành công', billingInfo);
  };

  // ─── Internal (CRM Admin) ──────────────────────────────────────────────────

  adminGetRequests = async (req, res) => {
    const result = await topupRequestService.adminGetRequests(req.query);
    return sendSuccess(res, 200, 'Lấy danh sách yêu cầu nạp thành công', result);
  };

  adminGetRequestById = async (req, res) => {
    const result = await topupRequestService.adminGetRequestById(req.params.id);
    return sendSuccess(res, 200, 'Lấy chi tiết yêu cầu nạp thành công', result);
  };

  adminApprove = async (req, res) => {
    const adminUserId = req.user.id;
    const { id } = req.params;
    const { note } = req.body;

    const result = await topupRequestService.adminApprove(id, adminUserId, note);

    SystemLogService.log({
      action: 'update',
      resource: 'topup_requests',
      resourceId: id,
      resourceName: `Yêu cầu nạp tiền ${id}`,
      description: `Duyệt yêu cầu nạp tiền ${id}, cộng ${result.creditAmount} credit`,
      req,
    });

    return sendSuccess(res, 200, 'Duyệt yêu cầu nạp tiền thành công', result);
  };

  adminReject = async (req, res) => {
    const adminUserId = req.user.id;
    const { id } = req.params;
    const { note } = req.body;

    const result = await topupRequestService.adminReject(id, adminUserId, note);

    SystemLogService.log({
      action: 'update',
      resource: 'topup_requests',
      resourceId: id,
      resourceName: `Yêu cầu nạp tiền ${id}`,
      description: `Từ chối yêu cầu nạp tiền ${id}${note ? `: ${note}` : ''}`,
      req,
    });

    return sendSuccess(res, 200, 'Từ chối yêu cầu nạp tiền thành công', result);
  };

  adminGetStats = async (req, res) => {
    const stats = await topupRequestService.adminGetStats(req.query);
    return sendSuccess(res, 200, 'Lấy thống kê yêu cầu nạp thành công', stats);
  };
}

module.exports = new TopupRequestController();
