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
import Swal from "sweetalert2";

/** NEW: valid store names (DB NOT NULL) */
const CANONICAL_STORES = ["HAPPIEST STORE", "BB STORE"] as const;
type CanonicalStore = (typeof CANONICAL_STORES)[number];

interface ProductRow {
  name: string;
  type: string;
  price: number;
  store: CanonicalStore | string; // string to show raw value if invalid
  isValid: boolean;
  errors: string[];
}

interface ProductBulkUploadProps {
  onUploadComplete: () => void;
}

/** ========= TYPE KANONIK ========= */
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

function normalizeUpper(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeType(raw: string): string {
  return normalizeUpper(raw)
    .replace(/\b(\d)\s*U\b/g, (_, d) => `${d}U`)
    .replace(/\b(\d)\s*u\b/g, (_, d) => `${d}U`)
    .replace(/\bu\s*(\d)\b/g, (_, d) => `${d}U`);
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
  for (const c of CANONICAL_TYPES) if (normalizeType(c) === n) return c;
  return null;
}

/** Store → kanonik */
function canonicalizeStore(raw: string): CanonicalStore | null {
  const n = normalizeUpper(raw);
  for (const s of CANONICAL_STORES) if (normalizeUpper(s) === n) return s;
  return null;
}

/** Parser CSV yang menghormati tanda kutip dan spasi. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

/** Parser harga IDR: "Rp1.499.850", "1,499,850", "81k" → number */
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
    price: number,
    store: string
  ): {
    isValid: boolean;
    errors: string[];
    fixedType?: CanonicalType;
    fixedStore?: CanonicalStore;
  } => {
    const errors: string[] = [];
    let fixedType: CanonicalType | undefined;
    let fixedStore: CanonicalStore | undefined;

    if (!name.trim()) errors.push("Product name is required");

    const canonType = canonicalizeType(type);
    if (!canonType) errors.push(`Invalid product type: ${type}`);
    else fixedType = canonType;

    if (!Number.isFinite(price) || price <= 0) {
      errors.push("Price must be a positive number");
    }

    const canonStore = canonicalizeStore(store);
    if (!canonStore)
      errors.push(`Invalid store: ${store}. Use HAPPIEST STORE or BB STORE`);
    else fixedStore = canonStore;

    return { isValid: errors.length === 0, errors, fixedType, fixedStore };
  };

  function parseCSV(csvText: string): ProductRow[] {
    const rawLines = csvText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (rawLines.length === 0) return [];

    // NEW: Detect header Name,Type,Price,Store (order required)
    let startIndex = 0;
    const head = splitCsvLine(rawLines[0]).map((f) =>
      f.replace(/^"|"$/g, "").trim().toLowerCase()
    );
    const hasHeader =
      head.length >= 4 &&
      head[0] === "name" &&
      head[1] === "type" &&
      head[2] === "price" &&
      head[3] === "store";
    if (hasHeader) startIndex = 1;

    const products: ProductRow[] = [];
    for (let i = startIndex; i < rawLines.length; i++) {
      const fields = splitCsvLine(rawLines[i]);
      if (fields.length < 4) {
        products.push({
          name: rawLines[i],
          type: "",
          price: 0,
          store: "",
          isValid: false,
          errors: [
            `Invalid CSV format on line ${
              i + 1
            }. Expected: name,type,price,store`,
          ],
        });
        continue;
      }

      const [nameRaw, typeRaw, priceRaw, storeRaw] = fields
        .slice(0, 4)
        .map((f) => f.replace(/^"|"$/g, "").trim());

      const price = parsePriceIDR(priceRaw);
      const { isValid, errors, fixedType, fixedStore } = validateProductRow(
        nameRaw,
        typeRaw,
        price,
        storeRaw
      );

      products.push({
        name: nameRaw,
        type: fixedType ?? typeRaw,
        price,
        store: fixedStore ?? normalizeUpper(storeRaw),
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

    if (validProducts.length === 0) {
      await Swal.fire({
        icon: "warning",
        title: "Tidak ada baris valid",
        text: "Periksa kembali CSV kamu. Pastikan kolom Name, Type, Price, dan Store terisi benar.",
        confirmButtonText: "OK",
      });
      return;
    }

    setUploadStatus("uploading");
    setIsProcessing(true);

    try {
      const response = await fetch("/api/products/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          products: validProducts.map((p) => ({
            name: p.name,
            type: p.type, // sudah canonical upper
            price: p.price,
            store: p.store, // NEW
          })),
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        // Tampilkan pesan error detail dari server jika ada
        const errorMsg =
          payload?.details ||
          payload?.error ||
          `Upload gagal (status ${response.status}).`;
        throw new Error(errorMsg);
      }

      const inserted = Number(payload?.insertedCount ?? 0);
      const invalid = Number(payload?.invalidCount ?? 0);
      const skipped = Number(payload?.skippedAsDuplicateOrIgnored ?? 0);

      setUploadStatus("success");

      await Swal.fire({
        icon: "success",
        title: "Upload berhasil",
        html: `
        <div style="text-align:left">
          <div><b>Diproses</b>: ${validProducts.length}</div>
          <div><b>Berhasil insert</b>: ${inserted}</div>
          ${
            skipped
              ? `<div><b>Terlewati (duplikat/diabaikan)</b>: ${skipped}</div>`
              : ""
          }
          ${invalid ? `<div><b>Baris invalid</b>: ${invalid}</div>` : ""}
        </div>
      `,
        confirmButtonText: "Tutup",
      });

      // refresh & reset setelah user menutup alert
      onUploadComplete();
      resetUpload();
    } catch (e) {
      console.error(e);
      const msg = "Failed to upload products";
      setErrorMessage(msg);
      setUploadStatus("error");

      await Swal.fire({
        icon: "error",
        title: "Upload gagal",
        text: msg,
        confirmButtonText: "Tutup",
      });
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

  // NEW: Template CSV now includes Store column with sample values
  const downloadTemplate = () => {
    const template = `Name,Type,Price,Store\nVidio Sharing 4u Mobile 1 Bulan,SHARING 4U,12000,HAPPIEST STORE\nCapCut Sharing 1 Bulan,SHARING,25000,BB STORE\nGoogle Workspace,GOOGLE,150000,HAPPIEST STORE`;
    const blob = new Blob([template], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "product_template_with_store.csv";
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
        <CardDescription>
          Format: <code>Name, Type, Price, Store</code> — Store wajib: "HAPPIEST
          STORE" atau "BB STORE".
        </CardDescription>
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
                Name, Type, Price, Store
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
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="font-medium">{product.name}</div>
                      <div className="text-sm text-muted-foreground">
                        Type: {product.type} • Price:{" "}
                        {Number.isFinite(product.price)
                          ? formatCurrency(product.price)
                          : "-"}{" "}
                        • Store: {product.store}
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
