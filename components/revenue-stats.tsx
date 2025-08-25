"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRupiah } from "@/lib/currency";
import { TrendingUp, TrendingDown, DollarSign, CreditCard } from "lucide-react";
import { useLanguage } from "@/components/language-provider";

/** === Types dari data transaksi (untuk fallback perhitungan di client) === */
interface Transaction {
  id: string;
  date: string; // ISO-like "YYYY-MM-DD" atau valid Date string
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

/** === Bentuk respons dari /api/revenue (server metrics) === */
export type RevenueApiData = {
  totals: {
    totalRevenue: number;
    thisMonthRevenue: number;
    prevMonthRevenue: number;
  };
  averages?: {
    /** rata-rata pendapatan harian bulan ini (server) */
    thisMonthAverageRevenue: number;
    /** rata-rata pendapatan harian bulan lalu (server) */
    prevMonthAverageRevenue: number;
  };
  byMethodAllTime?: {
    BCA: number;
    DANA: number;
    SPAY: number;
    QRIS: number;
  };
  byMethodThisMonth?: {
    BCA: number;
    DANA: number;
    SPAY: number;
    QRIS: number;
  };
};

interface RevenueStatsProps {
  /** daftar transaksi (opsional; dipakai untuk fallback perhitungan) */
  transactions?: Transaction[];
  /** metrics dari /api/revenue */
  metrics?: RevenueApiData;
  /** tampilkan skeleton saat loading */
  isLoading?: boolean;
}

/* =======================
   Kartu metode terpisah
   ======================= */
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

/* =======================
   Komponen utama
   ======================= */
export function RevenueStats({
  transactions = [],
  metrics,
  isLoading = false,
}: RevenueStatsProps) {
  const { t } = useLanguage();

  /* ---------- Skeleton ---------- */
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

  if (isLoading) {
    return (
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
    );
  }
  /* ---------- End Skeleton ---------- */

  /* ---------- Fallback helpers dari transaksi ---------- */
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

  /* ---------- Total & This Month (server-first, fallback client) ---------- */
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

  /* ---------- Avg Transaction Value (hitung dari transaksi) ---------- */
  const totalTx = transactions.length;
  const avgTransactionValue = totalTx > 0 ? totalRevenue / totalTx : 0;

  /* ---------- Average Revenue (This Month) ---------- */
  // Server value (jika tersedia), fallback: revenue bulan ini / jumlah hari unik pada bulan ini
  const avgThisMonthServer = metrics?.averages?.thisMonthAverageRevenue;
  const uniqueDaysThisMonth = new Set(
    currentMonthTransactions.map((t) => new Date(t.date).toDateString())
  ).size;
  const avgThisMonthFallback =
    uniqueDaysThisMonth > 0
      ? Math.round(thisMonthRevenue / uniqueDaysThisMonth)
      : 0;
  const avgThisMonth = avgThisMonthServer ?? avgThisMonthFallback;

  /* ---------- Per metode (This Month) ---------- */
  const tm = metrics?.byMethodThisMonth;
  let thisMonthBCA = tm?.BCA ?? 0;
  let thisMonthDANA = tm?.DANA ?? 0;
  let thisMonthSPAY = tm?.SPAY ?? 0;
  let thisMonthQRIS = tm?.QRIS ?? 0;

  // Fallback hitung dari transaksi jika metrics belum ada
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

  /* ---------- Render ---------- */
  return (
    <div className="grid gap-4">
      {/* Ringkasan utama */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Revenue */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("totalRevenue")}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatRupiah(totalRevenue)}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("allTimeRevenue")}
            </p>
          </CardContent>
        </Card>

        {/* This Month Revenue */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("thisMonth")}
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
              {t(isPositiveGrowth ? "positiveGrowth" : "negativeGrowth", {
                percent: Math.abs(growth).toFixed(1),
              })}
            </p>
          </CardContent>
        </Card>

        {/* Transactions count */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("transactions")}
            </CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalTx > 0 ? totalTx : "-"}
            </div>
            <p className="text-xs text-muted-foreground">
              {totalTx > 0
                ? `${currentMonthTransactions.length} ${t(
                    "thisMonth"
                  ).toLowerCase()}`
                : t("allTimeRevenue")}
            </p>
          </CardContent>
        </Card>

        {/* Avg transaction value (berdasarkan transaksi) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Avg Revenue (This Month)
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatRupiah(avgThisMonth)}
            </div>
            <p className="text-xs text-muted-foreground">
              Rata-rata pendapatan harian bulan ini
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Kartu metode per-komponen (This Month) */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <BcaCard amount={thisMonthBCA} />
        <DanaCard amount={thisMonthDANA} />
        <SpayCard amount={thisMonthSPAY} />
        <QrisCard amount={thisMonthQRIS} />
      </div>
    </div>
  );
}
