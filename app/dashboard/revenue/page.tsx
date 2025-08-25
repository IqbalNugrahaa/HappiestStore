"use client";

import { useState, useEffect } from "react";
import { useLanguage } from "@/components/language-provider";
import { TransactionForm } from "@/components/transaction-form";
import { TransactionsTable } from "@/components/transactions-table";
import { RevenueStats } from "@/components/revenue-stats";
import { CSVUpload } from "@/components/csv-upload";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Upload } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

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
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col items-center rounded-2xl border border-white/20 bg-white/60 p-4 backdrop-blur dark:border-white/10 dark:bg-white/5 lg:flex-row lg:justify-between">
        <div className="text-center lg:text-left">
          <h2 className="bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600 bg-clip-text text-2xl font-extrabold text-transparent">
            {t("revenueManagement")}
          </h2>
          <p className="text-muted-foreground">
            Track your revenue and transactions
          </p>
        </div>
        <div className="mt-4 flex gap-2 lg:mt-0">
          <Button
            variant="outline"
            className="border-indigo-200/60 hover:bg-indigo-50 dark:hover:bg-white/10"
            onClick={() => setShowCSVUpload(true)}
          >
            <Upload className="mr-2 h-4 w-4" />
            {t("csvUpload")}
          </Button>
          <Button
            className="bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600 text-white hover:opacity-90"
            onClick={() => setShowForm(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t("addTransaction")}
          </Button>
        </div>
      </div>

      {/* STATS */}
      <Card className="border-white/60 bg-white/70 backdrop-blur ring-1 ring-black/5 dark:border-white/10 dark:bg-white/5 dark:ring-white/10">
        <CardContent className="p-4 sm:p-6">
          <RevenueStats
            transactions={transactions}
            metrics={revMetrics ?? undefined}
            isLoading={loadingRevenue}
          />
        </CardContent>
      </Card>

      {/* TABLE */}
      <Card className="border-white/60 bg-white/70 backdrop-blur ring-1 ring-black/5 dark:border-white/10 dark:bg-white/5 dark:ring-white/10">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
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
          </div>
        </CardContent>
      </Card>

      {/* CSV Upload Modal */}
      <Dialog open={showCSVUpload} onOpenChange={setShowCSVUpload}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600 bg-clip-text text-transparent">
              CSV Upload
            </DialogTitle>
            <DialogDescription>
              Unggah file CSV dan cocokkan item secara otomatis.
            </DialogDescription>
          </DialogHeader>

          <CSVUpload
            onUploadComplete={() => {
              setShowCSVUpload(false);
              // kalau perlu refresh data, panggil di sini
              // refetchTransactions();
            }}
            onCancel={() => setShowCSVUpload(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Transaction Form Modal */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600 bg-clip-text text-transparent">
              {editingTransaction ? t("editTransaction") : t("addTransaction")}
            </DialogTitle>
            <DialogDescription>
              {editingTransaction
                ? "Perbarui informasi transaksi"
                : "Tambahkan transaksi baru"}
            </DialogDescription>
          </DialogHeader>

          <TransactionForm
            transaction={editingTransaction || undefined}
            onSubmit={async (payload) => {
              await handleSubmit(payload);
              setShowForm(false);
            }}
            onCancel={() => setShowForm(false)}
            isLoading={isSubmitting}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
