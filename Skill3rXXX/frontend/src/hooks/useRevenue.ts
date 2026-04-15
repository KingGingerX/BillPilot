/**
 * Revenue data hooks — powers the dashboard charts and stat cards.
 */
import { useQuery } from "@tanstack/react-query";
import { analyticsApi, subscriptionsApi, productsApi } from "../api/client";

export function useRevenueSummary() {
  return useQuery({
    queryKey: ["analytics", "revenue"],
    queryFn: () => analyticsApi.revenue().then((r) => r.data.data),
    refetchInterval: 60_000, // Refresh every minute
  });
}

export function useRevenueSnapshots(days = 30) {
  return useQuery({
    queryKey: ["analytics", "snapshots", days],
    queryFn: () => analyticsApi.snapshots(days).then((r) => r.data.data),
  });
}

export function useSubscriptionRevenue() {
  return useQuery({
    queryKey: ["subscriptions", "revenue"],
    queryFn: () => subscriptionsApi.revenue().then((r) => r.data.data),
  });
}

export function useTopProducts() {
  return useQuery({
    queryKey: ["analytics", "top-products"],
    queryFn: () => analyticsApi.topProducts(5).then((r) => r.data.data),
  });
}

export function useMySubscription() {
  return useQuery({
    queryKey: ["subscription", "me"],
    queryFn: () => subscriptionsApi.me().then((r) => r.data.data),
  });
}

export function useSubscriptionPlans() {
  return useQuery({
    queryKey: ["subscription", "plans"],
    queryFn: () => subscriptionsApi.plans().then((r) => r.data.data),
    staleTime: 60 * 60 * 1000, // Plans rarely change
  });
}

/** Format cents → "$1,234.56" */
export function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}
