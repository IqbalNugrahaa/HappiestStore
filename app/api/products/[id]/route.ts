import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** ====== TYPE KANONIK (API / lowercase) ====== */
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

function normalizeLoose(s: string) {
  return String(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b(\d)\s*u\b/g, (_, d) => `${d}u`)
    .replace(/\bu\s*(\d)\b/g, (_, d) => `${d}u`);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
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
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const id = String(params?.id || "").trim(); // <-- JANGAN Number()

  if (!id) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  // Pastikan user terautentikasi (agar RLS bekerja)
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({} as any));
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
        { status: 400 }
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
    .eq("id", id)
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
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true, product: data });
}

// PATCH -> delegasi ke PUT agar method apapun yang dikirim client tetap diterima
export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  return PUT(req, ctx);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const id = String(params?.id || "").trim();

  if (!id) {
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
      { status: 404 }
    );

  return NextResponse.json({ ok: true, id });
}
