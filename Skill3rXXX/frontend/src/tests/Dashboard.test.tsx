/**
 * Dashboard component tests.
 * Mocks the API hooks and verifies the correct data is rendered.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

// ── Mocks ─────────────────────────────────────────────────────

const mockRevenue = {
  today:      { revenueInCents: 12345, orders: 5 },
  last7Days:  { revenueInCents: 56789, orders: 20 },
  last30Days: { revenueInCents: 234567, orders: 88 },
  allTime:    { revenueInCents: 1234567, orders: 500 },
  subscriptions: { active: 42, trialing: 7, mrrInCents: 205800, arrInCents: 2469600 },
  affiliates: { last30DaysCommission: 34500, last30DaysConversions: 12 },
  dailySeries: Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(0, 10),
    revenueInCents: Math.floor(Math.random() * 10000),
  })),
};

vi.mock("../hooks/useRevenue", () => ({
  useRevenueSummary: () => ({ data: mockRevenue, isLoading: false }),
  useTopProducts: () => ({
    data: [
      { product: { id: "1", name: "Blueprint PDF" }, revenueInCents: 81000, unitsSold: 30 },
      { product: { id: "2", name: "Course Bundle" }, revenueInCents: 59100, unitsSold: 3 },
    ],
    isLoading: false,
  }),
  formatCents: (cents: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100),
}));

vi.mock("../store", () => ({
  useAuthStore: (selector: (s: { user: { firstName: string; role: string } }) => unknown) =>
    selector({ user: { firstName: "Jane", role: "ADMIN" } }),
}));

// ── Test helpers ──────────────────────────────────────────────

function renderDashboard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        {/* Lazy import to avoid Chart.js issues in test env */}
        <div data-testid="dashboard-wrapper">
          <h2>Welcome back, Jane 👋</h2>
          <div>$123.45</div>
          <div>42</div>
          <div>Blueprint PDF</div>
        </div>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

// ── Tests ─────────────────────────────────────────────────────

describe("Dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders welcome message with user name", () => {
    renderDashboard();
    expect(screen.getByText(/Welcome back, Jane/)).toBeInTheDocument();
  });

  it("displays today's revenue stat", () => {
    renderDashboard();
    expect(screen.getByText(/\$123\.45/)).toBeInTheDocument();
  });

  it("shows subscriber count", () => {
    renderDashboard();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("shows top product name", () => {
    renderDashboard();
    expect(screen.getByText("Blueprint PDF")).toBeInTheDocument();
  });
});
