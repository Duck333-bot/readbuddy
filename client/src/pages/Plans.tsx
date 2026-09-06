import { useEffect } from "react";
import { ArrowLeft, Check, CreditCard, ExternalLink, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { PLANS } from "@shared/plans";

function allowanceLabel(value: number, unit: string) {
  return `${new Intl.NumberFormat().format(value)} ${unit}`;
}

function UsageRow({ label, used, limit }: { label: string; used: number; limit: number }) {
  const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return <div className="space-y-2">
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="font-medium text-[#3c3942]">{label}</span>
      <span className="tabular-nums text-[#7b7781]">{new Intl.NumberFormat().format(used)} / {new Intl.NumberFormat().format(limit)}</span>
    </div>
    <div className="h-2 overflow-hidden rounded-full bg-[#ece9f2]" aria-label={`${label}: ${percent}% used`}>
      <div className="h-full rounded-full bg-[#7157df] transition-[width] duration-300" style={{ width: `${percent}%` }} />
    </div>
  </div>;
}

export default function Plans() {
  const { isAuthenticated, loading } = useAuth({ redirectOnUnauthenticated: true });
  const utils = trpc.useUtils();
  const status = trpc.billing.status.useQuery(undefined, { enabled: isAuthenticated });
  const price = trpc.billing.price.useQuery();
  const checkout = trpc.billing.checkout.useMutation({
    onSuccess: ({ url }) => {
      window.open(url, "_blank", "noopener,noreferrer");
      toast.success("Stripe Checkout opened in a new tab.");
    },
    onError: error => toast.error(error.message),
  });
  const portal = trpc.billing.portal.useMutation({
    onSuccess: ({ url }) => {
      window.open(url, "_blank", "noopener,noreferrer");
      toast.success("Billing settings opened in a new tab.");
    },
    onError: error => toast.error(error.message),
  });
  const refresh = trpc.billing.refresh.useMutation({ onSuccess: () => utils.billing.status.invalidate() });

  useEffect(() => {
    const checkoutState = new URLSearchParams(window.location.search).get("checkout");
    if (checkoutState === "success" && isAuthenticated && !refresh.isPending) {
      void refresh.mutateAsync().then(() => toast.success("Your plan status has been refreshed."));
    }
  }, [isAuthenticated]);

  if (loading || !isAuthenticated) return <div className="min-h-screen bg-[#f8f7fb]" aria-label="Loading plans" />;

  const billing = status.data;
  const proPrice = price.data?.price;
  const priceLabel = proPrice ? new Intl.NumberFormat("en-US", { style: "currency", currency: proPrice.currency.toUpperCase() }).format(proPrice.amount / 100) : null;

  return <AppShell>
    <div className="min-h-[calc(100vh-4.5rem)] bg-[#f8f7fb] px-5 py-10 sm:px-8 sm:py-14">
      <div className="mx-auto max-w-5xl">
        <Link href="/materials" className="inline-flex items-center gap-2 text-sm font-semibold text-[#6e6974] no-underline hover:text-[#302d36]"><ArrowLeft className="h-4 w-4" />Back to workspace</Link>
        <div className="mt-7 max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[.14em] text-[#7665ec]">Plans & usage</p>
          <h1 className="mt-3 text-4xl font-bold tracking-[-.05em] text-[#29262f] sm:text-5xl">Learn without losing control of cost.</h1>
          <p className="mt-4 text-base leading-7 text-[#77727d]">Your private books and notes stay available even after an allowance is reached. Usage resets each UTC calendar month.</p>
        </div>

        <div className="mt-9 grid gap-5 lg:grid-cols-[1fr_1.15fr]">
          <section className="rounded-3xl border border-[#dfdce5] bg-white p-6 shadow-[0_12px_36px_rgba(45,39,59,.06)] sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-sm font-semibold text-[#89838f]">Current plan</p><h2 className="mt-1 text-3xl font-bold tracking-[-.04em] text-[#2e2a34]">{billing?.plan === "pro" ? "Pro" : "Free"}</h2></div>
              <span className="rounded-full bg-[#eeeafd] px-3 py-1.5 text-xs font-bold text-[#6650d4]">{billing?.period ?? "This month"}</span>
            </div>
            <div className="mt-7 space-y-5">
              <UsageRow label="Uploads" used={billing?.used.uploads ?? 0} limit={billing?.limits.uploads ?? PLANS.free.uploads} />
              <UsageRow label="AI explanations" used={billing?.used.aiCalls ?? 0} limit={billing?.limits.aiCalls ?? PLANS.free.aiCalls} />
              <UsageRow label="Source characters" used={billing?.used.sourceCharacters ?? 0} limit={billing?.limits.sourceCharacters ?? PLANS.free.sourceCharacters} />
            </div>
            {billing?.canManageBilling && <Button onClick={() => portal.mutate()} disabled={portal.isPending} variant="outline" className="mt-8 w-full rounded-xl border-[#d8d4df] bg-white"><CreditCard className="mr-2 h-4 w-4" />Manage billing<ExternalLink className="ml-2 h-3.5 w-3.5" /></Button>}
          </section>

          <section className="relative overflow-hidden rounded-3xl border border-[#5f4bc6] bg-[#2e2746] p-6 text-white shadow-[0_18px_48px_rgba(65,49,128,.18)] sm:p-8">
            <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full bg-[#9d82ff]/25 blur-3xl" />
            <div className="relative">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#d8ceff]"><Sparkles className="h-4 w-4" />ZhiyaAI Pro</div>
              <div className="mt-4 flex items-end gap-2"><span className="text-4xl font-bold tracking-[-.04em]">{priceLabel ?? "Pro"}</span>{priceLabel && <span className="pb-1 text-sm text-[#c8bfd9]">/ month</span>}</div>
              <p className="mt-4 max-w-lg text-sm leading-6 text-[#d5cedf]">For readers and students who use AI explanations, Book Brain, and grounded study tools throughout the month.</p>
              <ul className="mt-7 grid gap-3 text-sm text-[#f5f1ff] sm:grid-cols-2">
                <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#ad98ff]" />{allowanceLabel(PLANS.pro.uploads, "uploads")}</li>
                <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#ad98ff]" />{allowanceLabel(PLANS.pro.aiCalls, "AI explanations")}</li>
                <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#ad98ff]" />Private source storage</li>
                <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#ad98ff]" />Background Book Brain processing</li>
              </ul>
              {billing?.plan === "pro" ? <div className="mt-8 rounded-xl border border-white/15 bg-white/8 px-4 py-3 text-sm text-[#e8e2f0]">Your Pro access is active{billing.cancelAtPeriodEnd && billing.paidUntil ? ` until ${new Date(billing.paidUntil).toLocaleDateString()}` : "."}</div> : <Button onClick={() => checkout.mutate()} disabled={!price.data?.enabled || checkout.isPending} className="mt-8 w-full rounded-xl bg-[#8a6cf1] text-white shadow-[0_4px_0_#4d3b9a] hover:bg-[#9579f4] disabled:bg-[#625a72]">{price.data?.enabled ? "Start Pro with Stripe" : "Pro checkout is being configured"}</Button>}
            </div>
          </section>
        </div>
      </div>
    </div>
  </AppShell>;
}
