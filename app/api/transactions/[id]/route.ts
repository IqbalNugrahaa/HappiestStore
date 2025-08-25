import { createClient } from "@/lib/supabase/server";
import { type NextRequest, NextResponse } from "next/server";

function toDateOnlyISO(input: string) {
  // input bisa "2025-08-22" atau "2025-08-22T00:00:00"
  const d = new Date(input);
  if (isNaN(d.valueOf())) return null;
  // kembalikan format "YYYY-MM-DD" saja untuk kolom DATE
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();

    // auth
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const {
      id_product, // number | null
      is_custom_item = false,
      date, // string
      item_purchase, // string
      customer_name = "",
      store_name = "",
      payment_method = "",
      purchase_price = 0,
      selling_price = 0,
      revenue = 0,
      notes = "",
      month,
      year,
    } = body ?? {};

    // Validasi tanggal → kirim "YYYY-MM-DD" agar aman utk kolom DATE
    if (!date) {
      return NextResponse.json({ error: "date is required" }, { status: 400 });
    }
    const dateOnly = toDateOnlyISO(date);
    if (!dateOnly) {
      return NextResponse.json(
        { error: "date must be a valid date" },
        { status: 400 }
      );
    }

    // Derive month/year jika kosong
    const d = new Date(dateOnly + "T00:00:00");
    const derivedMonth = typeof month === "number" ? month : d.getMonth() + 1;
    const derivedYear = typeof year === "number" ? year : d.getFullYear();

    // Validasi item/product
    if (!is_custom_item) {
      const hasId =
        id_product !== undefined &&
        id_product !== null &&
        !Number.isNaN(Number(id_product));
      const hasItem =
        typeof item_purchase === "string" && item_purchase.trim().length > 0;
      if (!hasId && !hasItem) {
        return NextResponse.json(
          {
            error:
              "Either id_product or item_purchase is required when is_custom_item = false",
          },
          { status: 400 }
        );
      }
    } else {
      if (!item_purchase || !String(item_purchase).trim()) {
        return NextResponse.json(
          { error: "item_purchase is required when is_custom_item = true" },
          { status: 400 }
        );
      }
    }

    // Normalisasi
    const rawItem =
      (typeof body.item_purchased === "string"
        ? body.item_purchased
        : undefined) ??
      (typeof item_purchase === "string" ? item_purchase : undefined);

    let itemName = (rawItem ?? "").trim();

    // (opsional) fallback ke nama produk jika ada id_product tapi itemName kosong
    if (!itemName && id_product) {
      const { data: prod } = await supabase
        .from("products")
        .select("name")
        .eq("id", id_product)
        .maybeSingle();
      if (prod?.name) itemName = String(prod.name).trim();
    }

    // === Normalisasi field lain ===
    const payRaw = String(payment_method || "")
      .trim()
      .toUpperCase();
    const allowedPays = new Set(["BCA", "GOPAY", "DANA", "QRIS", "SPAY"]);
    const pay = allowedPays.has(payRaw) ? payRaw : null;

    const store = store_name?.trim() || null;

    const pp = Number(purchase_price);
    const sp = Number(selling_price);
    const rv = Number(revenue);

    if (Number.isNaN(pp) || Number.isNaN(sp) || Number.isNaN(rv)) {
      return NextResponse.json(
        { error: "purchase_price/selling_price/revenue must be numbers" },
        { status: 400 }
      );
    }

    // === Susun patch ===
    // HANYA set item_purchased jika kita punya nilai (hindari overwrite null/"")
    const patch: Record<string, any> = {
      id_product: id_product ?? null, // pastikan nama kolom cocok dengan DB
      // is_custom_item: !!is_custom_item, // aktifkan hanya jika kolom ini ADA di tabel
      date: dateOnly, // YYYY-MM-DD
      customer_name: customer_name?.trim() || null,
      store_name: store,
      payment_method: pay,
      purchase_price: pp,
      selling_price: sp,
      revenue: rv,
      notes: notes || "",
      month: derivedMonth,
      year: derivedYear,
      updated_at: new Date().toISOString(),
    };

    if (itemName) {
      patch.item_purchased = itemName;
    }

    // Buat patch lebih bersih: hapus key null/undefined kalau tabel kamu punya constraint NOT NULL
    // Object.keys(patch).forEach(k => patch[k] === undefined && delete patch[k]);

    // Siapkan query dasar
    const base = supabase.from("transactions");

    // Pastikan id cocok tipe (int vs uuid) dan tambahkan filter user_id
    const rawId = params.id;
    const asNumber = Number(rawId);
    const isNumericId = Number.isFinite(asNumber);

    const updQ = isNumericId
      ? base.update(patch).eq("id", asNumber).eq("user_id", user.id)
      : base.update(patch).eq("id", rawId).eq("user_id", user.id);

    const { data: transaction, error } = await updQ.select().single();

    if (error) {
      // Kembalikan detail supabase supaya tahu akar masalah
      console.error("Supabase update error:", error);
      return NextResponse.json(
        {
          error: error.message || "Failed to update transaction",
          details: error,
        },
        { status: 500 }
      );
    }
    if (!transaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ transaction });
  } catch (e: any) {
    console.error("Unexpected error:", e);
    return NextResponse.json(
      { error: e?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: { id: string } }
) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rawId = ctx.params.id;
  const asNumber = Number(rawId);
  const isNumericId = Number.isFinite(asNumber);

  const base = supabase.from("transactions");
  const updQ = isNumericId
    ? base
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", asNumber)
        .eq("user_id", user.id)
    : base
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", rawId)
        .eq("user_id", user.id);

  // CATATAN: butuh SELECT policy yang mengizinkan melihat row milik sendiri,
  // kalau Select policy menyembunyikan deleted_at IS NOT NULL, hapus .select("id") ini.
  const { data, error } = await updQ.select("id");

  if (error) {
    console.error("Soft delete failed:", error);
    return NextResponse.json(
      { error: "Failed to delete transaction" },
      { status: 500 }
    );
  }
  if (!data || data.length === 0) {
    return NextResponse.json(
      { error: "Not found or not allowed" },
      { status: 404 }
    );
  }

  return NextResponse.json({ deletedCount: data.length }, { status: 200 });
}
