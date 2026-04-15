/**
 * Auth Service — handles all authentication business logic.
 * JWT access tokens (short-lived) + refresh tokens (long-lived, stored in DB).
 */
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient, Role } from "@prisma/client";
import { config } from "../../config";
import { generateToken } from "../../utils/crypto";
import { sendEmail, emailVerifyTemplate, passwordResetTemplate } from "../../utils/email";
import { AppError, UnauthorizedError } from "../../middleware/errorHandler";
import { RegisterDto, LoginDto } from "./auth.schema";

const prisma = new PrismaClient();

/** How many rounds bcrypt uses — 12 is secure and ~250ms on modern hw */
const BCRYPT_ROUNDS = 12;

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface AuthResponse {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: Role;
    isEmailVerified: boolean;
  };
  tokens: TokenPair;
}

// ── Token helpers ─────────────────────────────────────────────

function signAccessToken(payload: { userId: string; email: string; role: string }): string {
  return jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn } as jwt.SignOptions);
}

function signRefreshToken(payload: { userId: string }): string {
  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn,
  } as jwt.SignOptions);
}

function refreshExpiresAt(): Date {
  const days = parseInt(config.jwt.refreshExpiresIn.replace("d", ""), 10) || 7;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

// ── Service methods ───────────────────────────────────────────

export async function register(dto: RegisterDto): Promise<AuthResponse> {
  // Check uniqueness before hashing (fast fail)
  const exists = await prisma.user.findUnique({ where: { email: dto.email } });
  if (exists) throw new AppError("Email already registered", 409, "CONFLICT");

  const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
  const emailVerifyToken = generateToken(32);

  const user = await prisma.user.create({
    data: {
      email: dto.email,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      emailVerifyToken,
    },
  });

  // Send verification email (non-blocking)
  const verifyUrl = `${config.frontendUrl}/verify-email?token=${emailVerifyToken}`;
  void sendEmail({
    to: user.email,
    subject: "Verify your PIMS account",
    html: emailVerifyTemplate(user.firstName, verifyUrl),
  });

  const tokens = await createSession(user.id, user.email, user.role);
  return { user: publicUser(user), tokens };
}

export async function login(dto: LoginDto): Promise<AuthResponse> {
  const user = await prisma.user.findUnique({ where: { email: dto.email } });
  if (!user) throw new UnauthorizedError("Invalid email or password");

  const valid = await bcrypt.compare(dto.password, user.passwordHash);
  if (!valid) throw new UnauthorizedError("Invalid email or password");

  const tokens = await createSession(user.id, user.email, user.role);
  return { user: publicUser(user), tokens };
}

export async function refreshTokens(refreshToken: string): Promise<TokenPair> {
  let payload: { userId: string };
  try {
    payload = jwt.verify(refreshToken, config.jwt.refreshSecret) as { userId: string };
  } catch {
    throw new UnauthorizedError("Invalid refresh token");
  }

  const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
  if (!stored || stored.expiresAt < new Date()) {
    throw new UnauthorizedError("Refresh token expired or revoked");
  }

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user) throw new UnauthorizedError("User not found");

  // Rotate: delete old, create new
  await prisma.refreshToken.delete({ where: { token: refreshToken } });
  return createSession(user.id, user.email, user.role);
}

export async function logout(refreshToken: string): Promise<void> {
  await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
}

export async function verifyEmail(token: string): Promise<void> {
  const user = await prisma.user.findFirst({ where: { emailVerifyToken: token } });
  if (!user) throw new AppError("Invalid or expired verification token", 400);

  await prisma.user.update({
    where: { id: user.id },
    data: { isEmailVerified: true, emailVerifyToken: null },
  });
}

export async function forgotPassword(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });
  // Always return success to avoid user enumeration
  if (!user) return;

  const token = generateToken(32);
  const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.user.update({
    where: { id: user.id },
    data: { resetToken: token, resetTokenExpiry: expiry },
  });

  const resetUrl = `${config.frontendUrl}/reset-password?token=${token}`;
  void sendEmail({
    to: user.email,
    subject: "Reset your PIMS password",
    html: passwordResetTemplate(user.firstName, resetUrl),
  });
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const user = await prisma.user.findFirst({
    where: { resetToken: token, resetTokenExpiry: { gt: new Date() } },
  });
  if (!user) throw new AppError("Invalid or expired reset token", 400);

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, resetToken: null, resetTokenExpiry: null },
  });

  // Revoke all existing sessions for security
  await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      subscription: { include: { plan: true } },
      affiliateProfile: { select: { code: true, commissionRate: true, isApproved: true } },
    },
  });
  if (!user) throw new UnauthorizedError("User not found");
  return user;
}

// ── Private helpers ───────────────────────────────────────────

async function createSession(
  userId: string,
  email: string,
  role: Role
): Promise<TokenPair> {
  const accessToken = signAccessToken({ userId, email, role });
  const refreshToken = signRefreshToken({ userId });

  await prisma.refreshToken.create({
    data: { token: refreshToken, userId, expiresAt: refreshExpiresAt() },
  });

  return { accessToken, refreshToken };
}

function publicUser(user: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  isEmailVerified: boolean;
}) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    isEmailVerified: user.isEmailVerified,
  };
}
