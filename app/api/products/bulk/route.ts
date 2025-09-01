// app/api/products/bulk/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

// ====== Konstanta & util ======
const CANONICAL_STORES = new Set(["HAPPIEST STORE", "BB STORE"]);
const CANONICAL_TYPES = new Set([
  "SHARING",
  "SHARING 8U",
  "SHARING 4U",
  "SHARING 2U",
  "SHARING BIASA",
  "SHARING ANTILIMIT",
  "PRIVATE",
  "EDUKASI",
  "SOSMED",
  "GOOGLE",
  "EDITING",
  "MUSIC",
  "FAMPLAN",
  "INDPLAN",
]);

function normalizeUpper(s: unknown) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}
function normalizeType(raw: string) {
  return normalizeUpper(raw)
    .replace(/\b(\d)\s*U\b/g, (_m, d) => `${d}U`)
    .replace(/\bu\s*(\d)\b/g, (_m, d) => `${d}U`);
}
function isPositiveNumber(n: unknown) {
  const x = Number(n);
  return Number.isFinite(x) && x > 0;
}

type IncomingProduct = {
  name?: string;
  type?: string;
  price?: number;
  store?: string;
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();

    // Auth
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({} as any));
    const products = Array.isArray(body?.products)
      ? (body.products as IncomingProduct[])
      : null;

    if (!products || products.length === 0) {
      return NextResponse.json(
        { error: "Invalid products data" },
        { status: 400 }
      );
    }

    // Validasi & normalisasi per baris
    const validRows: Array<{
      user_id: string;
      name: string;
      type: string;
      price: number;
      store: string;
    }> = [];
    const invalidRows: Array<{
      index: number;
      errors: string[];
      raw?: IncomingProduct;
    }> = [];

    for (let i = 0; i < products.length; i++) {
      const p = products[i] ?? {};
      const name = String(p.name ?? "").trim();
      const typeRaw = String(p.type ?? "");
      const price = Number(p.price);
      const storeRaw = String(p.store ?? "");

      const errors: string[] = [];

      if (!name) errors.push("name is required");

      const typeNorm = normalizeType(typeRaw);
      if (!typeNorm) errors.push("type is required");
      else if (!CANONICAL_TYPES.has(typeNorm)) {
        errors.push(`invalid type value: "${typeRaw}"`);
      }

      if (!isPositiveNumber(price))
        errors.push("price must be a positive number");

      const storeNorm = normalizeUpper(storeRaw);
      if (!storeNorm) errors.push("store is required");
      else if (!CANONICAL_STORES.has(storeNorm)) {
        errors.push(
          `invalid store: "${storeRaw}" (use HAPPIEST STORE or BB STORE)`
        );
      }

      if (errors.length) {
        invalidRows.push({ index: i, errors, raw: p });
      } else {
        validRows.push({
          user_id: user.id, // <-- Wajib untuk RLS
          name,
          type: typeNorm,
          price: Number(price),
          store: storeNorm,
        });
      }
    }

    if (validRows.length === 0) {
      return NextResponse.json(
        {
          error: "No valid products to upload",
          invalidCount: invalidRows.length,
          invalidRows,
        },
        { status: 400 }
      );
    }

    // Upsert per user + name + store
    const BATCH_SIZE = 500;
    const insertedAll: any[] = [];
    for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
      const chunk = validRows.slice(i, i + BATCH_SIZE);
      const { data, error } = await supabase
        .from("products")
        .upsert(chunk, {
          onConflict: "user_id,name,store", // <-- penting: unik per user
          // (opsional) kalau ingin "update on duplicate" biarkan default (bukan ignore)
          // ignoreDuplicates: true // <- ini untuk .insert; untuk upsert biasanya diabaikan
        })
        .select();

      if (error) {
        console.error("Database error (chunk)", error);
        // Kembalikan detail agar gampang debug
        return NextResponse.json(
          { error: "Failed to create products", details: error.message },
          { status: 500 }
        );
      }
      if (data) insertedAll.push(...data);
    }

    return NextResponse.json({
      message: `Processed ${products.length} rows`,
      insertedCount: insertedAll.length,
      invalidCount: invalidRows.length,
      invalidRows,
      products: insertedAll,
    });
  } catch (error: any) {
    console.error("Bulk upload error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: String(error?.message ?? error),
      },
      { status: 500 }
    );
  }
}
