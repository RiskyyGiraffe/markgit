"use client";

import { useState } from "react";
import { connectStripeAccount } from "@/actions/provider";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export function StripeConnectButton() {
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    setLoading(true);
    try {
      const refreshUrl = `${window.location.origin}/provider`;
      const returnUrl = `${window.location.origin}/provider?onboarding=complete`;
      const { url } = await connectStripeAccount(refreshUrl, returnUrl);
      window.location.href = url;
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to start Stripe onboarding"
      );
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleConnect} disabled={loading}>
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      Connect with Stripe
    </Button>
  );
}
