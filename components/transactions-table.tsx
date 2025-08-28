"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatRupiah } from "@/lib/currency";
import { useLanguage } from "@/components/language-provider";
import {
  Edit,
  Trash2,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

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

interface TransactionsTableProps {
  transactions: Transaction[];
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
  onSort: (field: string) => void;
  sortField?: string;
  sortOrder?: "asc" | "desc";
  isLoading?: boolean;

  // ---- pagination (server-side) ----
  serverMode?: boolean;
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
}

function PaginationBar({
  page = 1,
  pageSize = 10,
  total = 0,
  isLoading,
  onPageChange,
  onPageSizeChange,
}: {
  page?: number;
  pageSize?: number;
  total?: number;
  isLoading?: boolean;
  onPageChange?: (p: number) => void;
  onPageSizeChange?: (ps: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil((total ?? 0) / (pageSize || 1)));
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <div className="flex items-center justify-between p-3">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Rows/page</span>
        <select
          className="h-9 rounded-md border bg-background px-2 text-sm"
          value={pageSize}
          onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
          disabled={isLoading}
        >
          {[5, 10, 20, 50].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      <div className="text-sm text-muted-foreground">
        {isLoading ? (
          "Loading…"
        ) : (
          <>
            {/* Desktop: Page 1 of 15 */}
            <span className="hidden md:inline">
              Page <span className="font-medium">{page}</span> of{" "}
              <span className="font-medium">{totalPages}</span>
            </span>

            {/* Mobile: 1/15 */}
            <span className="inline md:hidden">
              <span className="font-medium">{page}</span>/
              <span className="font-medium">{totalPages}</span>
            </span>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange?.(page - 1)}
          disabled={isLoading || !canPrev}
        >
          Prev
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange?.(page + 1)}
          disabled={isLoading || !canNext}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

export function TransactionsTable({
  transactions,
  onEdit,
  onDelete,
  onSort,
  sortField,
  sortOrder,
  isLoading,
  serverMode = true,
  page = 1,
  pageSize = 10,
  total = 0,
  onPageChange,
  onPageSizeChange,
}: TransactionsTableProps) {
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState("");

  const filtered = useMemo(() => {
    // serverMode: biasanya filter/search ditangani backend
    // tapi kita tetap filter lokal agar UX enak (opsional)
    const base = transactions;
    if (!searchTerm) return base;
    return base.filter(
      (tx) =>
        tx.item_purchased.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tx.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tx.store_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [transactions, searchTerm]);

  const getSortIcon = (field: string) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4" />;
    return sortOrder === "asc" ? (
      <ArrowUp className="h-4 w-4" />
    ) : (
      <ArrowDown className="h-4 w-4" />
    );
  };

  const empty = !isLoading && filtered.length === 0;

  return (
    <Card>
      <CardContent>
        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={`${t("search")} ${t(
                "transactions"
              ).toLowerCase()}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              disabled={isLoading}
            />
          </div>
        </div>

        {empty ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              {searchTerm ? t("noTransactionsSearch") : t("noTransactions")}
            </p>
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => onSort("date")}
                      className="h-auto p-0 font-semibold"
                      disabled={isLoading}
                    >
                      Date {getSortIcon("date")}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => onSort("item_purchased")}
                      className="h-auto p-0 font-semibold"
                      disabled={isLoading}
                    >
                      Item {getSortIcon("item_purchased")}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => onSort("customer_name")}
                      className="h-auto p-0 font-semibold"
                      disabled={isLoading}
                    >
                      Customer {getSortIcon("customer_name")}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => onSort("store_name")}
                      className="h-auto p-0 font-semibold"
                      disabled={isLoading}
                    >
                      Store {getSortIcon("store_name")}
                    </Button>
                  </TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead className="text-right">
                    <Button
                      variant="ghost"
                      onClick={() => onSort("purchase_price")}
                      className="h-auto p-0 font-semibold"
                      disabled={isLoading}
                    >
                      Purchase {getSortIcon("purchase_price")}
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">
                    <Button
                      variant="ghost"
                      onClick={() => onSort("selling_price")}
                      className="h-auto p-0 font-semibold"
                      disabled={isLoading}
                    >
                      Selling {getSortIcon("selling_price")}
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">
                    <Button
                      variant="ghost"
                      onClick={() => onSort("revenue")}
                      className="h-auto p-0 font-semibold"
                      disabled={isLoading}
                    >
                      Revenue {getSortIcon("revenue")}
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="text-muted-foreground">
                      {new Date(tx.date).toLocaleDateString("id-ID")}
                    </TableCell>
                    <TableCell className="font-medium">
                      {tx.item_purchased}
                    </TableCell>
                    <TableCell>{tx.customer_name || "-"}</TableCell>
                    <TableCell>{tx.store_name || "-"}</TableCell>
                    <TableCell>
                      {tx.payment_method ? (
                        <Badge variant="outline">{tx.payment_method}</Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {tx.purchase_price != null
                        ? formatRupiah(tx.purchase_price)
                        : formatRupiah(0)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatRupiah(tx.selling_price)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {formatRupiah(tx.revenue || 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            onEdit(tx);
                            window.dispatchEvent(new Event("dash:collapse"));
                          }}
                          disabled={isLoading}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onDelete(tx.id)}
                          disabled={isLoading}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Footer pagination */}
            {serverMode && (
              <PaginationBar
                page={page}
                pageSize={pageSize}
                total={total}
                isLoading={isLoading}
                onPageChange={onPageChange}
                onPageSizeChange={onPageSizeChange}
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
