/**
 * Products page — lists all products, allows admin CRUD.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import toast from "react-hot-toast";
import { productsApi } from "../api/client";
import { useAuthStore } from "../store";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import { formatCents } from "../hooks/useRevenue";

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  type: string;
  status: string;
  priceInCents: number;
  salesCount: number;
  tags: string[];
}

const TYPE_BADGE: Record<string, string> = {
  PDF:      "badge-blue",
  COURSE:   "badge-purple",
  TEMPLATE: "badge-green",
  SOFTWARE: "badge-orange",
  BUNDLE:   "badge-yellow",
};

const STATUS_BADGE: Record<string, string> = {
  ACTIVE:   "badge-green",
  DRAFT:    "badge-gray",
  ARCHIVED: "badge-red",
};

export default function ProductsPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "ADMIN";
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: () => productsApi.list().then((r) => r.data.data as Product[]),
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => productsApi.update(id, { status: "ACTIVE" }),
    onSuccess: () => { toast.success("Product activated"); qc.invalidateQueries({ queryKey: ["products"] }); },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => productsApi.delete(id),
    onSuccess: () => { toast.success("Product archived"); qc.invalidateQueries({ queryKey: ["products"] }); },
  });

  if (isLoading) return <LoadingSpinner size="lg" />;

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Products</h2>
          <p className="text-gray-400 mt-1">Digital products driving one-time revenue</p>
        </div>
        {isAdmin && (
          <button className="btn-primary" onClick={() => toast("Product creation form coming soon")}>
            + New Product
          </button>
        )}
      </div>

      {/* Product grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {data?.map((product) => (
          <div key={product.id} className="card hover:border-gray-700 transition-colors group">
            <div className="flex items-start justify-between mb-3">
              <div className="flex gap-2 flex-wrap">
                <span className={TYPE_BADGE[product.type] ?? "badge-gray"}>{product.type}</span>
                <span className={STATUS_BADGE[product.status] ?? "badge-gray"}>{product.status}</span>
              </div>
              <span className="text-brand-400 font-bold text-lg">
                {formatCents(product.priceInCents)}
              </span>
            </div>

            <h3 className="font-semibold text-white mb-1 group-hover:text-brand-400 transition-colors">
              {product.name}
            </h3>
            <p className="text-sm text-gray-400 line-clamp-2 mb-4">{product.description}</p>

            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>🛒 {product.salesCount} sold</span>
              <div className="flex gap-1 flex-wrap">
                {product.tags.slice(0, 2).map((tag) => (
                  <span key={tag} className="badge badge-gray">{tag}</span>
                ))}
              </div>
            </div>

            {isAdmin && (
              <div className="flex gap-2 mt-4 pt-4 border-t border-gray-800">
                {product.status !== "ACTIVE" && (
                  <button
                    className="btn-primary text-xs py-1.5 px-3 flex-1"
                    onClick={() => activateMutation.mutate(product.id)}
                    disabled={activateMutation.isPending}
                  >
                    Activate
                  </button>
                )}
                <button
                  className="btn-secondary text-xs py-1.5 px-3 flex-1"
                  onClick={() => archiveMutation.mutate(product.id)}
                  disabled={archiveMutation.isPending}
                >
                  Archive
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {data?.length === 0 && (
        <div className="card text-center py-12">
          <p className="text-4xl mb-3">📦</p>
          <p className="text-gray-400">No products yet. Create your first digital product to start earning.</p>
        </div>
      )}
    </div>
  );
}
