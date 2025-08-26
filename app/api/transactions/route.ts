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

// Helper: pastikan string tanggal "YYYY-MM-DD"
function toDateOnly(input?: string): string | null {
  if (!input) return null;
  // dukung ISO string juga
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  // pakai tanggal UTC → slice(0,10) hasil yyyy-mm-dd
  return d.toISOString().slice(0, 10);
}

function toNumber(n: any, fallback = 0): number {
  const num = Number(n);
  return Number.isFinite(num) ? num : fallback;
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);

  const monthRaw = searchParams.get("month"); // bisa "8" atau "August"
  const yearRaw = searchParams.get("year");

  // sort
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

  // paging
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Number(searchParams.get("pageSize") ?? "10");
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // ==== parse month ====
  let monthFilter: number | null = null;
  if (monthRaw) {
    const trimmed = monthRaw.trim();
    const num = Number(trimmed);
    if (Number.isFinite(num) && num >= 1 && num <= 12) {
      monthFilter = num;
    } else {
      // coba dari nama bulan
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

  // (opsional) ambil user untuk filter user_id jika RLS butuh
  // const { data: { user } } = await supabase.auth.getUser();

  let q = supabase
    .from("transactions")
    .select(
      `
      id, date, item_purchased, customer_name, store_name,
      payment_method, purchase_price, selling_price, revenue,
      notes, month, year, created_at, updated_at
    `,
      { count: "exact" }
    )
    .is("deleted_at", null);

  // if (user) q = q.eq("user_id", user.id); // ← aktifkan kalau perlu

  if (monthFilter !== null) q = q.eq("month", monthFilter);
  if (yearFilter !== null) q = q.eq("year", yearFilter);

  // urutkan: primary by sortBy, secondary by created_at untuk stabil
  q = q
    .order(sortBy, { ascending: sortOrder === "asc" })
    .order("created_at", { ascending: false, nullsFirst: false });

  const { data, count, error } = await q.range(from, to);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    transactions: data ?? [],
    page,
    pageSize,
    total: count ?? 0,
    totalPages: Math.ceil((count ?? 0) / pageSize),
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
