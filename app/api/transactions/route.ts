import { createClient } from "@/lib/supabase/server";
import { type NextRequest, NextResponse } from "next/server";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// Helper: YYYY-MM-DD di Asia/Jakarta  // NEW
function todayJakartaYMD() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;
  return `${y}-${m}-${d}`;
}

// (opsional) jika kolom `date` bertipe timestamp, pakai rentang hari (Asia/Jakarta)  // NEW
function todayJakartaRangeISO() {
  const tz = "Asia/Jakarta";
  const now = new Date();
  // Dapatkan awal & akhir hari ini di Asia/Jakarta, lalu konversi ke ISO UTC
  const startStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(now));
  const y = startStr.find((p) => p.type === "year")!.value;
  const m = startStr.find((p) => p.type === "month")!.value;
  const d = startStr.find((p) => p.type === "day")!.value;
  const startLocal = new Date(`${y}-${m}-${d}T00:00:00+07:00`);
  const endLocal = new Date(`${y}-${m}-${d}T23:59:59.999+07:00`);
  return { startISO: startLocal.toISOString(), endISO: endLocal.toISOString() };
}

// Helper existing
function toDateOnly(input?: string): string | null {
  if (!input) return null;
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}
function toNumber(n: any, fallback = 0): number {
  const num = Number(n);
  return Number.isFinite(num) ? num : fallback;
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);

  const monthRaw = searchParams.get("month");
  const yearRaw = searchParams.get("year");

  const sortBy = (searchParams.get("sortBy") ?? "date") as
    | "date"
    | "item_purchased"
    | "customer_name"
    | "store_name"
    | "purchase_price"
    | "selling_price"
    | "revenue"
    | "created_at"
    | "updated_at";
  const sortOrder = (searchParams.get("sortOrder") ?? "desc") as "asc" | "desc";

  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Number(searchParams.get("pageSize") ?? "10");
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // ==== parse month ====
  let monthFilter: number | null = null;
  if (monthRaw) {
    const trimmed = monthRaw.trim();
    const num = Number(trimmed);
    if (Number.isFinite(num) && num >= 1 && num <= 12) monthFilter = num;
    else {
      const idx = MONTHS.findIndex(
        (m) => m.toLowerCase() === trimmed.toLowerCase()
      );
      if (idx !== -1) monthFilter = idx + 1;
    }
  }

  // ==== parse year ====
  let yearFilter: number | null = null;
  if (yearRaw) {
    const y = Number(yearRaw);
    if (Number.isFinite(y)) yearFilter = y;
  }

  // builder filter base
  const applyFilters = (qb: any) => {
    qb = qb.is("deleted_at", null);
    if (monthFilter !== null) qb = qb.eq("month", monthFilter);
    if (yearFilter !== null) qb = qb.eq("year", yearFilter);
    return qb;
  };

  // === (1) TOTAL GLOBAL (tanpa pagesize) ===
  const countQ = applyFilters(
    supabase.from("transactions").select("id", { count: "exact", head: true })
  );
  const { count: totalAll, error: countError } = await countQ;
  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 400 });
  }

  // === (2) TOTAL TRANSAKSI HARI INI (tanpa pagesize) ===  // NEW
  const todayYMD = todayJakartaYMD();

  // Jika kolom `date` kamu bertipe DATE atau TEXT 'YYYY-MM-DD':
  const todayCountQ = applyFilters(
    supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("date", todayYMD) // <— langsung cocokkan YMD
  );

  // Jika kolom `date` kamu bertipe TIMESTAMP, ganti blok di atas dengan rentang waktu:
  // const { startISO, endISO } = todayJakartaRangeISO();
  // const todayCountQ = applyFilters(
  //   supabase
  //     .from("transactions")
  //     .select("id", { count: "exact", head: true })
  //     .gte("date", startISO)
  //     .lte("date", endISO)
  // );

  const { count: todaysTxCount, error: todayCountErr } = await todayCountQ;
  if (todayCountErr) {
    return NextResponse.json({ error: todayCountErr.message }, { status: 400 });
  }

  // === (3) DATA BER-PAGING ===
  let dataQ = applyFilters(
    supabase.from("transactions").select(`
      id, date, id_product, item_purchased, customer_name, store_name,
      payment_method, purchase_price, selling_price, revenue,
      notes, month, year, created_at, updated_at
    `)
  )
    .order(sortBy, { ascending: sortOrder === "asc" })
    .order("created_at", { ascending: false, nullsFirst: false })
    .range(from, to);

  const { data, error } = await dataQ;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    transactions: data ?? [],
    page,
    pageSize,
    total: totalAll ?? 0,
    totalPages: Math.max(1, Math.ceil((totalAll ?? 0) / pageSize)),
    // NEW: kirim total transaksi hari ini (Asia/Jakarta), tidak terpengaruh pagesize
    todaysTxCount: todaysTxCount ?? 0,
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  // Auth (wajib bila RLS aktif)
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({} as any));

  // Terima dua nama field & samakan
  const item_purchased = String(
    body?.item_purchased ?? body?.item_purchase ?? ""
  ).trim();

  // Ambil product id dari 2 kemungkinan nama
  const productIdRaw = body?.product_id ?? body?.id_product ?? null;
  const hasProduct =
    productIdRaw !== null &&
    productIdRaw !== undefined &&
    String(productIdRaw) !== "";

  // Default is_custom_item: true kalau tidak ada id_product
  const is_custom_item =
    typeof body?.is_custom_item === "boolean"
      ? body.is_custom_item
      : !hasProduct;

  // Validasi minimal: bila custom item, butuh nama item
  if (is_custom_item && !item_purchased) {
    return NextResponse.json(
      { error: "Item purchase is required" },
      { status: 400 }
    );
  }

  // Normalisasi tanggal + month/year
  const date = toDateOnly(body?.date) ?? new Date().toISOString().slice(0, 10);
  const d = new Date(date + "T00:00:00Z");
  const month = Number(body?.month ?? d.getUTCMonth() + 1);
  const year = Number(body?.year ?? d.getUTCFullYear());

  // Payload insert — pakai kolom yang ADA di DB: id_product
  const row: Record<string, any> = {
    // Hapus baris ini jika tabel-mu tidak punya kolom user_id
    user_id: user.id,

    date,
    item_purchased, // pakai nama kolom DB
    customer_name: body?.customer_name ?? null,
    store_name: body?.store_name ?? null,
    payment_method: body?.payment_method ?? null,
    purchase_price: toNumber(body?.purchase_price),
    selling_price: toNumber(body?.selling_price),
    revenue:
      body?.revenue !== undefined
        ? toNumber(body?.revenue)
        : toNumber(body?.selling_price) - toNumber(body?.purchase_price),
    notes: body?.notes ?? null,
    month,
    year,
    is_custom_item,
  };

  // ⬇️ inilah perubahan utamanya: isi id_product (bukan product_id)
  if (hasProduct) {
    row.id_product = productIdRaw;
  }

  const { data, error } = await supabase
    .from("transactions")
    .insert(row)
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      {
        error: "Failed to create transaction",
        details: error.message,
        hint:
          error.message?.includes("foreign key") &&
          "Pastikan id_product valid (ada di tabel products).",
      },
      { status: 400 }
    );
  }

  return NextResponse.json({ data }, { status: 201 });
}
