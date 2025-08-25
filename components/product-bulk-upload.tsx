"use client";

import type React from "react";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLanguage } from "@/components/language-provider";
import {
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  Loader2,
  Download,
} from "lucide-react";
import { formatCurrency } from "@/lib/currency";

interface ProductRow {
  name: string;
  type: string;
  price: number;
  isValid: boolean;
  errors: string[];
}

interface ProductBulkUploadProps {
  onUploadComplete: () => void;
}

/** ========= TYPE KANONIK =========
 * Semua pembandingan terhadap tipe produk dilakukan setelah normalisasi.
 * Tambahkan/ubah daftar ini sesuai kebutuhan backend.
 */
const CANONICAL_TYPES = [
  "SHARING",
  "SHARING 8U",
  "SHARING 4U",
  "SHARING 2U",
  "SHARING BIASA",
  "SHARING ANTILIMIT",
  "PRIVATE",
  "EDUKASI", // sinonim: EDUCATION, EDU
  "SOSMED", // sinonim: SOCMED
  "GOOGLE",
  "EDITING",
  "MUSIC",
  "FAMPLAN", // sinonim: FAMILY PLAN, FAM PLAN
  "INDPLAN", // sinonim: INDIVIDUAL PLAN, IND PLAN
] as const;

type CanonicalType = (typeof CANONICAL_TYPES)[number];

/** Normalisasi string untuk perbandingan “longgar”:
 * - buang diakritik
 * - uppercase
 * - rapikan spasi
 * - “4u/8u/2u” → “4U/8U/2U”
 */
function normalizeType(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b(\d)\s*U\b/g, (_, d) => `${d}U`) // "4 U" -> "4U"
    .replace(/\b(\d)\s*u\b/g, (_, d) => `${d}U`) // "4u" -> "4U"
    .replace(/\bu\s*(\d)\b/g, (_, d) => `${d}U`); // "u4" -> "4U" (jaga-jaga)
}

/** Sinonim umum → kanonik */
function canonicalizeType(raw: string): CanonicalType | null {
  const n = normalizeType(raw);

  const synonyms: Record<string, CanonicalType> = {
    EDUCATION: "EDUKASI",
    EDU: "EDUKASI",
    SOCMED: "SOSMED",
    "FAMILY PLAN": "FAMPLAN",
    "FAM PLAN": "FAMPLAN",
    "INDIVIDUAL PLAN": "INDPLAN",
    "IND PLAN": "INDPLAN",
  };

  if (synonyms[n]) return synonyms[n];

  for (const c of CANONICAL_TYPES) {
    if (normalizeType(c) === n) return c;
  }
  return null;
}

/** Parser CSV yang menghormati tanda kutip dan spasi.
 * Mendukung "" untuk escape tanda kutip di dalam field.
 */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++; // skip char berikutnya
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

/** Parser harga IDR yang toleran:
 * - "Rp1.499.850", "1,499,850", "81k" → number
 */
function parsePriceIDR(raw: string): number {
  let s = String(raw).trim().toLowerCase();
  const hasK = /k$/.test(s);
  s = s.replace(/[^\d]/g, "");
  if (!s) return NaN;
  let n = parseInt(s, 10);
  if (hasK) n *= 1000;
  return n;
}

export function ProductBulkUpload({
  onUploadComplete,
}: ProductBulkUploadProps) {
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedData, setParsedData] = useState<ProductRow[]>([]);
  const [uploadStatus, setUploadStatus] = useState<
    "idle" | "preview" | "uploading" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const validateProductRow = (
    name: string,
    type: string,
    price: number
  ): { isValid: boolean; errors: string[]; fixedType?: CanonicalType } => {
    const errors: string[] = [];
    let fixedType: CanonicalType | undefined;

    if (!name.trim()) errors.push("Product name is required");

    const canon = canonicalizeType(type);
    if (!canon) {
      errors.push(`Invalid product type: ${type}`);
    } else {
      fixedType = canon;
    }

    if (!Number.isFinite(price) || price <= 0) {
      errors.push("Price must be a positive number");
    }

    return { isValid: errors.length === 0, errors, fixedType };
  };

  function parseCSV(csvText: string): ProductRow[] {
    const rawLines = csvText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (rawLines.length === 0) return [];

    // Deteksi header "Name,Type,Price"
    let startIndex = 0;
    const head = splitCsvLine(rawLines[0]).map((f) =>
      f.replace(/^"|"$/g, "").trim().toLowerCase()
    );
    if (
      head.length >= 3 &&
      head[0] === "name" &&
      head[1] === "type" &&
      head[2] === "price"
    ) {
      startIndex = 1;
    }

    const products: ProductRow[] = [];

    for (let i = startIndex; i < rawLines.length; i++) {
      const fields = splitCsvLine(rawLines[i]);
      if (fields.length < 3) {
        products.push({
          name: rawLines[i],
          type: "",
          price: 0,
          isValid: false,
          errors: [
            `Invalid CSV format on line ${i + 1}. Expected: name,type,price`,
          ],
        });
        continue;
      }

      const [nameRaw, typeRaw, priceRaw] = fields
        .slice(0, 3)
        .map((f) => f.replace(/^"|"$/g, "").trim());

      const price = parsePriceIDR(priceRaw);
      const { isValid, errors, fixedType } = validateProductRow(
        nameRaw,
        typeRaw,
        price
      );

      products.push({
        name: nameRaw,
        type: fixedType ?? typeRaw, // tampilkan kanonik bila valid
        price,
        isValid,
        errors,
      });
    }

    return products;
  }

  const handleFileSelect = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setErrorMessage("Please select a CSV file");
      setUploadStatus("error");
      return;
    }

    setIsProcessing(true);
    setErrorMessage("");

    try {
      const text = await file.text();
      const parsed = parseCSV(text);
      setParsedData(parsed);
      setUploadStatus("preview");
    } catch {
      setErrorMessage("Failed to parse CSV file");
      setUploadStatus("error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleUpload = async () => {
    const validProducts = parsedData.filter((p) => p.isValid);
    if (validProducts.length === 0) return;

    setUploadStatus("uploading");
    setIsProcessing(true);

    try {
      const response = await fetch("/api/products/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products: validProducts }),
      });

      if (!response.ok) throw new Error("Upload failed");

      setUploadStatus("success");
      setTimeout(() => {
        onUploadComplete();
        resetUpload();
      }, 1500);
    } catch {
      setErrorMessage("Failed to upload products");
      setUploadStatus("error");
    } finally {
      setIsProcessing(false);
    }
  };

  const resetUpload = () => {
    setParsedData([]);
    setUploadStatus("idle");
    setErrorMessage("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Template CSV: pakai angka murni untuk kolom Price
  const downloadTemplate = () => {
    const template = `Name,Type,Price
Vidio Sharing 4u Mobile 1 Bulan,SHARING 4U,12000
CapCut Sharing 1 Bulan,SHARING,25000
Google Workspace,GOOGLE,150000`;

    const blob = new Blob([template], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "product_template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const validCount = parsedData.filter((p) => p.isValid).length;
  const invalidCount = parsedData.length - validCount;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          {t("bulkUploadProducts")}
        </CardTitle>
        <CardDescription>{t("productCsvFormat")}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {uploadStatus === "idle" && (
          <>
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="mr-2 h-4 w-4" />
                {t("downloadTemplate")}
              </Button>
            </div>

            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25"
              }`}
              onDrop={handleDrop}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
            >
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium mb-2">{t("dragDropCsv")}</p>
              <p className="text-sm text-muted-foreground mb-4">
                {t("productCsvFormat")}
              </p>
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
              >
                {isProcessing && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t("selectFile")}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileInput}
                className="hidden"
              />
            </div>
          </>
        )}

        {uploadStatus === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Badge variant="default">{validCount} Valid</Badge>
                {invalidCount > 0 && (
                  <Badge variant="destructive">{invalidCount} Invalid</Badge>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={resetUpload}>
                  Cancel
                </Button>
                <Button onClick={handleUpload} disabled={validCount === 0}>
                  Upload {validCount} Products
                </Button>
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto border rounded-lg">
              {parsedData.map((product, index) => (
                <div
                  key={index}
                  className={`p-3 border-b last:border-b-0 ${
                    product.isValid ? "bg-green-50" : "bg-red-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium">{product.name}</div>
                      <div className="text-sm text-muted-foreground">
                        Type: {product.type} • Price:{" "}
                        {Number.isFinite(product.price)
                          ? formatCurrency(product.price)
                          : "-"}
                      </div>
                    </div>
                    {product.isValid ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                  </div>
                  {!product.isValid && (
                    <div className="mt-2 text-sm text-red-600">
                      {product.errors.join(", ")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {uploadStatus === "uploading" && (
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>Uploading products...</p>
          </div>
        )}

        {uploadStatus === "success" && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Successfully uploaded {validCount} products!
            </AlertDescription>
          </Alert>
        )}

        {uploadStatus === "error" && errorMessage && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
