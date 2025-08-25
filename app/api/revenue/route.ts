// app/api/revenue/route.ts
import { NextResponse } from "next/server";
// Pakai helper server-side
import { createClient } from "@/lib/supabase/server";

type Row = {
  date: string; // "YYYY-MM-DD"
  total_revenue: number | null;
  bca: number | null;
  dana: number | null;
  spay: number | null;
  qris: number | null;
  average_revenue: number | null; // NEW
};

function sum(nums: Array<number | null | undefined>) {
  return nums.reduce((acc, n) => (acc || 0) + (Number(n) || 0), 0);
}
function ymd(dateStr: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}
function prevMonth(y: number, m: number) {
  return m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 };
}

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("revenue")
    .select("date,total_revenue,bca,dana,spay,qris,average_revenue");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const rows: Row[] = data ?? [];

  const now = new Date();
  const curY = now.getFullYear();
  const curM = now.getMonth() + 1;
  const { y: prevY, m: prevM } = prevMonth(curY, curM);

  const thisMonthRows = rows.filter((r) => {
    const d = ymd(r.date);
    return d ? d.y === curY && d.m === curM : false;
  });
  const prevMonthRows = rows.filter((r) => {
    const d = ymd(r.date);
    return d ? d.y === prevY && d.m === prevM : false;
  });

  // Totals
  const totalRevenue = sum(rows.map((r) => r.total_revenue));
  const thisMonthRevenue = sum(thisMonthRows.map((r) => r.total_revenue));
  const prevMonthRevenue = sum(prevMonthRows.map((r) => r.total_revenue));

  // Averages (ambil dari kolom; fallback hitung cepat)
  const pickMonthAvg = (arr: Row[]) => {
    const found = arr.find((r) => r.average_revenue != null)?.average_revenue;
    if (typeof found === "number") return Number(found);
    const days = arr.length;
    const t = sum(arr.map((r) => r.total_revenue));
    return days > 0 ? Math.round((t || 0) / days) : 0;
  };
  const thisMonthAverageRevenue = pickMonthAvg(thisMonthRows);
  const prevMonthAverageRevenue = pickMonthAvg(prevMonthRows);

  // Breakdown per metode
  const byMethodAllTime = {
    BCA: sum(rows.map((r) => r.bca)),
    DANA: sum(rows.map((r) => r.dana)),
    SPAY: sum(rows.map((r) => r.spay)),
    QRIS: sum(rows.map((r) => r.qris)),
  };
  const byMethodThisMonth = {
    BCA: sum(thisMonthRows.map((r) => r.bca)),
    DANA: sum(thisMonthRows.map((r) => r.dana)),
    SPAY: sum(thisMonthRows.map((r) => r.spay)),
    QRIS: sum(thisMonthRows.map((r) => r.qris)),
  };

  return NextResponse.json({
    data: {
      totals: {
        totalRevenue,
        thisMonthRevenue,
        prevMonthRevenue,
      },
      averages: {
        thisMonthAverageRevenue,
        prevMonthAverageRevenue,
      },
      byMethodAllTime,
      byMethodThisMonth,
    },
  });
}
