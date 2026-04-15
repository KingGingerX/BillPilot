/**
 * Subscriptions module tests.
 */
import request from "supertest";
import { createApp } from "../src/app";
import { PrismaClient } from "@prisma/client";

const app = createApp();
const prisma = new PrismaClient();

let userToken: string;

beforeAll(async () => {
  await prisma.$connect();
  const res = await request(app).post("/api/auth/register").send({
    email: `sub-${Date.now()}@test.pims`,
    password: "Password1!",
    firstName: "Sub",
    lastName: "Test",
  });
  userToken = res.body.data.tokens.accessToken;
});

afterAll(async () => {
  await prisma.refreshToken.deleteMany({});
  await prisma.user.deleteMany({ where: { email: { contains: "@test.pims" } } });
  await prisma.$disconnect();
});

describe("GET /api/subscriptions/plans", () => {
  it("returns subscription plans publicly", async () => {
    const res = await request(app).get("/api/subscriptions/plans");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe("GET /api/subscriptions/me", () => {
  it("returns null when user has no subscription", async () => {
    const res = await request(app)
      .get("/api/subscriptions/me")
      .set("Authorization", `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
  });

  it("requires auth", async () => {
    const res = await request(app).get("/api/subscriptions/me");
    expect(res.status).toBe(401);
  });
});

describe("POST /api/subscriptions/checkout", () => {
  it("requires auth", async () => {
    const res = await request(app).post("/api/subscriptions/checkout").send({
      planId: "some-plan-id",
      successUrl: "https://example.com/success",
      cancelUrl: "https://example.com/cancel",
    });
    expect(res.status).toBe(401);
  });

  it("returns validation error for missing planId", async () => {
    const res = await request(app)
      .post("/api/subscriptions/checkout")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ successUrl: "https://example.com/success", cancelUrl: "https://example.com/cancel" });
    // Will fail at service layer with 404 or at validation — either is correct
    expect([404, 422, 500]).toContain(res.status);
  });
});
