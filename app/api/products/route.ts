import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const API_TYPES = new Set([
  "sharing",
  "sharing 8u",
  "sharing 4u",
  "sharing 2u",
  "sharing biasa",
  "sharing antilimit",
  "private",
  "edukasi",
  "sosmed",
  "google",
  "editing",
  "music",
  "famplan",
  "indplan",
]);

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);

  // ---------- Query params ----------
  const rawPage = Number(searchParams.get("page") ?? 1);
  const rawPageSize = Number(searchParams.get("pageSize") ?? 10);
  const all = (searchParams.get("all") ?? "") === "1";
  const search = (searchParams.get("search") ?? "").trim();
  const store = (searchParams.get("store") ?? "").trim();

  const allowedSort = [
    "created_at",
    "name",
    "type",
    "price",
    "updated_at",
  ] as const;
  type SortField = (typeof allowedSort)[number];
  const sortFieldRaw = (searchParams.get("sortField") ?? "created_at").trim();
  const sortField: SortField = (allowedSort as readonly string[]).includes(
    sortFieldRaw
  )
    ? (sortFieldRaw as SortField)
    : "created_at";
  const sortOrder: "asc" | "desc" =
    (searchParams.get("sortOrder") ?? "desc").toLowerCase() === "asc"
      ? "asc"
      : "desc";

  const page =
    Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  const pageSizeUnchecked =
    Number.isFinite(rawPageSize) && rawPageSize > 0
      ? Math.floor(rawPageSize)
      : 10;
  const pageSize = Math.min(pageSizeUnchecked, 1000);

  // ---------- Builder dasar ----------
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const buildBase = () => {
    let q = supabase
      .from("products")
      .select("*", { count: all ? undefined : "exact" })
      .is("deleted_at", null);

    if (search) {
      q = q.or(`name.ilike.%${search}%,type.ilike.%${search}%`);
    }

    q = q.order(sortField, { ascending: sortOrder === "asc" });

    if (!all) {
      q = q.range(from, to);
    }
    return q;
  };

  // ---------- Eksekusi dengan filter store + fallback kolom ----------
  async function runWithStore(qBase: ReturnType<typeof buildBase>) {
    if (!store || store.toUpperCase() === "OTHER") {
      return qBase;
    }
    // Coba kolom 'store' dulu (case-insensitive exact match).
    let q = qBase.ilike("store", store);
    let { data, error, count } = await q;
    // Jika kolom 'store' tidak ada, coba 'store_name'
    if (
      error &&
      (error.code === "42703" ||
        /column.*store.*does not exist/i.test(error.message))
    ) {
      q = qBase.ilike("store_name", store);
      const res2 = await q;
      return res2;
    }
    return { data, error, count };
  }

  const qBase = buildBase();
  const execRes = await runWithStore(qBase);

  // Jika runWithStore mengembalikan QueryBuilder (mis. tanpa store filter), eksekusi sekarang
  const res =
    "data" in execRes && "error" in execRes
      ? execRes
      : await (execRes as ReturnType<typeof buildBase>);

  const { data, error, count } = res;

  if (error) {
    // Error lain (bukan karena kolom store/store_name): kirim 400 apa adanya
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const total = all ? data?.length ?? 0 : count ?? 0;
  return NextResponse.json({ products: data ?? [], total });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const body = await req.json().catch(() => ({} as any));

  const name = String(body.name ?? "").trim();
  const type = String(body.type ?? "")
    .trim()
    .toLowerCase();
  const price = Number(body.price);

  // Ambil store dari beberapa kemungkinan key
  const rawStore = String(
    body.store ?? body.store_name ?? body.storeName ?? ""
  ).trim();

  // (opsional) batasi ke nilai yang diizinkan
  const ALLOWED_STORES = new Set(["HAPPIEST STORE", "BB STORE", "OTHER"]);

  // Validasi dasar
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!API_TYPES.has(type)) {
    return NextResponse.json({ error: "invalid type value" }, { status: 400 });
  }
  if (!Number.isFinite(price) || price < 0) {
    return NextResponse.json(
      { error: "price must be a non-negative number" },
      { status: 400 }
    );
  }
  if (!rawStore) {
    return NextResponse.json({ error: "store is required" }, { status: 400 });
  }

  const store = rawStore.toUpperCase();
  if (!ALLOWED_STORES.has(store)) {
    return NextResponse.json({ error: "invalid store value" }, { status: 400 });
  }

  const nowIso = new Date().toISOString();
  const insert = {
    name,
    type,
    price,
    store, // <-- penting: kolom NOT NULL
    created_at: nowIso,
    updated_at: nowIso,
  };

  const { data, error } = await supabase
    .from("products")
    .insert(insert)
    .select("id, name, type, price, store, created_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, product: data }, { status: 201 });
}
