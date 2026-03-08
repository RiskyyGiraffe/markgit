import {
  getEarningsSummary,
  getProviderProfile,
  getStripeStatus,
  listMyProducts,
  listPayouts,
  listProviderImports,
} from "@/actions/provider";
import { ProviderOnboardingWizard } from "@/components/provider-onboarding-wizard";

export default async function ProviderPage() {
  try {
    const provider = await getProviderProfile();
    const [stripeStatus, earnings, payoutHistory, products, imports] = await Promise.all([
      getStripeStatus(),
      getEarningsSummary(),
      listPayouts(),
      listMyProducts(),
      listProviderImports(),
    ]);

    return (
      <ProviderOnboardingWizard
        provider={provider}
        stripeStatus={stripeStatus}
        latestImportRun={imports.results[0] ?? null}
        earnings={earnings}
        payoutHistory={payoutHistory.results}
        products={products.results}
      />
    );
  } catch {
    return (
      <ProviderOnboardingWizard
        provider={null}
        stripeStatus={null}
        latestImportRun={null}
        earnings={null}
        payoutHistory={[]}
        products={[]}
      />
    );
  }
}
