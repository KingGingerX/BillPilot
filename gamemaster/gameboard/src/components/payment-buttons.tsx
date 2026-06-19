"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export function JoinQuestButton({ questId, price, label }: { questId: string; price: string; label: string }) {
  const [loading, setLoading] = useState(false);

  async function handleJoin() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout/quest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error ?? "Payment failed. Try again.");
        setLoading(false);
      }
    } catch {
      alert("Network error. Try again.");
      setLoading(false);
    }
  }

  return (
    <Button
      onClick={handleJoin}
      disabled={loading}
      className="w-full bg-primary hover:bg-primary/90"
    >
      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      {loading ? "Redirecting to checkout…" : `Join Quest — ${price}`}
    </Button>
  );
}

export function PromoteQuestButton({
  questId,
  promotionLevel,
  label,
}: {
  questId: string;
  promotionLevel: "FEATURED" | "HIGHLIGHTED";
  label: string;
}) {
  const [loading, setLoading] = useState(false);

  async function handlePromote() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout/promotion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questId, promotionLevel }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error ?? "Failed. Try again.");
        setLoading(false);
      }
    } catch {
      alert("Network error. Try again.");
      setLoading(false);
    }
  }

  return (
    <Button
      onClick={handlePromote}
      disabled={loading}
      variant="outline"
      className="w-full text-sm"
    >
      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      {loading ? "Redirecting…" : label}
    </Button>
  );
}

export function SubscribeProButton() {
  const [loading, setLoading] = useState(false);

  async function handleSubscribe() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout/pro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error ?? "Failed. Try again.");
        setLoading(false);
      }
    } catch {
      alert("Network error. Try again.");
      setLoading(false);
    }
  }

  return (
    <Button
      onClick={handleSubscribe}
      disabled={loading}
      className="bg-primary px-8 text-lg hover:bg-primary/90"
    >
      {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
      {loading ? "Redirecting…" : "Upgrade to Pro — $19/mo"}
    </Button>
  );
}
