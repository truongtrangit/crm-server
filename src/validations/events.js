const Joi = require("joi");

const EVENT_GROUPS = [
  "user_moi",
  "biz_moi",
  "can_nang_cap",
  "sap_het_han",
  "chuyen_khoan",
];

const createEventSchema = Joi.object({
  name: Joi.string().trim().required().messages({
    "any.required": "name is required",
  }),
  sub: Joi.string().allow("").optional(),
  group: Joi.string()
    .valid(...EVENT_GROUPS)
    .required()
    .messages({
      "any.required": "group is required",
      "any.only": `group must be one of: ${EVENT_GROUPS.join(", ")}`,
    }),
  customer: Joi.object({
    name: Joi.string().trim().required().messages({
      "any.required": "customer.name is required",
    }),
    avatar: Joi.string().allow("").optional(),
    role: Joi.string().allow("").optional(),
    email: Joi.string().allow("").optional(),
    phone: Joi.string().allow("").optional(),
    source: Joi.string().allow("").optional(),
    address: Joi.string().allow("").optional(),
  })
    .required()
    .messages({
      "any.required": "customer is required",
    }),
  biz: Joi.object({
    id: Joi.string().allow("").optional(),
    tags: Joi.array().items(Joi.string()).optional(),
  }).optional(),
  assignee: Joi.object({
    name: Joi.string().allow("").optional(),
    avatar: Joi.string().allow("").optional(),
    role: Joi.string().allow("").optional(),
  }).optional(),
  stage: Joi.string().allow("").optional(),
  tags: Joi.array().items(Joi.string()).optional(),
  plan: Joi.object({
    name: Joi.string().allow("").optional(),
    cycle: Joi.string().allow("").optional(),
    price: Joi.string().allow("").optional(),
    daysLeft: Joi.number().optional(),
    expiryDate: Joi.string().allow("").optional(),
  }).optional(),
  services: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().required(),
        active: Joi.boolean().optional(),
      }),
    )
    .optional(),
  quotas: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().required(),
        used: Joi.number().optional(),
        total: Joi.alternatives()
          .try(Joi.number(), Joi.string())
          .optional(),
        color: Joi.string().allow("").optional(),
      }),
    )
    .optional(),
});

const updateEventSchema = Joi.object({
  name: Joi.string().trim().optional(),
  sub: Joi.string().allow("").optional(),
  group: Joi.string()
    .valid(...EVENT_GROUPS)
    .optional(),
  customer: Joi.object({
    name: Joi.string().trim().optional(),
    avatar: Joi.string().allow("").optional(),
    role: Joi.string().allow("").optional(),
    email: Joi.string().allow("").optional(),
    phone: Joi.string().allow("").optional(),
    source: Joi.string().allow("").optional(),
    address: Joi.string().allow("").optional(),
  }).optional(),
  biz: Joi.object({
    id: Joi.string().allow("").optional(),
    tags: Joi.array().items(Joi.string()).optional(),
  }).optional(),
  assignee: Joi.object({
    name: Joi.string().allow("").optional(),
    avatar: Joi.string().allow("").optional(),
    role: Joi.string().allow("").optional(),
  }).optional(),
  stage: Joi.string().allow("").optional(),
  tags: Joi.array().items(Joi.string()).optional(),
  plan: Joi.object({
    name: Joi.string().allow("").optional(),
    cycle: Joi.string().allow("").optional(),
    price: Joi.string().allow("").optional(),
    daysLeft: Joi.number().optional(),
    expiryDate: Joi.string().allow("").optional(),
  }).optional(),
  services: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().required(),
        active: Joi.boolean().optional(),
      }),
    )
    .optional(),
  quotas: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().required(),
        used: Joi.number().optional(),
        total: Joi.alternatives()
          .try(Joi.number(), Joi.string())
          .optional(),
        color: Joi.string().allow("").optional(),
      }),
    )
    .optional(),
})
  .min(1)
  .messages({
    "object.min": "At least one field is required to update",
  });

const listEventsQuerySchema = Joi.object({
  search: Joi.string().allow("").optional(),
  group: Joi.string()
    .valid(...EVENT_GROUPS)
    .allow("")
    .optional(),
  stage: Joi.string().allow("").optional(),
  assignee: Joi.string().allow("").optional(),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
});

const addTimelineSchema = Joi.object({
  type: Joi.string().valid("phone", "email", "event", "note").optional(),
  title: Joi.string().trim().required().messages({
    "any.required": "title is required",
  }),
  time: Joi.string().allow("").optional(),
  content: Joi.string().allow("", null).optional(),
  duration: Joi.string().allow("", null).optional(),
});

module.exports = {
  createEventSchema,
  updateEventSchema,
  listEventsQuerySchema,
  addTimelineSchema,
};
