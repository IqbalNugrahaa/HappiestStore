"use client";

import { useState, useEffect } from "react";
import { useLanguage } from "@/components/language-provider";
import { DashboardHeader } from "@/components/dashboard-header";
import { TransactionForm } from "@/components/transaction-form";
import { TransactionsTable } from "@/components/transactions-table";
import { RevenueStats } from "@/components/revenue-stats";
import { CSVUpload } from "@/components/csv-upload";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Upload } from "lucide-react";

interface Transaction {
  id: string;
  date: string;
  item_purchased: string;
  customer_name?: string;
  store_name?: string;
  payment_method?: string;
  purchase_price?: number;
  selling_price: number;
  revenue?: number;
  notes?: string;
  month: number;
  year: number;
  created_at: string;
  updated_at: string;
}

/** Bentuk data dari /api/revenue */
type RevenueApiData = {
  totals: {
    totalRevenue: number;
    thisMonthRevenue: number;
    prevMonthRevenue: number;
  };
  averages?: {
    thisMonthAverageRevenue: number; // NEW
    prevMonthAverageRevenue: number; // NEW
  };
  byMethodAllTime?: {
    BCA: number;
    DANA: number;
    SPAY: number;
    QRIS: number;
  };
  byMethodThisMonth?: {
    BCA: number;
    DANA: number;
    SPAY: number;
    QRIS: number;
  };
};
export default function RevenuePage() {
  const { t, toggleLanguage, language } = useLanguage();
  const { toast } = useToast();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true); // loading untuk tabel transaksi
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showCSVUpload, setShowCSVUpload] = useState(false);
  const [editingTransaction, setEditingTransaction] =
    useState<Transaction | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);

  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [sortField, setSortField] = useState<string>("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // === NEW: state untuk /api/revenue ===
  const [revMetrics, setRevMetrics] = useState<RevenueApiData | null>(null);
  const [loadingRevenue, setLoadingRevenue] = useState(true);

  // Get available years from transactions
  const availableYears = Array.from(
    new Set(transactions.map((t) => t.year))
  ).sort((a, b) => b - a);

  // Fetch transactions with filters (tetap seperti sebelumnya)
  const fetchTransactions = async () => {
    try {
      const params = new URLSearchParams({
        sortBy: sortField,
        sortOrder: sortOrder,
        page: String(page),
        pageSize: String(pageSize),
      });
      if (selectedMonth !== "all") params.append("month", selectedMonth);
      if (selectedYear !== "all") params.append("year", selectedYear);

      const response = await fetch(`/api/transactions?${params}`);
      if (!response.ok) throw new Error("Failed to fetch transactions");

      const data = await response.json();
      setTransactions(data.transactions || data.data || []);
      setTotal(data.total ?? 0);
    } catch (error) {
      // (optional) tampilkan toast/log
    } finally {
      setIsLoading(false);
    }
  };

  // === NEW: fetch metrics dari /api/revenue (all-time & bulan berjalan) ===
  const fetchRevenue = async () => {
    setLoadingRevenue(true);
    try {
      const res = await fetch("/api/revenue", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to fetch revenue");
      setRevMetrics(json.data as RevenueApiData);
    } catch (e) {
      // (optional) tampilkan toast/log
    } finally {
      setLoadingRevenue(false);
    }
  };

  // Load transaksi (tergantung filter & pagination)
  useEffect(() => {
    setIsLoading(true);
    fetchTransactions();
  }, [selectedMonth, selectedYear, sortField, sortOrder, page, pageSize]);

  // Load metrics revenue (sekali saat mount)
  useEffect(() => {
    fetchRevenue();
  }, []);

  // Handle sorting
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  function normalizeForApi(tx: any) {
    const id_product = tx.id_product ?? null;
    const is_custom_item =
      typeof tx.is_custom_item === "boolean" ? tx.is_custom_item : !id_product;

    let item_purchase = tx.item_purchase ?? tx.item_purchased ?? "";

    let finalIsCustom = is_custom_item;
    if (!finalIsCustom && !id_product && !item_purchase) {
      finalIsCustom = true;
      item_purchase = "CUSTOM ITEM";
    }

    return {
      ...tx,
      id_product,
      is_custom_item: finalIsCustom,
      item_purchase,
    };
  }

  const handleSubmit = async (transactionData: Omit<Transaction, "id">) => {
    setIsSubmitting(true);
    try {
      const url = editingTransaction
        ? `/api/transactions/${editingTransaction.id}`
        : "/api/transactions";
      const method = editingTransaction ? "PUT" : "POST";

      const payload = normalizeForApi(transactionData);

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let msg = "Failed to save transaction";
        try {
          const err = await response.json();
          msg = err.error || msg;
          console.warn("Supabase details:", err.details);
        } catch {}
        throw new Error(msg);
      }

      toast({
        title: "Success",
        description: `Transaction ${
          editingTransaction ? "updated" : "created"
        } successfully`,
      });

      setShowForm(false);
      setEditingTransaction(null);
      await Promise.all([fetchTransactions(), fetchRevenue()]); // refresh keduanya
    } catch (error) {
      console.error("Error saving transaction:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to save transaction",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string | number) => {
    if (!confirm("Are you sure you want to delete this transaction?")) return;

    try {
      const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(payload?.error || "Failed to delete transaction");
      }

      setTransactions((prev) =>
        prev.filter((tx) => String(tx.id) !== String(id))
      );

      toast({
        title: "Success",
        description: `Transaction deleted${
          payload?.deletedCount ? ` (${payload.deletedCount})` : ""
        }`,
      });

      await Promise.all([fetchTransactions(), fetchRevenue()]);
    } catch (error) {
      console.error("Error deleting transaction:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to delete transaction",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setShowCSVUpload(false);
    setEditingTransaction(null);
  };

  const handleCSVUploadComplete = async () => {
    setShowCSVUpload(false);
    await Promise.all([fetchTransactions(), fetchRevenue()]);
  };

  return (
    <div className="flex flex-col h-full">
      <DashboardHeader
        title={t("revenue")}
        description="Track and manage your revenue transactions"
        onLanguageToggle={toggleLanguage}
        currentLanguage={language}
      />
      <div className="flex-1 p-6 space-y-6">
        {showForm ? (
          <TransactionForm
            transaction={editingTransaction || undefined}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isLoading={isSubmitting}
          />
        ) : showCSVUpload ? (
          <CSVUpload
            onUploadComplete={handleCSVUploadComplete}
            onCancel={handleCancel}
          />
        ) : (
          <>
            <div className="flex flex-col lg:flex-row lg:justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">{t("revenueManagement")}</h2>
                <p className="text-muted-foreground">
                  Track your revenue and transactions
                </p>
              </div>
              <div className="flex gap-2 mt-4 lg:mt-0">
                <Button
                  variant="outline"
                  onClick={() => setShowCSVUpload(true)}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {t("csvUpload")}
                </Button>
                <Button onClick={() => setShowForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t("addTransaction")}
                </Button>
              </div>
            </div>

            <div className="flex gap-4 items-center">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Month:</label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="1">January</SelectItem>
                    <SelectItem value="2">February</SelectItem>
                    <SelectItem value="3">March</SelectItem>
                    <SelectItem value="4">April</SelectItem>
                    <SelectItem value="5">May</SelectItem>
                    <SelectItem value="6">June</SelectItem>
                    <SelectItem value="7">July</SelectItem>
                    <SelectItem value="8">August</SelectItem>
                    <SelectItem value="9">September</SelectItem>
                    <SelectItem value="10">October</SelectItem>
                    <SelectItem value="11">November</SelectItem>
                    <SelectItem value="12">December</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Year:</label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {availableYears.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* === Revenue cards sekarang memakai metrics dari /api/revenue === */}
            <RevenueStats
              transactions={transactions}
              metrics={revMetrics ?? undefined}
              isLoading={loadingRevenue}
            />

            <TransactionsTable
              serverMode
              transactions={transactions}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onSort={handleSort}
              sortField={sortField}
              sortOrder={sortOrder}
              isLoading={isLoading}
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={(p) => setPage(Math.max(1, p))}
              onPageSizeChange={(ps) => {
                setPageSize(ps);
                setPage(1);
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
