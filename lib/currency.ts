// Utility functions for Rupiah currency formatting
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function parseRupiah(value: string): number {
  // Remove all non-digit characters except decimal point
  const cleanValue = value
    .replace(/[^\d.,]/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
  return Number.parseFloat(cleanValue) || 0
}

export function formatRupiahInput(value: string): string {
  const number = parseRupiah(value)
  if (isNaN(number)) return ""

  return new Intl.NumberFormat("id-ID").format(number)
}

export const formatCurrency = formatRupiah
