/**
 * Halaman Kredit Exum — saldo kredit dan riwayat pembelian
 */

import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { getMyPlan, getMyPayments, type PaymentRecord } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, CreditCard, Zap, ShoppingBag, RefreshCw } from "lucide-react";
import { SCALEV_CHECKOUT_URL } from "@/lib/api";

function formatIDR(amount: number): string {
  if (amount === 0) return "Rp 0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function CreditBalanceCard({ exumCredits, freeExumUsed, freeExumRemaining, canGenerate }: {
  exumCredits: number;
  freeExumUsed: boolean;
  freeExumRemaining: number;
  canGenerate: boolean;
}) {
  return (
    <Card className={canGenerate ? "border-green-200 bg-green-50/40" : "border-amber-200 bg-amber-50/40"}>
      <CardContent className="pt-6 pb-5">
        <div className="flex items-center gap-4">
          <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${canGenerate ? "bg-green-100" : "bg-amber-100"}`}>
            <Zap className={`h-6 w-6 ${canGenerate ? "text-green-600" : "text-amber-600"}`} />
          </div>
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">Saldo Kredit Exum</p>
            <div className="flex items-baseline gap-2 mt-0.5">
              {!freeExumUsed ? (
                <>
                  <span className="text-3xl font-bold text-foreground">1</span>
                  <span className="text-sm text-muted-foreground">kredit gratis tersisa</span>
                </>
              ) : (
                <>
                  <span className="text-3xl font-bold text-foreground">{exumCredits}</span>
                  <span className="text-sm text-muted-foreground">
                    {exumCredits === 1 ? "kredit" : "kredit"}
                  </span>
                </>
              )}
            </div>
          </div>
          <Badge variant={canGenerate ? "default" : "destructive"} className={canGenerate ? "bg-green-600 hover:bg-green-700" : ""}>
            {canGenerate ? "Aktif" : "Habis"}
          </Badge>
        </div>

        {!freeExumUsed && (
          <p className="text-xs text-green-700 bg-green-100 rounded-lg px-3 py-2 mt-4">
            Anda masih memiliki 1 Exum gratis. Kredit berbayar Anda aktif setelah kredit gratis digunakan.
          </p>
        )}

        {freeExumUsed && exumCredits === 0 && (
          <p className="text-xs text-amber-700 bg-amber-100 rounded-lg px-3 py-2 mt-4">
            Kredit Exum Anda habis. Beli kredit tambahan untuk terus menggunakan layanan ini.
          </p>
        )}

        {SCALEV_CHECKOUT_URL && (
          <a
            href={SCALEV_CHECKOUT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground rounded-xl px-4 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <ShoppingBag className="h-4 w-4" />
            Beli Kredit Exum
          </a>
        )}
      </CardContent>
    </Card>
  );
}

function PaymentRow({ payment }: { payment: PaymentRecord }) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-border last:border-0">
      <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
        <CreditCard className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">
          {payment.creditsGranted} kredit Exum
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {formatDate(payment.createdAt)}
          {payment.customerEmail && (
            <span className="ml-2 opacity-70">· {payment.customerEmail}</span>
          )}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-semibold text-foreground">{formatIDR(payment.amount)}</p>
        <Badge variant="outline" className="text-[10px] mt-0.5 border-green-300 text-green-700">
          {payment.status}
        </Badge>
      </div>
    </div>
  );
}

export default function KreditsPage() {
  const { data: plan, isLoading: planLoading, refetch: refetchPlan } = useQuery({
    queryKey: ["my-plan"],
    queryFn: getMyPlan,
    staleTime: 30 * 1000,
  });

  const { data: payments = [], isLoading: paymentsLoading, refetch: refetchPayments } = useQuery({
    queryKey: ["my-payments"],
    queryFn: getMyPayments,
    staleTime: 30 * 1000,
  });

  const isLoading = planLoading || paymentsLoading;

  function handleRefresh() {
    refetchPlan();
    refetchPayments();
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/sessions">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Kredit Exum</h1>
            <p className="text-sm text-muted-foreground">Saldo dan riwayat pembelian Anda</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* Balance card */}
        {planLoading ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground text-sm">
              Memuat saldo…
            </CardContent>
          </Card>
        ) : plan ? (
          <CreditBalanceCard {...plan} />
        ) : null}

        {/* Purchase history */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Riwayat Pembelian</CardTitle>
            <CardDescription>
              Semua transaksi kredit Exum yang berhasil diproses
            </CardDescription>
          </CardHeader>
          <CardContent>
            {paymentsLoading ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Memuat riwayat…</p>
            ) : payments.length === 0 ? (
              <div className="py-10 text-center">
                <ShoppingBag className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Belum ada pembelian kredit.</p>
                {SCALEV_CHECKOUT_URL && (
                  <a
                    href={SCALEV_CHECKOUT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-medium"
                  >
                    <ShoppingBag className="h-3.5 w-3.5" /> Beli kredit pertama Anda
                  </a>
                )}
              </div>
            ) : (
              <div>
                {payments.map((p) => (
                  <PaymentRow key={p.id} payment={p} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Help text */}
        <p className="text-xs text-muted-foreground text-center">
          Kredit dikirimkan otomatis setelah pembayaran dikonfirmasi. Jika kredit belum muncul dalam beberapa menit, coba refresh halaman ini.
        </p>
      </div>
    </div>
  );
}
