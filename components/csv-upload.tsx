"use client";

import type React from "react";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { useLanguage } from "@/components/language-provider";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  FileText,
  AlertCircle,
  CheckCircle,
  Loader2,
  Download,
} from "lucide-react";
import { parseCSV, type CSVRow } from "@/lib/csv-parser";
import { findBestMatch, type ProductMatch } from "@/lib/fuzzy-match";
import { formatRupiah } from "@/lib/currency";

interface CSVUploadProps {
  onUploadComplete: () => void;
  onCancel: () => void;
}

interface ProcessedRow extends CSVRow {
  id: string;
  matchedProduct?: ProductMatch;
  selected: boolean;
}

type ProductApiRow = {
  id: string;
  name: string;
  price: number;
  type?: string;
  created_at?: string;
};

export function CSVUpload({ onUploadComplete, onCancel }: CSVUploadProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [csvData, setCsvData] = useState<ProcessedRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [products, setProducts] = useState<ProductMatch[]>([]);

  // OPTIONAL: preload products once (agar fuzzy match siap bahkan sebelum upload)
  useEffect(() => {
    void fetchProducts();
  }, []);

  // Fetch products for fuzzy matching
  const fetchProducts = async () => {
    try {
      // coba jalur cepat: API mendukung all=1
      const res = await fetch("/api/products?all=1", {
        credentials: "same-origin", // penting utk RLS
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const json: { products?: ProductApiRow[]; total?: number } =
        await res.json();

      let items: ProductApiRow[] = json.products ?? [];

      // fallback: kalau server masih paginate, ambil per halaman sampai habis
      if (!items.length && (json.total ?? 0) > 0) {
        const pageSize = 1000;
        items = [];
        for (let page = 1; ; page++) {
          const r = await fetch(
            `/api/products?page=${page}&pageSize=${pageSize}`,
            {
              credentials: "same-origin",
              headers: { Accept: "application/json" },
            }
          );
          if (!r.ok) break;
          const j: { products?: ProductApiRow[] } = await r.json();
          const chunk = j.products ?? [];
          if (chunk.length === 0) break;
          items.push(...chunk);
          if (chunk.length < pageSize) break;
        }
      }

      const list: ProductMatch[] = items.map((p) => ({
        id: p.id,
        name: p.name,
        price: Number(p.price) || 0,
      }));

      setProducts(list);
    } catch (err) {
      console.error("Error fetching products:", err);
    }
  };

  // Handle file drop
  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);

      const files = Array.from(e.dataTransfer.files);
      const csvFile = files.find(
        (file) =>
          file.type === "text/csv" ||
          file.name.toLowerCase().endsWith(".csv") ||
          file.type === "text/plain" // beberapa OS set ke text/plain
      );

      if (!csvFile) {
        toast({
          title: t("error"),
          description: t("invalidFile"),
          variant: "destructive",
        });
        return;
      }

      await processFile(csvFile);
    },
    [t, toast]
  );

  // Handle file input
  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  // Process CSV file
  const processFile = async (file: File) => {
    setIsProcessing(true);
    setErrors([]);

    try {
      // kalau preload belum selesai, tunggu sekali
      if (products.length === 0) {
        await fetchProducts();
      }

      const content = await file.text();
      const { data, errors: parseErrors } = parseCSV(content);

      if (parseErrors.length > 0) {
        setErrors(parseErrors);
        return;
      }

      const processedData: ProcessedRow[] = data.map((row, index) => {
        const mp = findBestMatch(row.itemPurchase, products) ?? undefined;
        return {
          ...row,
          id: `row-${index}`,
          matchedProduct: mp,
          selected: true,
        };
      });

      setCsvData(processedData);
    } catch (error) {
      console.error("Error processing file:", error);
      toast({
        title: t("error"),
        description: t("uploadError"),
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Toggle row selection
  const toggleRowSelection = (id: string) => {
    setCsvData((prev) =>
      prev.map((row) =>
        row.id === id ? { ...row, selected: !row.selected } : row
      )
    );
  };

  // Toggle all selections
  const toggleAllSelections = () => {
    const allSelected = csvData.every((row) => row.selected);
    setCsvData((prev) =>
      prev.map((row) => ({ ...row, selected: !allSelected }))
    );
  };

  // Upload selected transactions
  const handleUpload = async () => {
    const selectedRows = csvData.filter((row) => row.selected);

    if (selectedRows.length === 0) {
      toast({
        title: t("error"),
        description: "Please select at least one transaction to upload",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      const transactions = selectedRows.map((row) => {
        const transactionDate = new Date(row.date);
        const matchedProduct = row.matchedProduct;
        const sellingPrice = matchedProduct ? matchedProduct.price : 0;
        const purchasePrice = row.purchasePrice;
        const revenue = sellingPrice - purchasePrice;

        return {
          date: row.date,
          item_purchased: row.itemPurchase,
          customer_name: row.customerName,
          store_name: row.storeName,
          payment_method: row.paymentMethod,
          purchase_price: purchasePrice,
          selling_price: sellingPrice,
          product_id: matchedProduct ? matchedProduct.id : null,
          revenue: revenue,
          notes: row.notes,
          month: transactionDate.getMonth() + 1,
          year: transactionDate.getFullYear(),
        };
      });

      const response = await fetch("/api/transactions/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactions }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to upload transactions");
      }

      toast({
        title: t("success"),
        description: `${selectedRows.length} transactions uploaded successfully`,
      });

      onUploadComplete();
    } catch (error) {
      console.error("Error uploading transactions:", error);
      toast({
        title: t("error"),
        description: error instanceof Error ? error.message : t("uploadError"),
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const downloadTemplate = () => {
    // NOTE: gunakan angka polos (tanpa format rupiah) & kutip field teks
    const today = new Date().toISOString().slice(0, 10); // yyyy-mm-dd
    const template = `Date,Item Purchase,Customer Name,Store Name,Payment Method,Purchase,Notes
${today},"Wireless Headphones","John Smith","Tech Store Downtown","Credit Card",1125000,"Customer was very satisfied"
${today},"Coffee Mug","Sarah Johnson","Home Goods Plus","Cash",127500,"Part of a bulk order"`;

    const blob = new Blob([template], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "transaction_template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const selectedCount = csvData.filter((row) => row.selected).length;
  const totalAmount = csvData
    .filter((row) => row.selected)
    .reduce((sum, row) => sum + row.purchasePrice, 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            {t("csvUpload")}
          </CardTitle>
          <CardDescription>
            {t("bulkUpload")} transactions from CSV file
          </CardDescription>
        </CardHeader>
        <CardContent>
          {csvData.length === 0 ? (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={downloadTemplate}>
                  <Download className="mr-2 h-4 w-4" />
                  {t("downloadTemplate")}
                </Button>
              </div>

              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  isDragOver
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25"
                }`}
                onDrop={handleDrop}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
              >
                <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium mb-2">{t("dragDropCsv")}</p>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileInput}
                  className="hidden"
                  id="csv-upload"
                  disabled={isProcessing}
                />
                <label htmlFor="csv-upload">
                  <Button variant="outline" disabled={isProcessing} asChild>
                    <span>
                      {isProcessing && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      {isProcessing ? t("processing") : t("uploadFile")}
                    </span>
                  </Button>
                </label>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>{t("csvFormat")}:</strong> Date, Item Purchase,
                  Customer Name, Store Name, Payment Method, Purchase, Notes
                </AlertDescription>
              </Alert>

              {errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <ul className="list-disc list-inside space-y-1">
                      {errors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                    <div className="mt-2 text-sm">
                      Tips: Pastikan kolom <strong>Purchase</strong> berisi
                      angka polos (mis. <code>127500</code>) dan field teks yang
                      mengandung koma dibungkus tanda kutip <code>"..."</code>.
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Badge variant="secondary">
                    {selectedCount} of {csvData.length} selected
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Total: {formatRupiah(totalAmount)}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={onCancel}>
                    {t("cancel")}
                  </Button>
                  <Button
                    onClick={handleUpload}
                    disabled={isUploading || selectedCount === 0}
                  >
                    {isUploading && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {t("uploadFile")} ({selectedCount})
                  </Button>
                </div>
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={csvData.every((row) => row.selected)}
                          onCheckedChange={toggleAllSelections}
                        />
                      </TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Store</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead>Match</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">
                        Selling Price
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {csvData.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <Checkbox
                            checked={row.selected}
                            onCheckedChange={() => toggleRowSelection(row.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {row.itemPurchase}
                        </TableCell>
                        <TableCell>{row.customerName}</TableCell>
                        <TableCell>{row.storeName}</TableCell>
                        <TableCell>{row.paymentMethod}</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatRupiah(row.purchasePrice)}
                        </TableCell>
                        <TableCell>
                          {row.matchedProduct ? (
                            <div className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-green-600" />
                              <span className="text-sm">
                                {row.matchedProduct.name} (
                                {Math.round(
                                  (row.matchedProduct.similarity || 0) * 100
                                )}
                                %)
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <AlertCircle className="h-4 w-4 text-yellow-600" />
                              <span className="text-sm text-muted-foreground">
                                No match
                              </span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {new Date(row.date).toLocaleDateString("id-ID")}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {row.matchedProduct
                            ? formatRupiah(row.matchedProduct.price)
                            : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
