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

  useEffect(() => {
    void fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await fetch("/api/products?all=1", {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const json: { products?: ProductApiRow[]; total?: number } =
        await res.json();

      let items: ProductApiRow[] = json.products ?? [];
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

  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);

      const files = Array.from(e.dataTransfer.files);
      const csvFile = files.find(
        (file) =>
          file.type === "text/csv" ||
          file.name.toLowerCase().endsWith(".csv") ||
          file.type === "text/plain"
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

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processFile(file);
  };

  const processFile = async (file: File) => {
    setIsProcessing(true);
    setErrors([]);

    try {
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

  const toggleRowSelection = (id: string) => {
    setCsvData((prev) =>
      prev.map((row) =>
        row.id === id ? { ...row, selected: !row.selected } : row
      )
    );
  };

  const toggleAllSelections = () => {
    const allSelected = csvData.every((row) => row.selected);
    setCsvData((prev) =>
      prev.map((row) => ({ ...row, selected: !allSelected }))
    );
  };

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
          revenue,
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
    const today = new Date().toISOString().slice(0, 10);
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
    <div className="min-h-[80vh] w-full px-3 sm:px-6 py-4">
      <Card className="max-w-[1200px] mx-auto">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            {t("csvUpload")}
          </CardTitle>
          <CardDescription>
            {t("bulkUpload")} transactions from CSV file
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-0">
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
            <div className="space-y-3">
              {/* Toolbar sticky */}
              <div className="sticky -top-4 z-10 bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60 border rounded-md px-3 sm:px-4 py-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <Badge variant="secondary">
                    {selectedCount} of {csvData.length} selected
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Total: {formatRupiah(totalAmount)}
                  </span>
                </div>
                <div className="flex flex-col lg:flex-row gap-2">
                  <Button
                    variant="outline"
                    onClick={onCancel}
                    className="w-full md:w-auto"
                  >
                    {t("cancel")}
                  </Button>
                  <Button
                    onClick={handleUpload}
                    disabled={isUploading || selectedCount === 0}
                    className="w-full md:w-auto"
                  >
                    {isUploading && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {t("uploadFile")} ({selectedCount})
                  </Button>
                </div>
              </div>

              <div className="hidden md:block rounded-md border w-full overflow-hidden">
                {/* viewport: scroll Y & X di dalam dialog */}
                <div className="overflow-x-auto overflow-y-auto max-h-[60vh]">
                  <Table className="w-max min-w-[980px] table-auto">
                    {/* gunakan array agar tidak ada whitespace node di colgroup */}
                    <colgroup>
                      {[
                        44, // checkbox
                        360, // Item
                        160, // Customer
                        160, // Store
                        120, // Payment
                        120, // Price
                        320, // Match
                        120, // Date
                        120, // Selling
                      ].map((w, i) => (
                        <col key={i} style={{ width: `${w}px` }} />
                      ))}
                    </colgroup>

                    <TableHeader className="sticky top-0 z-[1] bg-background">
                      <TableRow>
                        <TableHead className="px-3 w-11">
                          <Checkbox
                            checked={csvData.every((row) => row.selected)}
                            onCheckedChange={toggleAllSelections}
                          />
                        </TableHead>
                        <TableHead className="px-3">Item</TableHead>
                        <TableHead className="px-3">Customer</TableHead>
                        <TableHead className="px-3">Store</TableHead>
                        <TableHead className="px-3">Payment</TableHead>
                        <TableHead className="px-3 text-right">Price</TableHead>
                        <TableHead className="px-3">Match</TableHead>
                        <TableHead className="px-3">Date</TableHead>
                        <TableHead className="px-3 text-right">
                          Selling
                        </TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {csvData.map((row) => (
                        <TableRow key={row.id} className="align-top">
                          <TableCell className="px-3">
                            <Checkbox
                              checked={row.selected}
                              onCheckedChange={() => toggleRowSelection(row.id)}
                            />
                          </TableCell>

                          <TableCell
                            className="px-3 font-medium truncate"
                            title={row.itemPurchase}
                          >
                            {row.itemPurchase}
                          </TableCell>
                          <TableCell
                            className="px-3 truncate"
                            title={row.customerName || ""}
                          >
                            {row.customerName}
                          </TableCell>
                          <TableCell
                            className="px-3 truncate"
                            title={row.storeName || ""}
                          >
                            {row.storeName}
                          </TableCell>
                          <TableCell className="px-3 whitespace-nowrap">
                            {row.paymentMethod}
                          </TableCell>
                          <TableCell className="px-3 text-right font-mono whitespace-nowrap">
                            {formatRupiah(row.purchasePrice)}
                          </TableCell>

                          <TableCell className="px-3">
                            {row.matchedProduct ? (
                              <div
                                className="flex items-center gap-2 truncate"
                                title={row.matchedProduct.name}
                              >
                                <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                                <span className="text-sm truncate">
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

                          <TableCell className="px-3 whitespace-nowrap">
                            {new Date(row.date).toLocaleDateString("id-ID")}
                          </TableCell>
                          <TableCell className="px-3 text-right font-mono whitespace-nowrap">
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

              {/* MOBILE: cards */}
              <div className="md:hidden">
                {/* viewport scroll khusus mobile */}
                <div className="space-y-3 overflow-y-auto max-h-[60vh] pr-1">
                  {csvData.map((row) => (
                    <div key={row.id} className="rounded-lg border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={row.selected}
                              onCheckedChange={() => toggleRowSelection(row.id)}
                            />
                            <p className="font-medium break-words">
                              {row.itemPurchase}
                            </p>
                          </div>

                          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                            <span className="text-muted-foreground">
                              Customer
                            </span>
                            <span className="truncate">
                              {row.customerName || "-"}
                            </span>

                            <span className="text-muted-foreground">Store</span>
                            <span className="truncate">
                              {row.storeName || "-"}
                            </span>

                            <span className="text-muted-foreground">
                              Payment
                            </span>
                            <span className="truncate">
                              {row.paymentMethod || "-"}
                            </span>

                            <span className="text-muted-foreground">Price</span>
                            <span className="font-mono">
                              {formatRupiah(row.purchasePrice)}
                            </span>

                            <span className="text-muted-foreground">Date</span>
                            <span>
                              {new Date(row.date).toLocaleDateString("id-ID")}
                            </span>

                            <span className="text-muted-foreground">
                              Selling
                            </span>
                            <span className="font-mono">
                              {row.matchedProduct
                                ? formatRupiah(row.matchedProduct.price)
                                : "-"}
                            </span>
                          </div>
                        </div>

                        <div className="shrink-0">
                          {row.matchedProduct ? (
                            <div className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                              <CheckCircle className="h-3 w-3" />
                              {Math.round(
                                (row.matchedProduct.similarity || 0) * 100
                              )}
                              %
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800">
                              <AlertCircle className="h-3 w-3" />
                              No match
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
