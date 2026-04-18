import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient();
  const id = Number(params?.id);
  if (!Number.isFinite(id))
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true, product: data });
}

export async function PUT(
  req: NextRequest,
  // 1. Ubah tipe params menjadi Promise
  { params }: { params: Promise<{ id: string }> },
) {
  // 2. WAJIB AWAIT params sebelum mengambil nilainya
  const resolvedParams = await params;

  const id = String(resolvedParams.id || "").trim(); // <-- JANGAN Number()

  // Tambahkan pencegahan string "undefined" bawaan sistem
  if (!id || id === "undefined" || id === "null") {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const supabase = await createClient();

  // Pastikan user terautentikasi (agar RLS bekerja)
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}) as any);
  const patch: Record<string, any> = {};

  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (name) patch.name = name;
  }

  if (typeof body.type === "string") {
    const type = body.type.trim();
    if (type) patch.type = type; // atau toUpperCase() sesuai skema kamu
  }

  if (body.price !== undefined) {
    const p = Number(body.price);
    if (Number.isNaN(p)) {
      return NextResponse.json(
        { error: "price must be a number" },
        { status: 400 },
      );
    }
    patch.price = p;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  patch.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("products")
    .update(patch)
    .eq("id", id) // Karena sudah di-await, nilai ini sekarang murni "224"
    .eq("user_id", user.id) // <-- bantu “jelas” untuk RLS
    .is("deleted_at", null)
    .select("id, name, type, price, updated_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (!data) {
    // tidak ketemu utk user ini (atau diblokir RLS)
    return NextResponse.json(
      { error: "Not found or not authorized" },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true, product: data });
}

// PATCH -> delegasi ke PUT agar method apapun yang dikirim client tetap diterima
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }, // <-- Ubah tipe params jadi Promise
) {
  // Langsung teruskan ke PUT, karena PUT sudah melakukan 'await ctx.params'
  return PUT(req, ctx);
}

export async function DELETE(
  _req: NextRequest,
  // 1. Ubah tipe params menjadi Promise
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();

  // 2. WAJIB AWAIT params sebelum diekstrak
  const resolvedParams = await params;
  const id = String(resolvedParams?.id || "").trim();

  // 3. Tambahkan validasi pencegahan string "undefined" bawaan JavaScript
  if (!id || id === "undefined" || id === "null") {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("products")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data)
    return NextResponse.json(
      { error: "Not found or not authorized" },
      { status: 404 },
    );

  return NextResponse.json({ ok: true, id });
}
