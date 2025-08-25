import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { products } = await request.json()

    if (!Array.isArray(products) || products.length === 0) {
      return NextResponse.json({ error: "Invalid products data" }, { status: 400 })
    }

    // Validate each product
    const validProducts = products.filter(
      (product) => product.name && product.type && typeof product.price === "number" && product.price > 0,
    )

    if (validProducts.length === 0) {
      return NextResponse.json({ error: "No valid products to upload" }, { status: 400 })
    }

    // Insert products in bulk
    const { data, error } = await supabase
      .from("products")
      .insert(
        validProducts.map((product) => ({
          name: product.name,
          type: product.type,
          price: product.price,
        })),
      )
      .select()

    if (error) {
      console.error("Database error:", error)
      return NextResponse.json({ error: "Failed to create products" }, { status: 500 })
    }

    return NextResponse.json({
      message: `Successfully uploaded ${data.length} products`,
      products: data,
    })
  } catch (error) {
    console.error("Bulk upload error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
