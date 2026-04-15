/**
 * Zod request validation middleware factory.
 * Usage: router.post('/path', validate(MyZodSchema), controller)
 */
import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";

export function validate(schema: ZodSchema, target: "body" | "query" | "params" = "body") {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      const errors = (result.error as ZodError).errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }));
      res.status(422).json({ success: false, code: "VALIDATION_ERROR", errors });
      return;
    }
    // Replace the target with the parsed (and type-coerced) data
    req[target] = result.data;
    next();
  };
}
