'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import useSWR from 'swr';
import { creditsApi } from '@/lib/api/credits';
import { useCreditBalance, refreshCreditBalance } from '@/lib/hooks/useCredits';
import { Button } from '@/components/ui/Button';
import { ApiError } from '@/lib/api/client';
import type { CreditPackage } from '@/lib/types';

const CURRENCY_SYMBOL: Record<string, string> = { ILS: '₪', USD: '$', EUR: '€' };

function PackageCard({ pkg, onBuy }: { pkg: CreditPackage; onBuy: (pkg: CreditPackage) => void }) {
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const symbol = CURRENCY_SYMBOL[pkg.currency] ?? pkg.currency;
  const perCredit = (pkg.price / pkg.credits).toFixed(2);

  return (
    <div
      className="relative bg-card rounded-2xl p-6 flex flex-col items-center text-center"
      style={{ border: pkg.featured ? '2px solid var(--color-gold-300)' : '1px solid var(--color-border)' }}
    >
      {pkg.featured && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gold-300 text-[#1a1500] text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap shadow-sm">
          Best value
        </span>
      )}
      <p className="text-[30px] font-bold text-text-primary leading-none mt-2">{pkg.credits}</p>
      <p className="text-xs text-text-muted mb-4">credits</p>
      <p className="text-[22px] font-bold text-text-primary mb-1">{symbol}{pkg.price}</p>
      <div className="relative flex items-center gap-1 mb-5">
        <p className="text-xs text-text-muted">{symbol}{perCredit}/credit</p>
        <div className="relative">
          <button
            type="button"
            onMouseEnter={() => setTooltipVisible(true)}
            onMouseLeave={() => setTooltipVisible(false)}
            onFocus={() => setTooltipVisible(true)}
            onBlur={() => setTooltipVisible(false)}
            className="w-3.5 h-3.5 rounded-full border border-border-strong text-text-muted flex items-center justify-center text-[9px]"
            aria-label={`How the ${pkg.name} price per credit is calculated`}
          >
            ?
          </button>
          {tooltipVisible && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 w-44 text-[11px] leading-snug px-2.5 py-2 rounded-lg bg-card-hover border border-border-strong text-text-secondary pointer-events-none">
              {symbol}{pkg.price} ÷ {pkg.credits} credits = {symbol}{perCredit} per credit
            </div>
          )}
        </div>
      </div>
      <Button variant="primary" size="lg" className="w-full" onClick={() => onBuy(pkg)}>
        Buy {pkg.name}
      </Button>
    </div>
  );
}

export default function CreditsPage() {
  const router = useRouter();
  const { balance, mutate: mutateBalance } = useCreditBalance();
  const { data: packages } = useSWR('credits/packages', () => creditsApi.getPackages().then((r) => r.data));

  const [checkoutPkg, setCheckoutPkg] = useState<CreditPackage | null>(null);
  const [purchasing, setPurchasing] = useState(false);

  const startCheckout = (pkg: CreditPackage) => {
    setCheckoutPkg(pkg);
    setPurchasing(true);
    // Stubbed payment redirect — no processor integrated yet.
    setTimeout(async () => {
      try {
        await creditsApi.purchase(pkg.id);
        await Promise.all([mutateBalance(), refreshCreditBalance()]);
        toast.success(`${pkg.credits} credits added!`);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Purchase failed');
      } finally {
        setPurchasing(false);
        setCheckoutPkg(null);
      }
    }, 1600);
  };

  const cancelCheckout = () => {
    setPurchasing(false);
    setCheckoutPkg(null);
  };

  if (checkoutPkg) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="bg-card border border-border rounded-2xl p-8">
          <div className="w-10 h-10 mx-auto mb-4 border-2 border-border-strong border-t-gold-300 rounded-full animate-spin" />
          <p className="text-sm font-semibold text-text-primary mb-1">Redirecting to secure checkout…</p>
          <p className="text-xs text-text-muted mb-6">{checkoutPkg.name} · {checkoutPkg.credits} credits</p>
          <Button variant="ghost" size="sm" onClick={cancelCheckout} disabled={!purchasing && !checkoutPkg}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <button
        type="button"
        onClick={() => (window.history.length > 1 ? router.back() : router.push('/feed'))}
        className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary mb-6 transition-colors"
      >
        ← Back
      </button>

      <h1 className="text-[26px] font-bold text-text-primary mb-1">Buy credits</h1>
      <p className="text-sm text-text-secondary mb-8">
        1 credit sends a C.V. or posts a job. Top up whenever your free monthly credit runs out.
      </p>

      <div className="grid sm:grid-cols-3 gap-5 mb-8">
        {(packages ?? []).map((pkg) => (
          <PackageCard key={pkg.id} pkg={pkg} onBuy={startCheckout} />
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        {balance ? (
          <>
            <p className="text-base font-bold text-text-primary mb-1">
              {balance.total} credit{balance.total === 1 ? '' : 's'} available
            </p>
            <p className="text-xs text-text-muted mb-3">
              {balance.freeAvailable} of {balance.freeTotal} free · {balance.purchased} purchased
            </p>
          </>
        ) : (
          <p className="text-sm text-text-secondary mb-3">Loading balance…</p>
        )}
        <p className="text-xs text-text-muted">
          Purchased credits are valid for 12 months. Your free credit still resets monthly either way.
        </p>
      </div>
    </div>
  );
}
