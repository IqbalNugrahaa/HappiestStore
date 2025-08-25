import { createClient } from "@/lib/supabase/server";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { transactions } = await request.json();
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json(
        { error: "Transactions array is required" },
        { status: 400 }
      );
    }

    // Helpers
    const toNumber = (v: unknown): number => {
      if (v == null) return 0;
      if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
      let s = String(v).trim().toLowerCase();

      // "250k" / "250rb"
      if (s.endsWith("k") || s.endsWith("rb")) {
        const n = Number.parseFloat(s.replace(/[^\d.]/g, ""));
        return Math.round(n * 1000);
      }

      // strip currency separators and non-digits
      s = s.replace(/[^\d-]/g, "");
      const n = Number.parseInt(s || "0", 10);
      return Number.isFinite(n) ? n : 0;
    };

    // Validasi minimal (hapus kewajiban customer_name & store_name)
    for (let i = 0; i < transactions.length; i++) {
      const t = transactions[i];
      const idx = `Transaction ${i + 1}`;

      if (!t?.date) {
        return NextResponse.json(
          { error: `${idx}: Transaction date is required` },
          { status: 400 }
        );
      }
      if (!t?.item_purchased || typeof t.item_purchased !== "string") {
        return NextResponse.json(
          { error: `${idx}: Item purchase is required` },
          { status: 400 }
        );
      }
      if (t?.payment_method != null && typeof t.payment_method !== "string") {
        return NextResponse.json(
          { error: `${idx}: Payment Method must be a string` },
          { status: 400 }
        );
      }
      const purchase = toNumber(t.purchase_price ?? t.unit_price);
      if (!Number.isFinite(purchase) || purchase < 0) {
        return NextResponse.json(
          { error: `${idx}: Valid purchase price is required` },
          { status: 400 }
        );
      }
    }

    // Mapping ke kolom DB — pastikan cocok dengan skema:
    // transactions(date timestamptz, product_id uuid/int8, item_purchased text,
    // customer_name text null, store_name text null, payment_method text null,
    // purchase_price bigint not null, selling_price bigint null, notes text null,
    // month int not null, year int not null, revenue bigint not null)
    const rows = transactions
      .map((t: any) => {
        const d = new Date(t.date);
        const isValidDate = !isNaN(d.getTime());

        const purchase_price = toNumber(t.purchase_price ?? t.unit_price);
        const selling_price = toNumber(t.selling_price ?? t.total_amount);

        // month/year sebagai angka (bukan teks)
        const month =
          typeof t.month === "number" && t.month >= 1 && t.month <= 12
            ? t.month
            : isValidDate
            ? d.getMonth() + 1
            : null;
        const year =
          typeof t.year === "number" && t.year > 0
            ? t.year
            : isValidDate
            ? d.getFullYear()
            : null;

        // Ambil product_id dari client (dukung kedua nama)
        const product_id = t.product_id ?? t.id_product ?? null;

        return {
          date: isValidDate ? d.toISOString() : null,
          id_product: product_id, // ⟵ pastikan ini sesuai nama kolom FK di DB
          item_purchased: String(t.item_purchased || "").trim() || null,
          customer_name:
            typeof t.customer_name === "string"
              ? t.customer_name.trim() || null
              : null,
          store_name:
            typeof t.store_name === "string"
              ? t.store_name.trim() || null
              : null,
          payment_method:
            typeof t.payment_method === "string"
              ? t.payment_method.trim() || null
              : null,
          purchase_price: purchase_price ?? 0,
          selling_price: Number.isFinite(selling_price) ? selling_price : null,
          notes: typeof t.notes === "string" ? t.notes.trim() || null : null,
          month,
          year,
          revenue:
            Number.isFinite(selling_price) && Number.isFinite(purchase_price)
              ? selling_price - purchase_price
              : 0,
        };
      })
      // drop baris yang benar-benar kosong
      .filter(
        (r) =>
          r.item_purchased ||
          (r.selling_price != null && r.selling_price !== 0) ||
          (r.purchase_price != null && r.purchase_price !== 0)
      );

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No valid rows to insert" },
        { status: 400 }
      );
    }

    const { data: inserted, error } = await supabase
      .from("transactions")
      .insert(rows)
      .select();

    if (error) {
      // KEMBALIKAN PESAN ASLI BIAR JELAS
      return NextResponse.json(
        { error: `Supabase insert error: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { transactions: inserted, count: inserted?.length || 0 },
      { status: 201 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Internal server error" },
      { status: 500 }
    );
  }
}
