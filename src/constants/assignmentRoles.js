/**
 * Fixed list of customer assignment roles.
 * These represent the capacity in which a staff member manages a customer.
 */
const ASSIGNMENT_ROLES = [
  { value: "sale", label: "Sale" },
  { value: "marketing", label: "Marketing" },
  { value: "tuvan", label: "Tư vấn" },
  { value: "kythuat", label: "Kỹ thuật" },
  { value: "cskh", label: "CSKH" },
];

const ASSIGNMENT_ROLE_VALUES = ASSIGNMENT_ROLES.map((r) => r.value);

module.exports = {
  ASSIGNMENT_ROLES,
  ASSIGNMENT_ROLE_VALUES,
};


