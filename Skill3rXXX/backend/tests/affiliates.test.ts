/**
 * Affiliates module tests.
 */
import request from "supertest";
import { createApp } from "../src/app";
import { PrismaClient } from "@prisma/client";

const app = createApp();
const prisma = new PrismaClient();

let userToken: string;
let userId: string;

beforeAll(async () => {
  await prisma.$connect();
  const res = await request(app).post("/api/auth/register").send({
    email: `aff-${Date.now()}@test.pims`,
    password: "Password1!",
    firstName: "Aff",
    lastName: "User",
  });
  userToken = res.body.data.tokens.accessToken;
  userId = res.body.data.user.id;
});

afterAll(async () => {
  await prisma.affiliateConversion.deleteMany({});
  await prisma.affiliateClick.deleteMany({});
  await prisma.affiliateProfile.deleteMany({ where: { userId } });
  await prisma.refreshToken.deleteMany({});
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

describe("POST /api/affiliates/apply", () => {
  it("allows authenticated user to apply", async () => {
    const res = await request(app)
      .post("/api/affiliates/apply")
      .set("Authorization", `Bearer ${userToken}`);
    expect(res.status).toBe(201);
    expect(res.body.data.code).toHaveLength(6);
    expect(res.body.data.isApproved).toBe(false);
  });

  it("prevents duplicate applications", async () => {
    const res = await request(app)
      .post("/api/affiliates/apply")
      .set("Authorization", `Bearer ${userToken}`);
    expect(res.status).toBe(409);
  });

  it("requires authentication", async () => {
    const res = await request(app).post("/api/affiliates/apply");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/affiliates/me", () => {
  it("returns affiliate profile", async () => {
    const res = await request(app)
      .get("/api/affiliates/me")
      .set("Authorization", `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.code).toBeTruthy();
    // PayPal email should be masked
    expect(res.body.data.paypalEmail).toBeNull();
  });
});

describe("GET /api/affiliates/me/stats", () => {
  it("returns affiliate stats with zeroes for new affiliate", async () => {
    const res = await request(app)
      .get("/api/affiliates/me/stats")
      .set("Authorization", `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.totalClicks).toBe(0);
    expect(res.body.data.totalConversions).toBe(0);
    expect(res.body.data.conversionRate).toBe(0);
  });
});
