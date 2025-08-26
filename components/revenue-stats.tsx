// components/revenue-stats.tsx
"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRupiah } from "@/lib/currency";
import { TrendingUp, TrendingDown, DollarSign, CreditCard } from "lucide-react";
import { useLanguage } from "@/components/language-provider";

/** ===== Types ===== */
interface Transaction {
  id: string;
  date: string;
  item_purchased: string;
  customer_name?: string;
  store_name?: string;
  payment_method?: string;
  purchase_price?: number;
  selling_price: number;
  revenue?: number;
  notes?: string;
  month: number;
  year: number;
  created_at: string;
  updated_at: string;
}

export type RevenueApiData = {
  rows?: Array<{
    date: string;
    total_revenue: number | null;
    bca: number | null;
    dana: number | null;
    spay: number | null;
    qris: number | null;
    average_revenue: number | null;
  }>;
  totals: {
    totalRevenue: number;
    thisMonthRevenue: number;
    prevMonthRevenue: number;
    yesterdayRevenueThisMonth?: number;
  };
  averages?: {
    thisMonthAverageRevenue: number;
    prevMonthAverageRevenue: number;
  };
  byMethodAllTime?: { BCA: number; DANA: number; SPAY: number; QRIS: number };
  byMethodThisMonth?: { BCA: number; DANA: number; SPAY: number; QRIS: number };
  yesterdayByMethod?: { BCA: number; DANA: number; SPAY: number; QRIS: number };
  month?: number;
  year?: number;
};

interface RevenueStatsProps {
  transactions?: Transaction[];
  metrics?: RevenueApiData;
  isLoading?: boolean;
}

/** ===== Helper global: YMD “kemarin” Asia/Jakarta ===== */
function yesterdayJakartaYMD() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const d = Number(parts.find((p) => p.type === "day")?.value);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${mm}-${dd}`;
}

/** ===== Card metode ===== */
type MethodCardProps = {
  title: "BCA" | "DANA" | "SPAY" | "QRIS";
  amount?: number;
};
function MethodCard({ title, amount = 0 }: MethodCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <CreditCard className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-xl font-semibold">{formatRupiah(amount)}</div>
        <p className="text-xs text-muted-foreground">This month</p>
      </CardContent>
    </Card>
  );
}
export const BcaCard = ({ amount = 0 }: { amount?: number }) => (
  <MethodCard title="BCA" amount={amount} />
);
export const DanaCard = ({ amount = 0 }: { amount?: number }) => (
  <MethodCard title="DANA" amount={amount} />
);
export const SpayCard = ({ amount = 0 }: { amount?: number }) => (
  <MethodCard title="SPAY" amount={amount} />
);
export const QrisCard = ({ amount = 0 }: { amount?: number }) => (
  <MethodCard title="QRIS" amount={amount} />
);

/** ===== Komponen utama ===== */
export function RevenueStats({
  transactions = [],
  metrics,
  isLoading = false,
}: RevenueStatsProps) {
  const { t } = useLanguage();

  const StatCardSkeleton = () => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-4 rounded-full" />
      </CardHeader>
      <CardContent className="space-y-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-3 w-24" />
      </CardContent>
    </Card>
  );

  const getTxRevenue = (t: Transaction) =>
    Number(
      t.revenue ?? Number(t.selling_price ?? 0) - Number(t.purchase_price ?? 0)
    ) || 0;

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const currentMonthTransactions = transactions.filter((t) => {
    const d = new Date(t.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;

  const prevMonthTransactions = transactions.filter((t) => {
    const d = new Date(t.date);
    return d.getMonth() === prevMonth && d.getFullYear() === prevYear;
  });

  // ---- Totals (server-first, fallback client) ----
  const totalRevenue =
    metrics?.totals?.totalRevenue ??
    transactions.reduce((sum, t) => sum + getTxRevenue(t), 0);

  const thisMonthRevenue =
    metrics?.totals?.thisMonthRevenue ??
    currentMonthTransactions.reduce((sum, t) => sum + getTxRevenue(t), 0);

  const prevMonthRevenue =
    metrics?.totals?.prevMonthRevenue ??
    prevMonthTransactions.reduce((sum, t) => sum + getTxRevenue(t), 0);

  const growth =
    prevMonthRevenue > 0
      ? ((thisMonthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100
      : 0;
  const isPositiveGrowth = growth >= 0;

  const totalTx = transactions.length;

  // ---- Yesterday Revenue (This Month) ----
  const yesterdayRevenue = useMemo(() => {
    // 1) gunakan nilai backend kalau ada
    if (typeof metrics?.totals?.yesterdayRevenueThisMonth === "number") {
      return metrics.totals.yesterdayRevenueThisMonth;
    }
    // 2) fallback dari rows (jika dikirim)
    const rows: any[] = (metrics as any)?.rows ?? [];
    const ymd = yesterdayJakartaYMD();
    if (rows.length) {
      return rows
        .filter((r) => r?.date === ymd)
        .reduce(
          (sum, r) =>
            sum +
            (Number(r?.total_revenue) ||
              Number(r?.bca || 0) +
                Number(r?.dana || 0) +
                Number(r?.spay || 0) +
                Number(r?.qris || 0)),
          0
        );
    }
    // 3) fallback terakhir dari daftar transaksi (jika ada)
    return transactions
      .filter((t) => String(t.date).slice(0, 10) === ymd)
      .reduce((sum, t) => sum + getTxRevenue(t), 0);
  }, [metrics, transactions]);

  // ---- Per metode (This Month) ----
  const tm = metrics?.byMethodThisMonth;
  let thisMonthBCA = tm?.BCA ?? 0;
  let thisMonthDANA = tm?.DANA ?? 0;
  let thisMonthSPAY = tm?.SPAY ?? 0;
  let thisMonthQRIS = tm?.QRIS ?? 0;

  if (!tm) {
    const acc = { BCA: 0, DANA: 0, SPAY: 0, QRIS: 0 } as Record<
      "BCA" | "DANA" | "SPAY" | "QRIS",
      number
    >;
    for (const tx of currentMonthTransactions) {
      const method = (tx.payment_method || "").toUpperCase();
      const r = getTxRevenue(tx);
      if (method === "BCA") acc.BCA += r;
      else if (method === "DANA") acc.DANA += r;
      else if (method === "QRIS") acc.QRIS += r;
      else if (method === "SPAY" || method === "SHOPEEPAY") acc.SPAY += r;
    }
    thisMonthBCA = acc.BCA;
    thisMonthDANA = acc.DANA;
    thisMonthSPAY = acc.SPAY;
    thisMonthQRIS = acc.QRIS;
  }

  return (
    <div className="grid gap-4">
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" aria-busy>
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      ) : (
        <>
          {/* Ringkasan utama */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Total Revenue */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t("totalRevenue") ?? "Total Revenue"}
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatRupiah(totalRevenue)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("allTimeRevenue") ?? "All time"}
                </p>
              </CardContent>
            </Card>

            {/* This Month Revenue */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t("thisMonth") ?? "This Month"}
                </CardTitle>
                {isPositiveGrowth ? (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                )}
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatRupiah(thisMonthRevenue)}
                </div>
                <p
                  className={`text-xs ${
                    isPositiveGrowth ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {(t(isPositiveGrowth ? "positiveGrowth" : "negativeGrowth", {
                    percent: Math.abs(growth).toFixed(1),
                  }) as string) || `${Math.abs(growth).toFixed(1)}%`}
                </p>
              </CardContent>
            </Card>

            {/* Transactions count */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t("transactions") ?? "Transactions"}
                </CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {totalTx > 0 ? totalTx : "-"}
                </div>
                <p className="text-xs text-muted-foreground">
                  {totalTx > 0
                    ? `${currentMonthTransactions.length} ${
                        (t("thisMonth") as string) || "this month"
                      }`
                    : t("allTimeRevenue") ?? "All time"}
                </p>
              </CardContent>
            </Card>

            {/* Yesterday Revenue */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Yesterday Revenue
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatRupiah(yesterdayRevenue)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Pendapatan hari kemarin (bulan ini)
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Per metode (This Month) */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <BcaCard amount={thisMonthBCA} />
            <DanaCard amount={thisMonthDANA} />
            <SpayCard amount={thisMonthSPAY} />
            <QrisCard amount={thisMonthQRIS} />
          </div>
        </>
      )}
    </div>
  );
}
