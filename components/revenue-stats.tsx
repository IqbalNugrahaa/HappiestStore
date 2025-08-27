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
  date: string; // ISO date or "YYYY-MM-DD"
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
    todayRevenue?: number;
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

/** ===== Helpers ===== */
const n = (v: unknown) => Number(v) || 0;

const normalizeMethod = (m?: string) => {
  const u = (m || "").trim().toUpperCase();
  if (u === "SHOPEEPAY") return "SPAY";
  return u; // BCA, DANA, SPAY, QRIS, etc.
};

const getTxRevenue = (t: Transaction) =>
  Number(
    t.revenue ?? Number(t.selling_price ?? 0) - Number(t.purchase_price ?? 0)
  ) || 0;

/** YMD “kemarin” Asia/Jakarta */
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

/** YMD “hari ini” Asia/Jakarta */
function todayJakartaYMD() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value!;
  const m = parts.find((p) => p.type === "month")?.value!;
  const d = parts.find((p) => p.type === "day")?.value!;
  return `${y}-${m}-${d}`;
}

/** ===== Per-metode Cards ===== */
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

/** ===== Inti refactor: kalkulasi total per metode per bulan =====
 * Skenario:
 * 1) Jika backend sudah kirim `byMethodThisMonth`, gunakan itu (akurasi tertinggi).
 * 2) Jika belum, tetapi ada `rows` revenue bulan berjalan, agregasi dari rows (bca/dana/spay/qris).
 * 3) Jika tidak ada keduanya, fallback dari daftar `transactions` bulan berjalan (hitung per transaksi).
 */
function calculateMonthlyByMethod(
  metrics: RevenueApiData | undefined,
  currentMonthTransactions: Transaction[]
): { BCA: number; DANA: number; SPAY: number; QRIS: number } {
  // 1) Backend direct
  if (metrics?.byMethodThisMonth) {
    return metrics.byMethodThisMonth;
  }

  // 2) Dari rows bulanan (jika tersedia)
  if (metrics?.rows && metrics.rows.length) {
    return metrics.rows.reduce(
      (acc, r) => {
        acc.BCA += n(r.bca);
        acc.DANA += n(r.dana);
        acc.SPAY += n(r.spay);
        acc.QRIS += n(r.qris);
        return acc;
      },
      { BCA: 0, DANA: 0, SPAY: 0, QRIS: 0 }
    );
  }

  // 3) Fallback dari transaksi bulan ini
  return currentMonthTransactions.reduce(
    (acc, tx) => {
      const method = normalizeMethod(tx.payment_method);
      const rev = getTxRevenue(tx);
      if (method === "BCA") acc.BCA += rev;
      else if (method === "DANA") acc.DANA += rev;
      else if (method === "SPAY") acc.SPAY += rev;
      else if (method === "QRIS") acc.QRIS += rev;
      return acc;
    },
    { BCA: 0, DANA: 0, SPAY: 0, QRIS: 0 }
  );
}

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

  /** ==== Penentuan bulan berjalan dari sisi client ==== */
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const currentMonthTransactions = useMemo(
    () =>
      transactions.filter((t) => {
        // Asumsi t.date parsable; bila "YYYY-MM-DD", Date akan gunakan local TZ (OK untuk estimasi UI)
        const d = new Date(t.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      }),
    [transactions, currentMonth, currentYear]
  );

  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;

  const prevMonthTransactions = useMemo(
    () =>
      transactions.filter((t) => {
        const d = new Date(t.date);
        return d.getMonth() === prevMonth && d.getFullYear() === prevYear;
      }),
    [transactions, prevMonth, prevYear]
  );

  /** ==== Agregat bulan ini & bulan lalu ==== */
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

  /** ==== Yesterday (timezone Asia/Jakarta) ==== */
  const yesterdayRevenue = useMemo(() => {
    if (typeof metrics?.totals?.yesterdayRevenueThisMonth === "number") {
      return metrics.totals.yesterdayRevenueThisMonth;
    }
    const rows: any[] = (metrics as any)?.rows ?? [];
    const ymd = yesterdayJakartaYMD();
    if (rows.length) {
      return rows
        .filter((r) => r?.date === ymd)
        .reduce(
          (sum, r) =>
            sum +
            (n(r?.total_revenue) ||
              n(r?.bca) + n(r?.dana) + n(r?.spay) + n(r?.qris)),
          0
        );
    }
    return transactions
      .filter((t) => String(t.date).slice(0, 10) === ymd)
      .reduce((sum, t) => sum + getTxRevenue(t), 0);
  }, [metrics, transactions]);

  /** ==== Today (timezone Asia/Jakarta) ==== */
  const todayYMD = todayJakartaYMD();
  const todaysTxCount = useMemo(
    () =>
      transactions.filter((t) => String(t.date).slice(0, 10) === todayYMD)
        .length,
    [transactions, todayYMD]
  );

  const todayRevenue =
    metrics?.totals?.todayRevenue ??
    transactions
      .filter((t) => String(t.date).slice(0, 10) === todayYMD)
      .reduce((sum, t) => sum + getTxRevenue(t), 0);

  /** ==== NEW: Total per metode per bulan (fungsi utilitas terpusat) ==== */
  const {
    BCA: thisMonthBCA,
    DANA: thisMonthDANA,
    SPAY: thisMonthSPAY,
    QRIS: thisMonthQRIS,
  } = useMemo(
    () => calculateMonthlyByMethod(metrics, currentMonthTransactions),
    [metrics, currentMonthTransactions]
  );

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

            {/* Total Revenue Today */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t("totalRevenueToday") ?? "Total Revenue Today"}
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatRupiah(todayRevenue)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("revenueToday") ?? "Revenue Today"}
                </p>
              </CardContent>
            </Card>

            {/* Yesterday Revenue */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t("totalRevenueYesterday") ?? "Total Revenue Yesterday"}
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatRupiah(yesterdayRevenue)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("revenueYesterday") ?? "Revenue Yesterday"}
                </p>
              </CardContent>
            </Card>

            {/* Transactions count (Today) */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {t("countTransactions") ?? "CountTransactions"}
                </CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {todaysTxCount > 0 ? todaysTxCount : "-"}{" "}
                  {t("transactions") ?? "Transactions"}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("today") ?? "Today"}
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
