// app/api/revenue/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RevenueRow = {
  date: string; // "YYYY-MM-DD"
  total_revenue: number | null;
  bca: number | null;
  dana: number | null;
  spay: number | null;
  qris: number | null;
  average_revenue: number | null;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function ymd(y: number, m: number, d: number) {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}
function startEndOfMonth(year: number, month: number) {
  const start = ymd(year, month, 1);
  const end = month === 12 ? ymd(year + 1, 1, 1) : ymd(year, month + 1, 1); // exclusive
  return { start, end };
}
// “Hari ini” menurut Asia/Jakarta (kolom DATE di DB tidak punya TZ)
function todayPartsJakarta() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get("year"), m: get("month"), d: get("day") };
}
function prevDayUTC(y: number, m: number, d: number) {
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return {
    y: dt.getUTCFullYear(),
    m: dt.getUTCMonth() + 1,
    d: dt.getUTCDate(),
  };
}
const n = (v: any) => Number(v) || 0;

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);

  // Auth (agar RLS aman)
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Bulan & tahun target
  const today = todayPartsJakarta();
  const month = Number(searchParams.get("month") || today.m);
  const year = Number(searchParams.get("year") || today.y);
  const { start, end } = startEndOfMonth(year, month);

  // --- Ambil data bulan ini ---
  const { data: monthRows, error: mErr } = await supabase
    .from("revenue")
    .select("date,total_revenue,bca,dana,spay,qris,average_revenue")
    .eq("user_id", user.id) // Hapus baris ini jika tabel revenue kamu tidak ada kolom user_id
    .gte("date", start)
    .lt("date", end)
    .order("date", { ascending: true });

  if (mErr) {
    return NextResponse.json(
      { error: "Failed to fetch revenue", details: mErr.message },
      { status: 500 }
    );
  }

  const rows = (monthRows ?? []) as RevenueRow[];
  const sumMethods = (r: RevenueRow) =>
    n(r.bca) + n(r.dana) + n(r.spay) + n(r.qris);

  const thisMonthRevenue =
    rows.reduce((acc, r) => acc + (n(r.total_revenue) || sumMethods(r)), 0) ||
    0;

  const byMethodThisMonth = {
    BCA: rows.reduce((a, r) => a + n(r.bca), 0),
    DANA: rows.reduce((a, r) => a + n(r.dana), 0),
    SPAY: rows.reduce((a, r) => a + n(r.spay), 0),
    QRIS: rows.reduce((a, r) => a + n(r.qris), 0),
  };

  // --- Ambil data bulan lalu ---
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const { start: pStart, end: pEnd } = startEndOfMonth(prevYear, prevMonth);

  const { data: prevRows, error: pErr } = await supabase
    .from("revenue")
    .select("total_revenue,bca,dana,spay,qris")
    .eq("user_id", user.id)
    .gte("date", pStart)
    .lt("date", pEnd);

  if (pErr) {
    return NextResponse.json(
      { error: "Failed to fetch prev revenue", details: pErr.message },
      { status: 500 }
    );
  }

  const prevMonthRevenue =
    (prevRows ?? []).reduce(
      (acc: any, r: any) =>
        acc +
        (n(r.total_revenue) || n(r.bca) + n(r.dana) + n(r.spay) + n(r.qris)),
      0
    ) || 0;

  // --- All-time totals ---
  const { data: allRows, error: aErr } = await supabase
    .from("revenue")
    .select("total_revenue,bca,dana,spay,qris")
    .eq("user_id", user.id);

  if (aErr) {
    return NextResponse.json(
      { error: "Failed to fetch all-time revenue", details: aErr.message },
      { status: 500 }
    );
  }

  const totalRevenue =
    (allRows ?? []).reduce(
      (acc: any, r: any) =>
        acc +
        (n(r.total_revenue) || n(r.bca) + n(r.dana) + n(r.spay) + n(r.qris)),
      0
    ) || 0;

  const byMethodAllTime = {
    BCA: (allRows ?? []).reduce((a: any, r: any) => a + n(r.bca), 0),
    DANA: (allRows ?? []).reduce((a: any, r: any) => a + n(r.dana), 0),
    SPAY: (allRows ?? []).reduce((a: any, r: any) => a + n(r.spay), 0),
    QRIS: (allRows ?? []).reduce((a: any, r: any) => a + n(r.qris), 0),
  };

  // --- Yesterday (hanya jika masih di bulan & tahun filter) ---
  const yPrev = prevDayUTC(today.y, today.m, today.d);
  let yesterdayRevenueThisMonth = 0;
  let yesterdayByMethod = { BCA: 0, DANA: 0, SPAY: 0, QRIS: 0 };

  if (yPrev.y === year && yPrev.m === month) {
    const ystr = ymd(yPrev.y, yPrev.m, yPrev.d);
    const { data: yRows, error: yErr } = await supabase
      .from("revenue")
      .select("bca,dana,spay,qris,total_revenue")
      .eq("user_id", user.id)
      .eq("date", ystr);

    if (!yErr && yRows?.length) {
      yesterdayByMethod.BCA = yRows.reduce(
        (a: number, r: any) => a + n(r.bca),
        0
      );
      yesterdayByMethod.DANA = yRows.reduce(
        (a: number, r: any) => a + n(r.dana),
        0
      );
      yesterdayByMethod.SPAY = yRows.reduce(
        (a: number, r: any) => a + n(r.spay),
        0
      );
      yesterdayByMethod.QRIS = yRows.reduce(
        (a: number, r: any) => a + n(r.qris),
        0
      );
      yesterdayRevenueThisMonth =
        yesterdayByMethod.BCA +
        yesterdayByMethod.DANA +
        yesterdayByMethod.SPAY +
        yesterdayByMethod.QRIS;
    }
  }

  const daysCount = rows.length || 1;
  const thisMonthAverageRevenue = thisMonthRevenue / daysCount;
  const prevDaysCount = (prevRows ?? []).length || 1;
  const prevMonthAverageRevenue = prevMonthRevenue / prevDaysCount;

  return NextResponse.json({
    rows,
    totals: {
      totalRevenue,
      thisMonthRevenue,
      prevMonthRevenue,
      yesterdayRevenueThisMonth,
    },
    averages: {
      thisMonthAverageRevenue,
      prevMonthAverageRevenue,
    },
    byMethodThisMonth,
    byMethodAllTime,
    yesterdayByMethod, // untuk debug/visualisasi kalau perlu
    month,
    year,
    range: { start, endExclusive: end },
  });
}
