const CustomerService = require('./customer.service');
const { sendSuccess } = require('../../../core/utils/http');
const SystemLogService = require('../../system/log/systemLog.service');
const { RESOURCES } = require('../../../core/constants/rbac');
const { pickFields } = require('../../../core/utils/object');

class CustomerController {
  async getCustomers(req, res) {
    const result = await CustomerService.getCustomers(
      req.query,
      req.user,
      req.resourceScopeFilter,
    );

    if (req.scopedFields && result && Array.isArray(result.items)) {
      result.items = result.items.map((c) => pickFields(c, req.scopedFields));
    }

    return sendSuccess(res, 200, "Get customer list success", result);
  }

  async getCustomerById(req, res) {
    let customer = await CustomerService.getCustomerById(req.params.id);

    if (req.scopedFields && customer) {
      customer = pickFields(customer, req.scopedFields);
    }

    return sendSuccess(res, 200, "Get customer detail success", customer);
  }

  async createCustomer(req, res) {
    const customer = await CustomerService.createCustomer(
      req.body || {},
      req.user,
    );
    SystemLogService.log({
      action: "create",
      resource: RESOURCES.CUSTOMERS,
      resourceId: customer.id,
      resourceName: customer.name,
      description: `Tạo khách hàng "${customer.name}"`,
      metadata: { newItem: customer },
      req,
    });
    return sendSuccess(res, 201, "Create customer success", customer);
  }

  async updateCustomer(req, res) {
    const { customer, changes } = await CustomerService.updateCustomer(
      req.params.id,
      req.body || {},
      req.user,
    );
    SystemLogService.log({
      action: "update",
      resource: RESOURCES.CUSTOMERS,
      resourceId: req.params.id,
      resourceName: customer.name,
      description: `Cập nhật khách hàng "${customer.name}"`,
      metadata: { changes },
      req,
    });
    return sendSuccess(res, 200, "Update customer success", customer);
  }

  async deleteCustomer(req, res) {
    const force = req.query.force === "true";
    const customer = await CustomerService.deleteCustomer(req.params.id, {
      force,
    });
    const name = customer ? customer.name : req.params.id;
    SystemLogService.log({
      action: force ? "force_delete" : "delete",
      resource: RESOURCES.CUSTOMERS,
      resourceId: req.params.id,
      resourceName: name,
      description: `${force ? "Xóa vĩnh viễn" : "Xóa"} khách hàng "${name}"`,
      metadata: { deletedItem: customer },
      req,
    });
    return sendSuccess(res, 200, "Delete customer success", null);
  }

  async restoreCustomer(req, res) {
    const customer = await CustomerService.restoreCustomer(req.params.id);
    SystemLogService.log({
      action: "restore",
      resource: RESOURCES.CUSTOMERS,
      resourceId: req.params.id,
      resourceName: customer.name,
      description: `Khôi phục khách hàng "${customer.name}"`,
      req,
    });
    return sendSuccess(res, 200, "Restore customer success", customer);
  }

  async permanentDeleteCustomer(req, res) {
    const customer = await CustomerService.permanentDeleteCustomer(
      req.params.id,
    );
    const name = customer ? customer.name : req.params.id;
    SystemLogService.log({
      action: "force_delete",
      resource: RESOURCES.CUSTOMERS,
      resourceId: req.params.id,
      resourceName: name,
      description: `Xóa vĩnh viễn khách hàng "${name}"`,
      metadata: { deletedItem: customer },
      req,
    });
    return sendSuccess(res, 200, "Permanent delete customer success", null);
  }
}

module.exports = new CustomerController();
