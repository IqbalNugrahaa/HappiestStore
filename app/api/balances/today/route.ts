// app/api/balances/today/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    // Ambil saldo terbaru (closing_*). Cron 03:00 WIB akan mengisi hari berjalan.
    const { data, error } = await supabase
      .from("balances_daily")
      .select("balance_date, opening_bca, opening_dana, opening_spay")
      .order("balance_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json(
        { error: "No balance rows found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      date: data.balance_date,
      bca: Number(data.opening_bca) || 0,
      dana: Number(data.opening_dana) || 0,
      spay: Number(data.opening_spay) || 0,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: String(e?.message || e) },
      { status: 500 }
    );
  }
}

/*
Catatan:
- Jika ingin strict "hari ini WIB", buat RPC di DB untuk today_jakarta()
  lalu filter .eq("balance_date", hasil RPC) atau gunakan
  .lte("balance_date", todayWIB) dan tetap order desc limit 1.
*/
