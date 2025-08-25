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

// ubah "1".."12" → "January".."December"; kalau sudah teks, kembalikan as is
function normalizeMonth(m: string): string {
  const trimmed = m.trim();
  const n = Number.parseInt(trimmed, 10);
  if (!Number.isNaN(n) && n >= 1 && n <= 12) return MONTHS[n - 1];
  // normalisasi case (opsional)
  const idx = MONTHS.findIndex(
    (x) => x.toLowerCase() === trimmed.toLowerCase()
  );
  return idx !== -1 ? MONTHS[idx] : trimmed;
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

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check if user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      date,
      item_purchased,
      customer_name,
      store_name,
      payment_method,
      purchase_price,
      selling_price,
      revenue,
      notes,
    } = await request.json();

    if (
      !item_purchased ||
      typeof item_purchased !== "string" ||
      item_purchased.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "Item purchase is required" },
        { status: 400 }
      );
    }

    if (
      !selling_price ||
      typeof selling_price !== "number" ||
      selling_price <= 0
    ) {
      return NextResponse.json(
        { error: "Valid selling price is required" },
        { status: 400 }
      );
    }

    if (!date) {
      return NextResponse.json({ error: "Date is required" }, { status: 400 });
    }

    const transactionDate = new Date(date);
    const month = transactionDate.getMonth() + 1;
    const year = transactionDate.getFullYear();

    // Insert transaction
    const { data: transaction, error } = await supabase
      .from("transactions")
      .insert([
        {
          date,
          item_purchased: item_purchased.trim(),
          customer_name: customer_name?.trim() || null,
          store_name: store_name?.trim() || null,
          payment_method: payment_method?.trim() || null,
          purchase_price: purchase_price || 0,
          selling_price,
          revenue: revenue || selling_price,
          notes: notes?.trim() || null,
          month,
          year,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Error creating transaction:", error);
      return NextResponse.json(
        { error: "Failed to create transaction" },
        { status: 500 }
      );
    }

    return NextResponse.json({ transaction }, { status: 201 });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
