import { AppError } from '../errors/app-error.js';

/**
 * Validates request data against a Zod schema.
 *
 * Usage:
 *   router.post('/items', validate({ body: ItemInput }), controller.create)
 *
 * @param {{ body?: ZodSchema, params?: ZodSchema, query?: ZodSchema }} schemas
 */
export function validate(schemas) {
  return (req, _res, next) => {
    const errors = {};

    for (const [key, schema] of Object.entries(schemas)) {
      if (!schema) continue;

      const result = schema.safeParse(req[key]);
      if (!result.success) {
        errors[key] = result.error.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        }));
      } else {
        // Replace with coerced / parsed values
        req[key] = result.data;
      }
    }

    if (Object.keys(errors).length > 0) {
      return next(AppError.validation('Validation failed', errors));
    }

    next();
  };
}
