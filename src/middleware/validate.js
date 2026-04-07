const { sendError } = require("../utils/http");

/**
 * Express middleware factory for Joi validation.
 *
 * @param {import('joi').ObjectSchema} schema  — Joi schema to validate against
 * @param {'body'|'query'|'params'} source    — which part of the request to validate (default: 'body')
 * @returns {Function} Express middleware
 *
 * Usage:
 *   router.post("/", validate(createCustomerSchema), handler);
 *   router.get("/", validate(listQuerySchema, "query"), handler);
 */
function validate(schema, source = "body") {
  return (req, res, next) => {
    const data = req[source];
    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: false,
      allowUnknown: source === "query",
    });

    if (error) {
      const details = error.details.map((item) => ({
        field: item.path.join("."),
        message: item.message.replace(/"/g, ""),
      }));

      return sendError(res, 400, "Validation failed", {
        code: "VALIDATION_ERROR",
        details,
      });
    }

    // Replace source data with validated/normalized values
    req[source] = value;
    return next();
  };
}

module.exports = validate;
