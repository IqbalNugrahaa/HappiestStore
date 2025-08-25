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

  const page = Number(searchParams.get("page") || 1);
  const pageSize = Number(searchParams.get("pageSize") || 10);
  const all = searchParams.get("all") === "1";
  const search = (searchParams.get("search") || "").trim();

  const allowedSort = new Set([
    "created_at",
    "name",
    "type",
    "price",
    "updated_at",
  ]);
  const sortFieldRaw = (searchParams.get("sortField") || "created_at").trim();
  const sortField = allowedSort.has(sortFieldRaw) ? sortFieldRaw : "created_at";
  const sortOrder = (searchParams.get("sortOrder") || "desc") as "asc" | "desc";

  let q = supabase
    .from("products")
    .select("*", { count: "exact" })
    .is("deleted_at", null);

  if (search) {
    q = q.or(`name.ilike.%${search}%,type.ilike.%${search}%`);
  }

  q = q.order(sortField, { ascending: sortOrder === "asc" });

  if (!all) {
    q = q.range((page - 1) * pageSize, page * pageSize - 1);
  }

  const { data, error, count } = await q;
  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });

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

  if (!name)
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (!API_TYPES.has(type))
    return NextResponse.json({ error: "invalid type value" }, { status: 400 });
  if (!Number.isFinite(price) || price < 0) {
    return NextResponse.json(
      { error: "price must be a non-negative number" },
      { status: 400 }
    );
  }

  const insert = { name, type, price, created_at: new Date().toISOString() };
  const { data, error } = await supabase
    .from("products")
    .insert(insert)
    .select("id, name, type, price, created_at")
    .maybeSingle();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, product: data }, { status: 201 });
}
