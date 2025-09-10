// components/pendapatan-view.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatRupiah } from "@/lib/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { cn } from "@/lib/utils";
// === Saldo: ikon opsional
import { Landmark, Wallet, CreditCard } from "lucide-react";

type YearRow = { year: number };
type MonthRow = {
  user_id: string;
  year: number;
  month: number; // 1..12
  total_revenue: number;
  bca: number;
  dana: number;
  qris: number;
  spay: number;
};

// === Saldo: tipe payload dari API
type BalancesPayload = {
  date: string;
  bca: number;
  dana: number;
  spay: number;
};

const MONTH_LABEL = [
  "",
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [query]);
  return matches;
}

export default function RevenueMonthView() {
  const supabase = createClient();
  const [years, setYears] = useState<number[]>([]);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [rows, setRows] = useState<MonthRow[]>([]);
  const [loading, setLoading] = useState(true);
  const isMobile = useMediaQuery("(max-width: 767px)");
  const currentMonth = new Date().getMonth() + 1; // 1..12

  // === Saldo: state + fetch
  const [balances, setBalances] = useState<BalancesPayload | null>(null);
  const [loadingBalances, setLoadingBalances] = useState<boolean>(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoadingBalances(true);
        const res = await fetch("/api/balances/today", { cache: "no-store" });
        if (!alive) return;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: BalancesPayload = await res.json();
        setBalances(json);
      } catch {
        setBalances({ date: "", bca: 0, dana: 0, spay: 0 });
      } finally {
        if (alive) setLoadingBalances(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Load daftar tahun yang ada datanya
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await supabase
        .from("revenue_years")
        .select("year")
        .order("year", { ascending: false });

      if (!mounted) return;
      if (error) {
        setYears([new Date().getFullYear()]);
        return;
      }
      const ys = (data as YearRow[]).map((d) => d.year);
      setYears(ys.length ? ys : [new Date().getFullYear()]);
      if (ys.includes(new Date().getFullYear())) {
        setYear(new Date().getFullYear());
      } else if (ys.length) {
        setYear(ys[0]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [supabase]);

  // Load 12 bulan untuk tahun terpilih (selalu 12 baris dari view)
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from("v_revenue_year_for_chart")
        .select("user_id, year, month, total_revenue, bca, dana, qris, spay")
        .eq("year", year)
        .order("month", { ascending: true });

      if (!mounted) return;
      if (error) {
        setRows([]);
        setLoading(false);
        return;
      }
      setRows((data as MonthRow[]) ?? []);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [supabase, year]);

  const chartData = useMemo(
    () =>
      rows.map((r) => ({
        monthNum: r.month, // tambahkan ini agar mudah filter
        name: MONTH_LABEL[r.month],
        total: r.total_revenue ?? 0,
        bca: r.bca ?? 0,
        dana: r.dana ?? 0,
        qris: r.qris ?? 0,
        spay: r.spay ?? 0,
      })),
    [rows]
  );

  const chartBarsData = useMemo(() => {
    if (!isMobile) return chartData;
    return chartData.filter((d) => d.monthNum === currentMonth);
  }, [chartData, isMobile, currentMonth]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        acc.total += r.total_revenue || 0;
        acc.bca += r.bca || 0;
        acc.dana += r.dana || 0;
        acc.qris += r.qris || 0;
        acc.spay += r.spay || 0;
        return acc;
      },
      { total: 0, bca: 0, dana: 0, qris: 0, spay: 0 }
    );
  }, [rows]);

  const totalYear = totals.total;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header + Tahun */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold">Pendapatan</h1>
          <p className="text-xs md:text-sm text-muted-foreground">
            Ringkasan pendapatan bulanan per tahun
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-sm md:text-base text-muted-foreground">
            Total {year}:{" "}
            <span className="font-semibold text-foreground">
              {formatRupiah(totalYear)}
            </span>
          </div>
          <Select
            value={String(year)}
            onValueChange={(v) => setYear(Number(v))}
          >
            <SelectTrigger className="w-[140px] md:w-[160px]">
              <SelectValue placeholder="Pilih tahun" />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* === Saldo: 3 Card Sisa Saldo Terbaru === */}
      <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-3">
        <Card className="border border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <Landmark className="h-5 w-5" />
              Saldo BCA
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {balances?.date ? `per ${balances.date}` : "—"}
            </p>
          </CardHeader>
          <CardContent>
            <div className="text-2xl md:text-3xl font-semibold">
              {loadingBalances ? "Memuat…" : formatRupiah(balances?.bca ?? 0)}
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <Wallet className="h-5 w-5" />
              Saldo DANA
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {balances?.date ? `per ${balances.date}` : "—"}
            </p>
          </CardHeader>
          <CardContent>
            <div className="text-2xl md:text-3xl font-semibold">
              {loadingBalances ? "Memuat…" : formatRupiah(balances?.dana ?? 0)}
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <CreditCard className="h-5 w-5" />
              Saldo SPAY
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {balances?.date ? `per ${balances.date}` : "—"}
            </p>
          </CardHeader>
          <CardContent>
            <div className="text-2xl md:text-3xl font-semibold">
              {loadingBalances ? "Memuat…" : formatRupiah(balances?.spay ?? 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden hidden md:block">
        <CardHeader className="bg-gradient-to-r from-indigo-500/10 via-blue-500/10 to-purple-500/10">
          <CardTitle>
            {isMobile
              ? `Grafik Pendapatan Bulan ${MONTH_LABEL[currentMonth]} (${year})`
              : `Grafik Pendapatan Bulanan (${year})`}
          </CardTitle>
        </CardHeader>

        <CardContent className={cn("pt-4", isMobile ? "h-56" : "h-64 md:h-80")}>
          {loading ? (
            <div className="text-sm text-muted-foreground">Memuat grafik…</div>
          ) : chartBarsData.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Belum ada data untuk{" "}
              {isMobile ? `bulan ${MONTH_LABEL[currentMonth]}` : "tahun ini"}.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartBarsData}
                margin={{ top: 8, right: 16, bottom: 8, left: 72 }}
                barCategoryGap={isMobile ? "40%" : "20%"}
              >
                <defs>
                  <linearGradient id="fillTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366F1" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#A855F7" stopOpacity={0.7} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  width={76}
                  axisLine={false}
                  tickLine={false}
                  domain={[
                    0,
                    (dataMax: number) => Math.max(20_000_000, dataMax),
                  ]}
                  tickFormatter={(v: number) =>
                    new Intl.NumberFormat("id-ID", {
                      notation: "compact",
                      maximumFractionDigits: 1,
                    }).format(v)
                  }
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid hsl(var(--border))",
                  }}
                  formatter={(value: any, name) => [
                    formatRupiah(value as number),
                    name,
                  ]}
                  labelFormatter={(label) => `Bulan: ${label}`}
                />
                <Bar
                  dataKey="total"
                  name="Total"
                  fill="url(#fillTotal)"
                  radius={[10, 10, 4, 4]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Tabel */}
      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-indigo-500/10 via-blue-500/10 to-purple-500/10">
          <CardTitle>Tabel Penghasilan Bulanan ({year})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 text-sm text-muted-foreground">
              Memuat tabel…
            </div>
          ) : (
            <div className="overflow-x-auto mx-4">
              <Table className="text-xs md:text-sm">
                <TableHeader className="sticky top-0 bg-background/60 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10">
                  <TableRow>
                    <TableHead className="min-w-[80px]">Bulan</TableHead>
                    <TableHead className="text-right min-w-[110px]">
                      Total
                    </TableHead>
                    <TableHead className="text-right min-w-[100px]">
                      BCA
                    </TableHead>
                    <TableHead className="text-right min-w-[100px]">
                      DANA
                    </TableHead>
                    <TableHead className="text-right min-w-[100px]">
                      QRIS
                    </TableHead>
                    <TableHead className="text-right min-w-[100px]">
                      SPAY
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {chartData.map((r, idx) => (
                    <TableRow
                      key={idx}
                      className="odd:bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatRupiah(r.total)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatRupiah(r.bca)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatRupiah(r.dana)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatRupiah(r.qris)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatRupiah(r.spay)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Footer total */}
                  <TableRow className="bg-muted/60 font-semibold">
                    <TableCell>Total {year}</TableCell>
                    <TableCell className="text-right">
                      {formatRupiah(totals.total)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatRupiah(totals.bca)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatRupiah(totals.dana)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatRupiah(totals.qris)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatRupiah(totals.spay)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
