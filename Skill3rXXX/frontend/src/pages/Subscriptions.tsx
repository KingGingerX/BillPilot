/**
 * Subscriptions page — shows current plan and available plans with upgrade/downgrade.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { loadStripe } from "@stripe/stripe-js";
import toast from "react-hot-toast";
import { subscriptionsApi } from "../api/client";
import { useMySubscription, useSubscriptionPlans, formatCents } from "../hooks/useRevenue";
import LoadingSpinner from "../components/ui/LoadingSpinner";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PK ?? "");

interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string;
  priceInCents: number;
  intervalDays: number;
  features: string[];
}

export default function SubscriptionsPage() {
  const qc = useQueryClient();
  const { data: currentSub, isLoading: loadingSub } = useMySubscription();
  const { data: plans, isLoading: loadingPlans } = useSubscriptionPlans();

  const checkoutMutation = useMutation({
    mutationFn: async (planId: string) => {
      const res = await subscriptionsApi.checkout({
        planId,
        successUrl: `${window.location.origin}/dashboard?subscribed=true`,
        cancelUrl:  `${window.location.origin}/subscriptions`,
      });
      const stripe = await stripePromise;
      if (stripe && res.data.data.sessionId) {
        await stripe.redirectToCheckout({ sessionId: res.data.data.sessionId });
      }
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast.error(err.response?.data?.message ?? "Checkout failed"),
  });

  const cancelMutation = useMutation({
    mutationFn: () => subscriptionsApi.cancel(),
    onSuccess: () => {
      toast.success("Subscription will cancel at period end");
      qc.invalidateQueries({ queryKey: ["subscription"] });
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: () => subscriptionsApi.reactivate(),
    onSuccess: () => {
      toast.success("Subscription reactivated!");
      qc.invalidateQueries({ queryKey: ["subscription"] });
    },
  });

  if (loadingSub || loadingPlans) return <LoadingSpinner size="lg" />;

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h2 className="text-2xl font-bold text-white">Subscriptions</h2>
        <p className="text-gray-400 mt-1">Unlock recurring revenue tools and advanced features</p>
      </div>

      {/* Current subscription */}
      {currentSub && (
        <div className="card border-brand-500/40 bg-brand-500/5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-white">Current Plan: {currentSub.plan.name}</h3>
            <span className={`badge ${
              currentSub.status === "ACTIVE" ? "badge-green" :
              currentSub.status === "TRIALING" ? "badge-blue" :
              currentSub.status === "CANCELED" ? "badge-red" : "badge-yellow"
            }`}>
              {currentSub.status}
            </span>
          </div>
          <p className="text-brand-400 text-xl font-bold mb-1">
            {formatCents(currentSub.plan.priceInCents)} / {currentSub.plan.intervalDays === 365 ? "year" : "month"}
          </p>
          <p className="text-xs text-gray-400 mb-4">
            Renews {new Date(currentSub.currentPeriodEnd).toLocaleDateString()}
            {currentSub.cancelAtPeriodEnd && (
              <span className="text-red-400 ml-2">· Cancels at period end</span>
            )}
          </p>
          <div className="flex gap-3">
            {currentSub.cancelAtPeriodEnd ? (
              <button className="btn-primary text-sm" onClick={() => reactivateMutation.mutate()}>
                Reactivate
              </button>
            ) : (
              <button
                className="btn-danger text-sm"
                onClick={() => {
                  if (confirm("Are you sure you want to cancel? You'll keep access until the end of the billing period.")) {
                    cancelMutation.mutate();
                  }
                }}
              >
                Cancel Subscription
              </button>
            )}
          </div>
        </div>
      )}

      {/* Plans grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {plans?.map((plan: Plan, i: number) => {
          const isCurrent = currentSub?.planId === plan.id;
          const isPopular = plan.slug === "growth";

          return (
            <div
              key={plan.id}
              className={`card flex flex-col relative ${
                isPopular ? "border-brand-500 ring-1 ring-brand-500/30" : ""
              } ${isCurrent ? "opacity-75" : ""}`}
            >
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-brand-500 text-white text-xs font-bold px-3 py-0.5 rounded-full">
                    MOST POPULAR
                  </span>
                </div>
              )}

              <div className="mb-4">
                <h3 className="font-bold text-white text-lg">{plan.name}</h3>
                <p className="text-gray-400 text-sm mt-1">{plan.description}</p>
              </div>

              <div className="mb-4">
                <span className="text-3xl font-bold text-white">
                  {formatCents(plan.priceInCents)}
                </span>
                <span className="text-gray-400 text-sm ml-1">
                  / {plan.intervalDays === 365 ? "year" : "month"}
                </span>
              </div>

              <ul className="space-y-2 flex-1 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                    <span className="text-brand-400 mt-0.5 flex-shrink-0">✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              <button
                className={`w-full text-sm ${isPopular ? "btn-primary" : "btn-secondary"}`}
                disabled={isCurrent || checkoutMutation.isPending}
                onClick={() => checkoutMutation.mutate(plan.id)}
              >
                {isCurrent ? "Current Plan" : checkoutMutation.isPending ? "Loading..." : "Get Started"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
