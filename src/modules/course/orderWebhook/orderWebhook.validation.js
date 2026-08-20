const Joi = require('joi');
const {
  ORDER_WEBHOOK_EVENTS,
  ORDER_WEBHOOK_SCOPE_TYPES,
  COURSE_TYPES,
} = require('../../../core/constants/appData');

const eventValues = Object.values(ORDER_WEBHOOK_EVENTS);
const scopeTypeValues = Object.values(ORDER_WEBHOOK_SCOPE_TYPES);
const courseTypeValues = Object.values(COURSE_TYPES);

const createRuleSchema = Joi.object({
  name: Joi.string().required().max(100).trim(),
  events: Joi.array()
    .items(Joi.string().valid(...eventValues))
    .min(1)
    .required(),
  scope: Joi.object({
    type: Joi.string()
      .valid(...scopeTypeValues)
      .required(),
    courseTypes: Joi.array()
      .items(Joi.string().valid(...courseTypeValues))
      .when('type', {
        is: ORDER_WEBHOOK_SCOPE_TYPES.COURSE_TYPE,
        then: Joi.array().min(1).required(),
        otherwise: Joi.array().optional(),
      }),
    specificCourses: Joi.array()
      .items(
        Joi.object({
          courseId: Joi.string().required(),
          courseName: Joi.string().required(),
          courseModelType: Joi.string().valid('CourseOnline', 'CourseOffline', 'CourseChallenge').required(),
        })
      )
      .when('type', {
        is: ORDER_WEBHOOK_SCOPE_TYPES.SPECIFIC,
        then: Joi.array().min(1).max(1).required(),
        otherwise: Joi.array().optional(),
      }),
  }).required(),
  url: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .required()
    .trim(),
  headers: Joi.array().items(
    Joi.object({
      key: Joi.string().required().trim(),
      value: Joi.string().required().trim(),
    })
  ).optional(),
  isActive: Joi.boolean().default(true),
});

const updateRuleSchema = Joi.object({
  name: Joi.string().max(100).trim(),
  events: Joi.array()
    .items(Joi.string().valid(...eventValues))
    .min(1),
  scope: Joi.object({
    type: Joi.string()
      .valid(...scopeTypeValues)
      .required(),
    courseTypes: Joi.array()
      .items(Joi.string().valid(...courseTypeValues))
      .when('type', {
        is: ORDER_WEBHOOK_SCOPE_TYPES.COURSE_TYPE,
        then: Joi.array().min(1).required(),
        otherwise: Joi.array().optional(),
      }),
      specificCourses: Joi.array()
      .items(
        Joi.object({
          courseId: Joi.string().required(),
          courseName: Joi.string().required(),
          courseModelType: Joi.string().valid('CourseOnline', 'CourseOffline', 'CourseChallenge').required(),
        })
      )
      .when('type', {
        is: ORDER_WEBHOOK_SCOPE_TYPES.SPECIFIC,
        then: Joi.array().min(1).max(1).required(),
        otherwise: Joi.array().optional(),
      }),
  }),
  url: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .trim(),
  headers: Joi.array().items(
    Joi.object({
      key: Joi.string().required().trim(),
      value: Joi.string().required().trim(),
    })
  ).optional(),
  isActive: Joi.boolean(),
}).min(1);

module.exports = {
  createRuleSchema,
  updateRuleSchema,
};
