const CustomerService = require("../services/CustomerService");
const { sendSuccess } = require("../utils/http");
const { buildPaginatedResponse } = require("../utils/pagination");

class CustomerController {
  async getCustomers(req, res) {
    const { customers, totalItems, page, limit } = await CustomerService.getCustomers(req.query);
    return sendSuccess(
      res,
      200,
      "Get customer list success",
      buildPaginatedResponse(customers, totalItems, page, limit)
    );
  }

  async getAssignmentRoles(req, res) {
    const roles = CustomerService.getAssignmentRoles();
    return sendSuccess(res, 200, "Get assignment roles success", { items: roles });
  }

  async getCustomerById(req, res) {
    const customer = await CustomerService.getCustomerById(req.params.id);
    return sendSuccess(res, 200, "Get customer detail success", customer);
  }

  async createCustomer(req, res) {
    const customer = await CustomerService.createCustomer(req.body || {});
    return sendSuccess(res, 201, "Create customer success", customer);
  }

  async updateCustomer(req, res) {
    const customer = await CustomerService.updateCustomer(req.params.id, req.body || {});
    return sendSuccess(res, 200, "Update customer success", customer);
  }

  async deleteCustomer(req, res) {
    const force = req.query.force === 'true';
    await CustomerService.deleteCustomer(req.params.id, req.user?.id, { force });
    return sendSuccess(res, 200, "Delete customer success", null);
  }

  async assignCustomer(req, res) {
    const customer = await CustomerService.assignCustomer(req.params.id, req.body || {}, req.user);
    return sendSuccess(res, 200, "Assign staff success", customer);
  }

  async unassignCustomer(req, res) {
    const { userId } = req.params;
    const { role } = req.query;
    const customer = await CustomerService.unassignCustomer(req.params.id, userId, role, req.user);
    return sendSuccess(res, 200, "Unassign staff success", customer);
  }
}

module.exports = new CustomerController();
