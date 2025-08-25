"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
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

interface Product {
  id?: string;
  name: string;
  type: string;
  price: number;
  created_at?: string;
}

interface ProductsTableProps {
  products: Product[];
  onEdit: (product: Product) => void;
  onDelete: (id: string) => void;

  // sorting (opsional; bila diberikan → server-side sort)
  onSort?: (field: "name" | "type" | "price" | "created_at") => void;
  sortField?: "id" | "name" | "type" | "price" | "created_at";
  sortOrder?: "asc" | "desc";

  // loading
  isLoading?: boolean;

  // === pagination (server-side) ===
  serverMode?: boolean; // true → jangan filter/sort lokal
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (ps: number) => void;

  // search terkontrol (server-side)
  searchTerm?: string;
  onSearchChange?: (q: string) => void;
}

const TYPE_COLOR: Record<string, string> = {
  sharing: "default",
  "sharing 8u": "secondary",
  "sharing 4u": "secondary",
  "sharing 2u": "secondary",
  "sharing biasa": "secondary",
  "sharing antilimit": "destructive",
  private: "outline",
  edukasi: "default",
  sosmed: "secondary",
  google: "default",
  editing: "outline",
  music: "secondary",
};

function getTypeColor(type: string) {
  return (TYPE_COLOR[type] as any) || ("default" as any);
}

function LoadingRows({ rows = 8 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRow key={`skeleton-${i}`}>
          <TableCell className="w-[30%]">
            <Skeleton className="h-4 w-40" />
          </TableCell>
          <TableCell className="w-[20%]">
            <Skeleton className="h-6 w-24 rounded-full" />
          </TableCell>
          <TableCell className="text-right w-[15%]">
            <div className="flex justify-end">
              <Skeleton className="h-4 w-24" />
            </div>
          </TableCell>
          <TableCell className="w-[20%]">
            <Skeleton className="h-4 w-28" />
          </TableCell>
          <TableCell className="text-right w-[15%]">
            <div className="flex gap-2 justify-end">
              <Skeleton className="h-8 w-9 rounded-md" />
              <Skeleton className="h-8 w-9 rounded-md" />
            </div>
          </TableCell>
        </TableRow>
      ))}
    </>
  );
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
          <Skeleton className="h-4 w-28" />
        ) : (
          <>
            Page <span className="font-medium">{page}</span> of{" "}
            <span className="font-medium">{totalPages}</span>
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

/** Normalisasi & tokenisasi untuk pencarian multi-kata (AND) */
function normalize(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
// Mendukung frasa ber-kutip: "capcut sharing" 8u
function tokenize(q: string) {
  const parts = q.match(/"([^"]+)"|[^\s]+/g) || [];
  return parts.map((p) => normalize(p.replace(/^"|"$/g, ""))).filter(Boolean);
}

const DEBOUNCE_MS = 500;

export function ProductsTable(props: ProductsTableProps) {
  const {
    products,
    onEdit,
    onDelete,
    onSort,
    sortField,
    sortOrder,
    isLoading = false,
    serverMode = false,
    page = 1,
    pageSize = 10,
    total = 0,
    onPageChange,
    onPageSizeChange,
    searchTerm: controlledSearch = "",
    onSearchChange,
  } = props;

  const { t } = useLanguage();

  // ===== Search: pisahkan draft vs committed =====
  // Client mode (local filtering)
  const [localSearchDraft, setLocalSearchDraft] = useState("");
  const [localSearch, setLocalSearch] = useState("");

  // Server mode (parent handles searchTerm)
  const [serverSearchDraft, setServerSearchDraft] = useState(controlledSearch);
  useEffect(() => {
    setServerSearchDraft(controlledSearch ?? "");
  }, [controlledSearch]);

  // untuk mencegah panggilan API duplikat saat debounce
  const lastSentRef = useRef(controlledSearch ?? "");

  // Debounce: otomatis panggil API setelah user berhenti mengetik
  useEffect(() => {
    if (!serverMode) return;
    const handler = setTimeout(() => {
      if (serverSearchDraft !== lastSentRef.current) {
        onSearchChange?.(serverSearchDraft);
        lastSentRef.current = serverSearchDraft;
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(handler);
  }, [serverMode, serverSearchDraft, onSearchChange]);

  const activeSearch = serverMode ? controlledSearch ?? "" : localSearch;

  // ===== Sorting (fallback lokal) =====
  const [localSortField, setLocalSortField] = useState<
    "name" | "type" | "price" | "created_at" | undefined
  >(undefined);
  const [localSortOrder, setLocalSortOrder] = useState<"asc" | "desc">("asc");

  const effectiveSortField = serverMode
    ? sortField
    : sortField ?? localSortField;
  const effectiveSortOrder = serverMode
    ? sortOrder
    : sortOrder ?? localSortOrder;

  const handleSort = (field: "name" | "type" | "price" | "created_at") => {
    if (isLoading) return;
    if (onSort) return onSort(field);
    if (serverMode) return; // server: parent yang urus sort
    setLocalSortField((prev) => {
      if (prev === field) {
        setLocalSortOrder((o) => (o === "asc" ? "desc" : "asc"));
        return prev;
      }
      setLocalSortOrder("asc");
      return field;
    });
  };

  // ===== Data untuk render =====
  const viewData = useMemo(() => {
    if (serverMode) return products;

    const tokens = tokenize(activeSearch);
    const filtered =
      tokens.length === 0
        ? products
        : products.filter((p) => {
            const hay = normalize(`${p.name} ${p.type}`);
            return tokens.every((tok) => hay.includes(tok));
          });

    if (!effectiveSortField) return filtered;

    return [...filtered].sort((a, b) => {
      let aVal: string | number = "";
      let bVal: string | number = "";
      switch (effectiveSortField) {
        case "name":
        case "type": {
          aVal = (a as any)[effectiveSortField] || "";
          bVal = (b as any)[effectiveSortField] || "";
          const cmpStr = String(aVal).localeCompare(String(bVal), "id", {
            sensitivity: "base",
          });
          return effectiveSortOrder === "asc" ? cmpStr : -cmpStr;
        }
        case "price":
          aVal = a.price ?? 0;
          bVal = b.price ?? 0;
          return effectiveSortOrder === "asc"
            ? (aVal as number) - (bVal as number)
            : (bVal as number) - (aVal as number);
        case "created_at": {
          const ta = new Date(a.created_at ?? 0).getTime();
          const tb = new Date(b.created_at ?? 0).getTime();
          return effectiveSortOrder === "asc" ? ta - tb : tb - ta;
        }
        default:
          return 0;
      }
    });
  }, [
    products,
    activeSearch,
    serverMode,
    effectiveSortField,
    effectiveSortOrder,
  ]);

  const getSortIcon = (field: "name" | "type" | "price" | "created_at") => {
    if (!effectiveSortField || effectiveSortField !== field)
      return <ArrowUpDown className="h-4 w-4" />;
    return effectiveSortOrder === "asc" ? (
      <ArrowUp className="h-4 w-4" />
    ) : (
      <ArrowDown className="h-4 w-4" />
    );
  };

  const showEmptyState = !isLoading && viewData.length === 0;

  return (
    <Card aria-busy={isLoading}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {t("products")}
          {isLoading ? (
            <Skeleton className="h-5 w-12 rounded-full" />
          ) : (
            <Badge variant="secondary">{products.length}</Badge>
          )}
        </CardTitle>
        <CardDescription>{t("manageProducts")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 mb-4">
          {/* Search: ketik (draft) → auto debounce, atau klik Search/Enter untuk commit segera */}
          <form
            className="relative flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              if (serverMode) {
                onSearchChange?.(serverSearchDraft);
                lastSentRef.current = serverSearchDraft;
              } else {
                setLocalSearch(localSearchDraft);
              }
            }}
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={`${t("search")} ${t("products").toLowerCase()}...`}
              value={serverMode ? serverSearchDraft : localSearchDraft}
              onChange={(e) => {
                const v = e.target.value;
                if (serverMode) setServerSearchDraft(v);
                else setLocalSearchDraft(v);
              }}
              className="pl-10"
              disabled={isLoading}
            />
          </form>

          <Button
            onClick={() => {
              if (serverMode) {
                onSearchChange?.(serverSearchDraft);
                lastSentRef.current = serverSearchDraft;
              } else {
                setLocalSearch(localSearchDraft);
              }
            }}
            disabled={isLoading}
          >
            {t("search")}
          </Button>

          <Button
            variant="outline"
            onClick={() => {
              if (serverMode) {
                setServerSearchDraft("");
                onSearchChange?.("");
                lastSentRef.current = "";
              } else {
                setLocalSearchDraft("");
                setLocalSearch("");
              }
            }}
            disabled={isLoading}
          >
            Clear
          </Button>
        </div>

        {showEmptyState ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              {activeSearch ? t("noProductsSearch") : t("noProducts")}
            </p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => handleSort("name")}
                      className="h-auto p-0 font-semibold"
                      disabled={isLoading}
                    >
                      {t("productName")} {getSortIcon("name")}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => handleSort("type")}
                      className="h-auto p-0 font-semibold"
                      disabled={isLoading}
                    >
                      Type {getSortIcon("type")}
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">
                    <Button
                      variant="ghost"
                      onClick={() => handleSort("price")}
                      className="h-auto p-0 font-semibold"
                      disabled={isLoading}
                    >
                      {t("price")} {getSortIcon("price")}
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      onClick={() => handleSort("created_at")}
                      className="h-auto p-0 font-semibold"
                      disabled={isLoading}
                    >
                      {t("created")} {getSortIcon("created_at")}
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  <LoadingRows rows={pageSize || 8} />
                ) : (
                  viewData.map((product) => (
                    <TableRow key={product.id ?? product.name}>
                      <TableCell className="font-medium">
                        {product.name}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getTypeColor(product.type)}>
                          {product.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatRupiah(product.price)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {product.created_at
                          ? new Date(product.created_at).toLocaleDateString(
                              "id-ID"
                            )
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onEdit(product)}
                            disabled={isLoading}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onDelete(product.id || "")}
                            disabled={isLoading}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {/* Pagination footer (server mode only) */}
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
