/**
 * Public storefront — shows all active products for sale.
 * No auth required. Redirects to login for checkout.
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { productsApi } from "../api/client";
import { formatCents } from "../hooks/useRevenue";
import LoadingSpinner from "../components/ui/LoadingSpinner";

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  type: string;
  priceInCents: number;
  salesCount: number;
  coverImageUrl?: string;
  tags: string[];
}

export default function StorePage() {
  const { data: products, isLoading } = useQuery({
    queryKey: ["store-products"],
    queryFn: () => productsApi.list("ACTIVE").then((r) => r.data.data as Product[]),
  });

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Hero */}
      <section className="bg-gradient-to-br from-gray-900 to-gray-950 border-b border-gray-800 py-20 px-4 text-center">
        <div className="max-w-3xl mx-auto">
          <span className="text-5xl mb-4 block">💰</span>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Start Earning Passive Income Today
          </h1>
          <p className="text-xl text-gray-400 mb-8">
            Proven guides, courses, and templates to build multiple income streams from scratch.
          </p>
          <div className="flex items-center justify-center gap-6 text-sm text-gray-500">
            <span>✅ Instant download</span>
            <span>✅ 30-day guarantee</span>
            <span>✅ Secure checkout</span>
          </div>
        </div>
      </section>

      {/* Products */}
      <main className="max-w-7xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold text-white mb-8">Featured Products</h2>

        {isLoading ? (
          <LoadingSpinner size="lg" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products?.map((product) => (
              <div
                key={product.id}
                className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden hover:border-brand-500/50 transition-colors group"
              >
                {/* Cover image or gradient placeholder */}
                {product.coverImageUrl ? (
                  <img
                    src={product.coverImageUrl}
                    alt={product.name}
                    className="w-full h-40 object-cover"
                  />
                ) : (
                  <div className="w-full h-40 bg-gradient-to-br from-brand-500/20 to-blue-500/20 flex items-center justify-center">
                    <span className="text-4xl">
                      {product.type === "PDF" ? "📄" :
                       product.type === "COURSE" ? "🎓" :
                       product.type === "TEMPLATE" ? "📋" : "📦"}
                    </span>
                  </div>
                )}

                <div className="p-6">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-bold text-white group-hover:text-brand-400 transition-colors">
                      {product.name}
                    </h3>
                    <span className="text-brand-400 font-bold text-lg whitespace-nowrap ml-2">
                      {formatCents(product.priceInCents)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 mb-4 line-clamp-2">{product.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">⭐ {product.salesCount}+ sold</span>
                    <Link
                      to="/login"
                      className="btn-primary text-sm py-2 px-4"
                    >
                      Buy Now →
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Trust footer */}
      <footer className="border-t border-gray-800 py-8 text-center text-sm text-gray-500">
        <p>© {new Date().getFullYear()} Passive Income Master System · Secure payments via Stripe</p>
        <div className="flex justify-center gap-6 mt-3">
          <Link to="/login" className="hover:text-gray-300">Dashboard</Link>
          <Link to="/register" className="hover:text-gray-300">Create Account</Link>
        </div>
      </footer>
    </div>
  );
}
