/**
 * Auth module integration tests.
 * Uses supertest to hit real routes and an in-memory SQLite (via Prisma test setup).
 */
import request from "supertest";
import { createApp } from "../src/app";
import { PrismaClient } from "@prisma/client";

const app = createApp();
const prisma = new PrismaClient();

beforeAll(async () => {
  // Ensure DB is migrated for tests
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

afterEach(async () => {
  // Clean up test data
  await prisma.refreshToken.deleteMany({});
  await prisma.user.deleteMany({ where: { email: { contains: "@test.pims" } } });
});

describe("POST /api/auth/register", () => {
  const validPayload = {
    email: `user-${Date.now()}@test.pims`,
    password: "Password1!",
    firstName: "Test",
    lastName: "User",
  };

  it("registers a new user and returns tokens", async () => {
    const res = await request(app).post("/api/auth/register").send(validPayload);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.tokens.accessToken).toBeTruthy();
    expect(res.body.data.tokens.refreshToken).toBeTruthy();
    expect(res.body.data.user.email).toBe(validPayload.email);
    // Password must never be in the response
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");
  });

  it("rejects duplicate email", async () => {
    await request(app).post("/api/auth/register").send(validPayload);
    const res = await request(app).post("/api/auth/register").send(validPayload);
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it("rejects weak password", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...validPayload, password: "weak" });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("rejects invalid email", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...validPayload, email: "not-an-email" });
    expect(res.status).toBe(422);
  });
});

describe("POST /api/auth/login", () => {
  const email = `login-${Date.now()}@test.pims`;
  const password = "Password1!";

  beforeEach(async () => {
    await request(app).post("/api/auth/register").send({
      email, password, firstName: "Login", lastName: "Test",
    });
  });

  it("returns tokens on valid credentials", async () => {
    const res = await request(app).post("/api/auth/login").send({ email, password });
    expect(res.status).toBe(200);
    expect(res.body.data.tokens.accessToken).toBeTruthy();
  });

  it("returns 401 on wrong password", async () => {
    const res = await request(app).post("/api/auth/login").send({ email, password: "Wrong1!" });
    expect(res.status).toBe(401);
    // Must not reveal whether it was the email or password that was wrong
    expect(res.body.message).toBe("Invalid email or password");
  });

  it("returns 401 on non-existent email", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "nobody@test.pims", password });
    expect(res.status).toBe(401);
  });
});

describe("GET /api/auth/me", () => {
  it("returns user profile with valid token", async () => {
    const registerRes = await request(app).post("/api/auth/register").send({
      email: `me-${Date.now()}@test.pims`,
      password: "Password1!",
      firstName: "Me",
      lastName: "Test",
    });
    const token = registerRes.body.data.tokens.accessToken;
    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBeTruthy();
  });

  it("returns 401 without token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns 401 with tampered token", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer eyJhbGciOiJIUzI1NiJ9.tampered.signature");
    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/refresh", () => {
  it("returns new token pair with valid refresh token", async () => {
    const reg = await request(app).post("/api/auth/register").send({
      email: `refresh-${Date.now()}@test.pims`,
      password: "Password1!",
      firstName: "Refresh",
      lastName: "Test",
    });
    const refreshToken = reg.body.data.tokens.refreshToken;
    const res = await request(app).post("/api/auth/refresh").send({ refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
    // Old refresh token should be rotated (new one returned)
    expect(res.body.data.refreshToken).not.toBe(refreshToken);
  });
});

describe("GET /health", () => {
  it("returns 200 with status ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});
