import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-05-27.dahlia" as const,
});

export function getBaseUrl() {
  return process.env.NEXTAUTH_URL ?? "http://localhost:3000";
}
