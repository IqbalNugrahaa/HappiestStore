"use client";

import type React from "react";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/currency-input";
import { useLanguage } from "@/components/language-provider";
import { Loader2, ChevronsUpDown, Check, Store } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";

interface Product {
  id: string;
  name: string;
  price: number;
  /** optional: jika API mengembalikan informasi store */
  store_name?: string;
}

interface Transaction {
  id?: string;
  id_product?: string | null;
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

interface TransactionFormProps {
  transaction?: Transaction;
  onSubmit: (transaction: Omit<Transaction, "id">) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

function formatIDR(n?: number) {
  if (typeof n !== "number") return "-";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

const OTHER_ID = "__OTHER__";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function todayDateOnly(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function dateOnlyFromAny(input?: string): string {
  const s = (input || "").trim();
  if (!s) return todayDateOnly();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(s);
  if (isNaN(d.getTime())) return todayDateOnly();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function ymFromDateOnly(dateOnly: string): { year: number; month: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOnly);
  if (m) return { year: Number(m[1]), month: Number(m[2]) };
  const d = new Date(dateOnly);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}
const toNum = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const computeRevenue = (selling: any, purchase: any) =>
  toNum(selling) - toNum(purchase);

export function TransactionForm({
  transaction,
  onSubmit,
  onCancel,
  isLoading,
}: TransactionFormProps) {
  const { t } = useLanguage();

  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productOpen, setProductOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const cacheRef = useRef<Map<string, Product[]>>(new Map());
  const abortRef = useRef<AbortController | null>(null);

  const initialDate = dateOnlyFromAny(transaction?.date);
  const { year: initYear, month: initMonth } = ymFromDateOnly(initialDate);

  const [formData, setFormData] = useState({
    id_product: transaction?.id_product ?? null,
    is_custom_item: false,
    date: initialDate,
    item_purchased: transaction?.item_purchased || "",
    customer_name: transaction?.customer_name || "",
    store_name: transaction?.store_name || "",
    payment_method: transaction?.payment_method || "",
    purchase_price: transaction?.purchase_price || 0,
    selling_price: transaction?.selling_price || 0,
    revenue: transaction?.revenue || 0,
    notes: transaction?.notes || "",
    month: transaction?.month ?? initMonth,
    year: transaction?.year ?? initYear,
    created_at: transaction?.created_at || new Date().toISOString(),
    updated_at: transaction?.updated_at || new Date().toISOString(),
  });

  const priceValid = formData.is_custom_item
    ? formData.selling_price >= 0
    : formData.selling_price > 0;

  const hasItem = formData.is_custom_item
    ? formData.item_purchased.trim().length > 0
    : Boolean(formData.id_product);

  const canSubmit = !isLoading && priceValid && hasItem;

  // Debounce search
  useEffect(() => {
    const h = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(h);
  }, [search]);

  // Fetch products (optionally filtered by store on the server)
  useEffect(() => {
    let mounted = true;

    async function fetchAllProducts(q: string, store?: string) {
      try {
        const cacheKey = `${q}__${store || ""}`;
        if (cacheRef.current.has(cacheKey)) {
          if (mounted) {
            const cached = cacheRef.current.get(cacheKey) || [];
            setAllProducts(cached);
          }
          return;
        }

        setProductsLoading(true);
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        // coba hit endpoint fast path dengan filter store
        const qs = new URLSearchParams({ all: "1" });
        if (q) qs.set("search", q);
        if (store) qs.set("store", store);
        const fastUrl = `/api/products?${qs.toString()}`;

        let res = await fetch(fastUrl, {
          signal: controller.signal,
          credentials: "same-origin",
          headers: { Accept: "application/json" },
        });

        let items: any[] = [];
        if (res.ok) {
          const json = await res.json();
          items = json?.products ?? [];
        } else {
          // fallback pagination (tanpa filter server), nanti kita filter client-side
          items = [];
          const pageSize = 1000;
          for (let page = 1; ; page++) {
            if (!mounted) break;
            const url = q
              ? `/api/products?search=${encodeURIComponent(
                  q
                )}&page=${page}&pageSize=${pageSize}`
              : `/api/products?page=${page}&pageSize=${pageSize}`;
            res = await fetch(url, {
              signal: controller.signal,
              credentials: "same-origin",
              headers: { Accept: "application/json" },
            });
            if (!res.ok) break;
            const { products = [] } = await res.json();
            items.push(...products);
            if (products.length < pageSize) break;
          }
        }

        const list: Product[] = items.map((p: any) => ({
          id: p.id,
          name: p.name,
          price: Number(p.price) || 0,
          store_name: p.store_name, // jika tersedia
        }));

        cacheRef.current.set(`${q}__${store || ""}`, list);
        if (mounted) setAllProducts(list);
      } catch (_err) {
        if (mounted) setAllProducts([]);
      } finally {
        if (mounted) setProductsLoading(false);
      }
    }

    fetchAllProducts(debouncedSearch, formData.store_name || undefined);
    return () => {
      mounted = false;
    };
  }, [debouncedSearch, formData.store_name]);

  // Client-side filter by store if API belum mendukung filter store
  useEffect(() => {
    const store = formData.store_name?.trim();
    if (!store) {
      // belum pilih store: kosongkan list agar memaksa pilih store dulu
      setProducts([]);
      return;
    }
    const filtered = allProducts.filter(
      (p) => !p.store_name || p.store_name === store
    );
    setProducts(filtered);
  }, [allProducts, formData.store_name]);

  // Keep month/year in sync with date
  useEffect(() => {
    const d = new Date(formData.date);
    if (!isNaN(d.getTime())) {
      setFormData((prev) => ({
        ...prev,
        month: d.getMonth() + 1,
        year: d.getFullYear(),
      }));
    }
  }, [formData.date]);

  // Reset pilihan item saat store berganti (hindari mismatch)
  useEffect(() => {
    if (formData.id_product === null) {
      setFormData((prev) => ({
        ...prev,
        id_product: null,
        item_purchased: "",
        is_custom_item: false,
        // selling & revenue tidak diubah; user bisa isi manual/otomatis setelah pilih item
      }));
    }
  }, [formData.store_name]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.is_custom_item) {
      if (!formData.item_purchased.trim()) return;
      if (
        !Number.isFinite(formData.selling_price) ||
        formData.selling_price < 0
      )
        return;
    } else {
      if (!formData.id_product) return;
      if (
        !Number.isFinite(formData.selling_price) ||
        formData.selling_price <= 0
      )
        return;
    }

    const finalRevenue = computeRevenue(
      formData.selling_price,
      formData.purchase_price
    );

    const payload = {
      id_product: formData.is_custom_item
        ? undefined
        : formData.id_product ?? undefined,
      is_custom_item: formData.is_custom_item,
      date: formData.date,
      item_purchase: formData.item_purchased.trim(),
      customer_name: formData.customer_name.trim() || undefined,
      store_name: formData.store_name || undefined,
      payment_method: formData.payment_method || undefined,
      purchase_price: toNum(formData.purchase_price),
      selling_price: toNum(formData.selling_price),
      revenue: finalRevenue,
      notes: formData.notes.trim() || undefined,
      month: formData.month,
      year: formData.year,
      created_at: formData.created_at,
      updated_at: new Date().toISOString(),
    };

    await onSubmit(payload as any);
  };

  const selectedProduct =
    !formData.is_custom_item && formData.id_product
      ? products.find((p) => p.id === formData.id_product) ?? null
      : null;

  const storeChosen = !!formData.store_name;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {transaction ? "Edit Transaction" : t("addTransaction")}
        </CardTitle>
        <CardDescription>
          {/* langkah: pilih store → pilih item */}
          Pilih <strong>Store</strong> terlebih dahulu, lalu pilih{" "}
          <strong>Item Purchase</strong>.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) =>
                  setFormData({ ...formData, date: e.target.value })
                }
                disabled={isLoading}
              />
            </div>

            {/* Store Name (Wajib pilih dahulu) */}
            <div className="space-y-2">
              <Label htmlFor="store_name">
                Store Name <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.store_name}
                onValueChange={(value) =>
                  setFormData({ ...formData, store_name: value })
                }
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder="Select store"
                    aria-label="Select store first"
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HAPPIEST STORE">HAPPIEST STORE</SelectItem>
                  <SelectItem value="BB STORE">BB STORE</SelectItem>
                </SelectContent>
              </Select>
              {!storeChosen && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <Store className="h-3.5 w-3.5" />
                  Pilih store terlebih dahulu untuk menampilkan daftar item.
                  Opsi “Other (custom)” tetap tersedia.
                </p>
              )}
            </div>
          </div>

          {/* Item Purchase */}
          <div className="space-y-2">
            <Label htmlFor="item_purchase">Item Purchase *</Label>

            <Popover open={productOpen} onOpenChange={setProductOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={productOpen}
                  className="w-full justify-between overflow-hidden"
                  disabled={isLoading}
                >
                  <span className="truncate min-w-0 flex-1 text-left">
                    {formData.is_custom_item
                      ? formData.item_purchased || "Other (custom) — type item"
                      : selectedProduct
                      ? `${selectedProduct.name} — ${formatIDR(
                          selectedProduct.price
                        )}`
                      : storeChosen
                      ? "Select product"
                      : "Select store first or choose Other"}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>

              <PopoverContent className="p-0 w-[calc(100vw-2rem)] sm:w-[360px]">
                <Command>
                  {/* Jika belum pilih store, nonaktifkan input search agar jelas alurnya */}
                  <CommandInput
                    placeholder={
                      storeChosen
                        ? "Search product..."
                        : "Select store first..."
                    }
                    value={storeChosen ? search : ""}
                    onValueChange={storeChosen ? setSearch : () => {}}
                    disabled={!storeChosen}
                  />
                  <CommandEmpty>
                    {productsLoading
                      ? "Loading..."
                      : storeChosen
                      ? "No product found."
                      : "Select store to see products."}
                  </CommandEmpty>

                  <CommandGroup>
                    {/* Tampilkan produk hanya jika store sudah dipilih */}
                    {storeChosen &&
                      products.map((p) => {
                        const selected =
                          !formData.is_custom_item &&
                          p.id === formData.id_product;
                        return (
                          <CommandItem
                            key={p.id}
                            value={`${p.name} ${p.price}`}
                            onSelect={() => {
                              setFormData((prev) => {
                                const newSelling = toNum(p.price);
                                const newRevenue = computeRevenue(
                                  newSelling,
                                  prev.purchase_price
                                );
                                return {
                                  ...prev,
                                  is_custom_item: false,
                                  id_product: p.id,
                                  item_purchased: p.name,
                                  selling_price: newSelling,
                                  revenue: newRevenue,
                                };
                              });
                              setProductOpen(false);
                            }}
                            className="gap-2"
                          >
                            <div className="h-4 w-4 flex items-center justify-center shrink-0">
                              {selected ? <Check className="h-4 w-4" /> : null}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-medium truncate">
                                {p.name}
                              </span>
                              <span className="text-xs opacity-70 truncate">
                                {formatIDR(p.price)}
                              </span>
                            </div>
                          </CommandItem>
                        );
                      })}

                    {/* Other (selalu ada walau store belum dipilih) */}
                    <CommandItem
                      key={OTHER_ID}
                      value="other custom manual"
                      onSelect={() => {
                        setFormData((prev) => ({
                          ...prev,
                          is_custom_item: true,
                          id_product: null,
                          item_purchased: prev.item_purchased || "",
                          selling_price: toNum(prev.selling_price),
                          revenue: computeRevenue(
                            prev.selling_price,
                            prev.purchase_price
                          ),
                        }));
                        setProductOpen(false);
                      }}
                      className="gap-2"
                    >
                      <div className="h-4 w-4 shrink-0" />
                      <div className="flex flex-col min-w-0">
                        <span className="font-medium truncate">
                          Other (custom)
                        </span>
                        <span className="text-xs opacity-70 truncate">
                          Type item name & price manually
                        </span>
                      </div>
                    </CommandItem>
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>

            {formData.is_custom_item && (
              <div className="mt-2">
                <Input
                  id="custom_item_name"
                  placeholder="Type custom item name..."
                  value={formData.item_purchased}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      item_purchased: e.target.value,
                    })
                  }
                  disabled={isLoading}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  This will be saved as <strong>item_purchased</strong> without
                  linking to a product.
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="customer_name">Customer Name</Label>
              <Input
                id="customer_name"
                value={formData.customer_name}
                onChange={(e) =>
                  setFormData({ ...formData, customer_name: e.target.value })
                }
                placeholder="Enter customer name"
                disabled={isLoading}
              />
            </div>

            {/* Payment Method -> Fixed options */}
            <div className="space-y-2">
              <Label htmlFor="payment_method">Payment Method</Label>
              <Select
                value={formData.payment_method}
                onValueChange={(value) =>
                  setFormData({ ...formData, payment_method: value })
                }
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BCA">BCA</SelectItem>
                  <SelectItem value="GOPAY">GOPAY</SelectItem>
                  <SelectItem value="QRIS">QRIS</SelectItem>
                  <SelectItem value="DANA">DANA</SelectItem>
                  <SelectItem value="SPAY">SPAY</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="purchase_price">Purchase Price</Label>
              <CurrencyInput
                value={formData.purchase_price}
                onChange={(price) =>
                  setFormData((prev) => ({
                    ...prev,
                    purchase_price: toNum(price),
                    revenue: computeRevenue(prev.selling_price, price),
                  }))
                }
                placeholder="Enter purchase price"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="selling_price">Selling Price *</Label>
              <CurrencyInput
                value={formData.selling_price}
                onChange={(price) =>
                  setFormData((prev) => ({
                    ...prev,
                    selling_price: toNum(price),
                    revenue: computeRevenue(price, prev.purchase_price),
                  }))
                }
                placeholder={
                  formData.is_custom_item
                    ? "Enter selling price (0 allowed)"
                    : "Enter selling price (>0)"
                }
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="revenue">Revenue</Label>
              <CurrencyInput
                value={computeRevenue(
                  formData.selling_price,
                  formData.purchase_price
                )}
                onChange={() => {}}
                placeholder="Calculated revenue"
                disabled
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              placeholder="Enter any additional notes"
              disabled={isLoading}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={!canSubmit}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("save")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isLoading}
            >
              {t("cancel")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
