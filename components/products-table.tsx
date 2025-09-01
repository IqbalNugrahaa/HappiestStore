"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Pencil, Trash2, ChevronUp, ChevronDown } from "lucide-react";

export interface Product {
  id?: string;
  name: string;
  type: string;
  price: number;
  store: string;
  created_at?: string;
}

type SortOrder = "asc" | "desc";

interface ProductsTableProps {
  serverMode?: boolean;
  products: Product[];
  isLoading?: boolean;

  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;

  searchTerm?: string;
  onSearchChange?: (q: string) => void;
  sortField?: keyof Product | "created_at";
  sortOrder?: SortOrder;
  onSort?: (field: keyof Product | "created_at") => void;

  onEdit?: (p: Product) => void;
  onDelete?: (id: string) => void;
}

/** Badge warna per store; baris tetap putih */
function storeBadge(store: string) {
  switch ((store || "").toLowerCase()) {
    case "happiest store":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200";
    case "bb store":
      return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200";
    default:
      return "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200";
  }
}

export function ProductsTable({
  serverMode = true,
  products,
  isLoading,
  page = 1,
  pageSize = 10,
  total = 0,
  onPageChange,
  onPageSizeChange,
  searchTerm = "",
  onSearchChange,
  sortField = "created_at",
  sortOrder = "desc",
  onSort,
  onEdit,
  onDelete,
}: ProductsTableProps) {
  const pages = Math.max(1, Math.ceil((total || 0) / (pageSize || 10)));

  /** ===== Fallback client-side sorting (dipakai jika onSort tidak disediakan) ===== */
  const [localSortField, setLocalSortField] = React.useState<
    keyof Product | "created_at"
  >("created_at");
  const [localSortOrder, setLocalSortOrder] = React.useState<SortOrder>("desc");

  function toggleLocalSort(field: keyof Product | "created_at") {
    if (localSortField === field) {
      setLocalSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setLocalSortField(field);
      // default arah awal: text asc, number desc (boleh kamu ubah)
      setLocalSortOrder(field === "price" ? "desc" : "asc");
    }
  }

  // field & order yang dipakai UI (server-first; fallback lokal)
  const effectiveSortField = onSort ? sortField : localSortField;
  const effectiveSortOrder = onSort ? sortOrder : localSortOrder;

  // data yang ditampilkan (apply client sort hanya bila tidak ada onSort)
  const displayed = React.useMemo(() => {
    if (!products) return [];
    const arr = [...products];

    if (!onSort) {
      switch (effectiveSortField) {
        case "name":
          arr.sort((a, b) =>
            (a.name ?? "").localeCompare(b.name ?? "", "id", {
              sensitivity: "base",
            })
          );
          break;
        case "store":
          arr.sort((a, b) =>
            (a.store ?? "").localeCompare(b.store ?? "", "id", {
              sensitivity: "base",
            })
          );
          break;
        case "price":
          arr.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
          break;
        default:
          // biarkan untuk created_at / type (server yang handle)
          break;
      }
      if (
        effectiveSortOrder === "desc" &&
        ["name", "price", "store"].includes(String(effectiveSortField))
      ) {
        arr.reverse();
      }
    }

    return arr;
  }, [products, onSort, effectiveSortField, effectiveSortOrder]);

  /** ===== Header cell dengan ikon sort ===== */
  const headerCell = (
    key: keyof Product | "created_at",
    label: string,
    className = ""
  ) => {
    const active = effectiveSortField === key;
    let Icon: React.ReactNode = (
      <span className="select-none text-xs opacity-40">⇅</span>
    );
    if (active) {
      Icon =
        effectiveSortOrder === "asc" ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        );
    }

    const handleClick = () => {
      if (onSort) onSort(key);
      else toggleLocalSort(key);
    };

    return (
      <th className={`whitespace-nowrap px-3 py-2 text-left ${className}`}>
        <button
          type="button"
          className={`inline-flex items-center gap-1 ${
            active ? "font-semibold" : "font-medium"
          }`}
          onClick={handleClick}
          title="Sort"
        >
          {label}
          {Icon}
        </button>
      </th>
    );
  };

  function formatDDMMMYYYY(iso?: string) {
    if (!iso) return "-";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "-";
    const dd = String(d.getDate()).padStart(2, "0");
    const mmm = d.toLocaleString("en-US", { month: "short" }).toUpperCase(); // SEP
    const yyyy = d.getFullYear();
    return `${dd} ${mmm} ${yyyy}`;
  }

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {onSearchChange && (
          <Input
            value={searchTerm}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder="Search products..."
            className="w-64"
          />
        )}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/30 bg-white/70 backdrop-blur dark:border-white/10 dark:bg-white/5">
        <table className="min-w-full text-sm">
          <thead className="bg-black/5 text-xs uppercase tracking-wide dark:bg-white/5">
            <tr>
              {headerCell("name", "Product")}
              {headerCell("type", "Type")}
              {headerCell("price", "Price")}
              {headerCell("store", "Store")}
              {headerCell("created_at", "Created")}
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-black/5 bg-white dark:divide-white/10 dark:bg-transparent">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="p-6 text-center">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </td>
              </tr>
            ) : displayed.length ? (
              displayed.map((p) => {
                const badge = storeBadge(p.store);
                return (
                  <tr key={p.id ?? `${p.name}-${p.store}`}>
                    <td className="px-3 py-3 font-medium">{p.name}</td>
                    <td className="px-3 py-3">{p.type}</td>
                    <td className="px-3 py-3">
                      {Intl.NumberFormat("id-ID", {
                        style: "currency",
                        currency: "IDR",
                        maximumFractionDigits: 0,
                      }).format(Number(p.price || 0))}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`rounded px-2 py-1 text-xs ${badge}`}>
                        {p.store || "-"}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {formatDDMMMYYYY(p.created_at)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => onEdit?.(p)}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="destructive"
                          onClick={() => p.id && onDelete?.(p.id)}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} className="p-6 text-center opacity-70">
                  No products found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {serverMode && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs opacity-70">
            Page {page} of {pages} • {total} items
          </div>
          <div className="flex items-center gap-2">
            <select
              className="rounded border bg-transparent p-2 text-sm"
              value={pageSize}
              onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => onPageChange?.(Math.max(1, page - 1))}
                disabled={page <= 1}
              >
                Prev
              </Button>
              <Button
                onClick={() => onPageChange?.(Math.min(pages, page + 1))}
                disabled={page >= pages}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
