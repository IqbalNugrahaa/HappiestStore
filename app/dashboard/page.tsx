"use client";

import { useLanguage } from "@/components/language-provider";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BarChart3, Package, CalendarDays } from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const { t } = useLanguage();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t("dashboard")}</h1>
        <p className="text-muted-foreground">
          Welcome to your revenue management system
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Revenue Management */}
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
              className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
            >
              View {t("revenue")}
            </Link>
          </CardContent>
        </Card>

        {/* Product Management */}
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
              className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
            >
              View {t("products")}
            </Link>
          </CardContent>
        </Card>

        {/* Revenue Month */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              {t("revenueMonth")}
            </CardTitle>
            <CardDescription>
              View monthly revenue statistics and insights
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/dashboard/revenue-month"
              className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
            >
              View {t("revenueMonth")}
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
