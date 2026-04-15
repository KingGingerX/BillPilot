/**
 * JWT authentication middleware.
 * Validates the Bearer token in the Authorization header and attaches
 * the decoded payload to req.user.
 */
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

// Augment Express Request type to include user
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * requireAuth — attaches decoded JWT payload to req.user.
 * Returns 401 if token is missing or invalid.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ success: false, message: "Authorization token required" });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, config.jwt.secret) as JwtPayload;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
}

/**
 * requireRole — must be called after requireAuth.
 * Returns 403 if user does not have the required role.
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ success: false, message: "Insufficient permissions" });
      return;
    }
    next();
  };
}

/**
 * optionalAuth — like requireAuth but does not fail if no token present.
 * Useful for routes that behave differently for authenticated users.
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      req.user = jwt.verify(token, config.jwt.secret) as JwtPayload;
    } catch {
      // Silently ignore invalid optional tokens
    }
  }
  next();
}
