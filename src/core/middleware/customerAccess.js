const Customer = require('../../modules/customer/customer/customer.model');
const { requireResourceAccess, scopeResourceList } = require('./resourceAccess');

const customerResourceAccess = requireResourceAccess({
  getResource: (req) => Customer.findOne({ id: req.params.id }),
  getCreatorId: (customer) => customer.createdBy,
  allowCreator: true,
  allowManagerSubordinateCreator: true,
});

const customerScopeList = scopeResourceList({
  creatorField: "createdBy",
  allowCreator: true,
  allowManagerSubordinateCreator: true,
  includeUnassigned: true,
  moduleTypeFilter: {
    field: "mainType",
    mapping: {
      "customers.biz": "biz",
      "customers.user": "user",
    },
  },
});

module.exports = { customerResourceAccess, customerScopeList };
