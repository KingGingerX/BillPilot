import { Request, Response, NextFunction } from "express";
import { config } from "../../config";

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const secret = req.headers["x-admin-secret"] ?? req.query.secret;
  if (secret !== config.adminSecret) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}
