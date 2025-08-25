"use client";

import { useLanguage } from "@/components/language-provider";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { formatRupiah } from "@/lib/currency";
import {
  BarChart3,
  Package,
  TrendingUp,
  DollarSign,
  TrendingDown,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

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

interface Product {
  id: string;
  name: string;
  type: string;
  price: number;
  created_at: string;
}

/* ===== Utils: revenue & growth ===== */
function sumRevenue(transactions: Transaction[]): number {
  return transactions.reduce((s, t) => s + (t.revenue ?? 0), 0);
}

function revenueByMonthYear(
  transactions: Transaction[],
  monthIndex: number, // 0-11
  year: number
): number {
  return transactions.reduce((s, t) => {
    const d = new Date(t.date);
    return d.getMonth() === monthIndex && d.getFullYear() === year
      ? s + (t.revenue ?? 0)
      : s;
  }, 0);
}

function previousMonthYear(monthIndex: number, year: number) {
  // monthIndex: 0..11
  if (monthIndex === 0) return { month: 11, year: year - 1 };
  return { month: monthIndex - 1, year };
}

function calcGrowth(current: number, previous: number) {
  // Hindari divide-by-zero; tandai apakah ada baseline
  const hasBaseline = previous > 0;
  const percent = hasBaseline ? ((current - previous) / previous) * 100 : 0;
  const delta = current - previous;
  const isPositive = percent >= 0; // arah tren
  return { percent, delta, isPositive, hasBaseline };
}
/* =================================== */

export default function DashboardPage() {
  const { t } = useLanguage();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingRevenue, setIsLoadingRevenue] = useState(true);
  const [isLoadingProduct, setIsLoadingProduct] = useState(true);

  const fetchTransactions = async () => {
    try {
      const res = await fetch(`/api/transactions`);
      if (!res.ok) throw new Error("Failed to fetch transactions");
      const data = await res.json();
      setTransactions(data.transactions || []);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      toast({
        title: "Error",
        description: "Failed to load transactions",
        variant: "destructive",
      });
    } finally {
      setIsLoadingRevenue(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error("Failed to fetch products");
      const data = await res.json();
      setProducts(data.products || []);
    } catch (error) {
      console.error("Error fetching products:", error);
      toast({
        title: "Error",
        description: "Failed to load products",
        variant: "destructive",
      });
    } finally {
      setIsLoadingProduct(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
    fetchProducts();
  }, []);

  // === Skeletons (Shimmer) ===
  const StatCardSkeleton = () => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-4 rounded-full" />
      </CardHeader>
      <CardContent className="space-y-2">
        <Skeleton className="h-7 w-32" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-3 w-24" />
        </div>
      </CardContent>
    </Card>
  );

  const ActionCardSkeleton = () => (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded-full" />
          <Skeleton className="h-5 w-48" />
        </div>
        <Skeleton className="h-4 w-64" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-10 w-28 rounded-md" />
      </CardContent>
    </Card>
  );

  if (isLoadingRevenue) {
    return (
      <div className="p-6 space-y-6" aria-busy>
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-2 h-4 w-80" />
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <ActionCardSkeleton />
          <ActionCardSkeleton />
        </div>
      </div>
    );
  }
  // === End Skeletons ===

  // === Perhitungan menggunakan utils ===
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const { month: prevMonth, year: prevYear } = previousMonthYear(
    currentMonth,
    currentYear
  );

  const currentMonthRevenue = revenueByMonthYear(
    transactions,
    currentMonth,
    currentYear
  );
  const prevMonthRevenue = revenueByMonthYear(
    transactions,
    prevMonth,
    prevYear
  );

  const growth = calcGrowth(currentMonthRevenue, prevMonthRevenue);
  const isPositiveGrowth = growth.isPositive;

  const totalRevenue = sumRevenue(transactions);
  const avgTransactionValue =
    transactions.length > 0 ? totalRevenue / transactions.length : 0;
  // =====================================

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("dashboard")}</h1>
        <p className="text-muted-foreground">
          Welcome to your revenue management system
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Revenue */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatRupiah(totalRevenue || 0)}
            </div>
            <div className="mt-3 flex gap-3 items-center">
              {isPositiveGrowth ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
              <p
                className={`text-xs ${
                  isPositiveGrowth ? "text-green-600" : "text-red-600"
                }`}
              >
                {t(isPositiveGrowth ? "positiveGrowth" : "negativeGrowth", {
                  percent: Math.abs(growth.percent).toFixed(1),
                })}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Products */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{products.length}</div>
            <p className="pt-3 text-xs text-muted-foreground">
              Active products
            </p>
          </CardContent>
        </Card>

        {/* Transactions (contoh sederhana) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transactions</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{transactions.length}</div>
            <p className="pt-3 text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>

        {/* Growth card (dinamis) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Growth</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                isPositiveGrowth ? "text-green-600" : "text-red-600"
              }`}
            >
              {(growth.isPositive ? "+" : "") + growth.percent.toFixed(1) + "%"}
            </div>
            <p className="pt-3 text-xs text-muted-foreground">
              {growth.hasBaseline
                ? `${formatRupiah(Math.abs(growth.delta))} vs last month`
                : "No baseline last month"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              {t("revenueManagement")}
            </CardTitle>
            <CardDescription>
              Track and manage your revenue transactions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/dashboard/revenue"
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
            >
              View {t("revenue")}
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              {t("productManagement")}
            </CardTitle>
            <CardDescription>
              Add and manage your product catalog
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/dashboard/products"
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
            >
              View {t("products")}
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
