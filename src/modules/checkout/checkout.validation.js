const Joi = require("joi");
const { COURSE_TYPES, PAYMENT_METHODS } = require("../../core/constants/appData");

const processCheckout = Joi.object({
  items: Joi.array()
    .items(
      Joi.object({
        courseId: Joi.string().required().messages({
          "string.empty": "courseId is required",
          "any.required": "courseId is required",
        }),
        courseType: Joi.string()
          .valid(...Object.values(COURSE_TYPES))
          .required()
          .messages({
            "string.empty": "courseType is required",
            "any.required": "courseType is required",
            "any.only": "Invalid courseType",
          }),
        packageId: Joi.string().required().messages({
          "string.empty": "packageId is required",
          "any.required": "packageId is required",
        }),
        paymentMethod: Joi.string()
          .valid(...Object.values(PAYMENT_METHODS))
          .required()
          .messages({
            "string.empty": "paymentMethod is required",
            "any.required": "paymentMethod is required",
            "any.only": "Invalid paymentMethod",
          }),
      })
    )
    .min(1)
    .required()
    .messages({
      "array.min": "At least one item is required in the cart",
      "any.required": "Items array is required",
    }),
});

module.exports = {
  processCheckout,
};
