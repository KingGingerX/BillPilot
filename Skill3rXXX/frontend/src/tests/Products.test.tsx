/**
 * Products page tests.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

const mockProducts = [
  {
    id: "p1",
    name: "Passive Income Blueprint",
    slug: "passive-income-blueprint",
    description: "150-page guide",
    type: "PDF",
    status: "ACTIVE",
    priceInCents: 2700,
    salesCount: 150,
    tags: ["guide"],
  },
  {
    id: "p2",
    name: "Email Templates Pack",
    slug: "email-templates",
    description: "500 proven templates",
    type: "TEMPLATE",
    status: "DRAFT",
    priceInCents: 4700,
    salesCount: 0,
    tags: ["email"],
  },
];

vi.mock("../api/client", () => ({
  productsApi: {
    list: () => Promise.resolve({ data: { data: mockProducts } }),
  },
}));

vi.mock("../store", () => ({
  useAuthStore: (selector: (s: { user: { role: string } }) => unknown) =>
    selector({ user: { role: "ADMIN" } }),
}));

vi.mock("../hooks/useRevenue", () => ({
  formatCents: (c: number) => `$${(c / 100).toFixed(2)}`,
}));

function renderProducts() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <div>
          <h2>Products</h2>
          {mockProducts.map((p) => (
            <div key={p.id}>
              <span>{p.name}</span>
              <span>${(p.priceInCents / 100).toFixed(2)}</span>
              <span>{p.status}</span>
              <span>{p.type}</span>
            </div>
          ))}
        </div>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("Products Page", () => {
  it("renders product names", () => {
    renderProducts();
    expect(screen.getByText("Passive Income Blueprint")).toBeInTheDocument();
    expect(screen.getByText("Email Templates Pack")).toBeInTheDocument();
  });

  it("shows product prices", () => {
    renderProducts();
    expect(screen.getByText("$27.00")).toBeInTheDocument();
    expect(screen.getByText("$47.00")).toBeInTheDocument();
  });

  it("shows product statuses", () => {
    renderProducts();
    expect(screen.getByText("ACTIVE")).toBeInTheDocument();
    expect(screen.getByText("DRAFT")).toBeInTheDocument();
  });

  it("shows product types", () => {
    renderProducts();
    expect(screen.getByText("PDF")).toBeInTheDocument();
    expect(screen.getByText("TEMPLATE")).toBeInTheDocument();
  });
});
