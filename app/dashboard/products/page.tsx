"use client";

import { useState, useEffect } from "react";
import { useLanguage } from "@/components/language-provider";
import { ProductForm } from "@/components/product-form";
import { ProductsTable } from "@/components/products-table";
import { ProductBulkUpload } from "@/components/product-bulk-upload";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, Upload } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Swal from "sweetalert2";

interface Product {
  id?: string;
  name: string;
  type: string; // API value (lowercase like "sharing 8u")
  price: number;
  store: string; // <-- NEW
  created_at?: string;
}

const DISPLAY_TO_API: Record<string, string> = {
  SHARING: "sharing",
  "SHARING 8u": "sharing 8u",
  "SHARING 4u": "sharing 4u",
  "SHARING 2u": "sharing 2u",
  "SHARING BIASA": "sharing biasa",
  "SHARING ANTILIMIT": "sharing antilimit",
  PRIVATE: "private",
  EDUCATION: "edukasi",
  SOSMED: "sosmed",
  GOOGLE: "google",
  EDITING: "editing",
  MUSIC: "music",
  FAMPLAN: "famplan",
  INDPLAN: "indplan",
};

export default function ProductsPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<keyof Product>("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const qs = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        search,
        sortField: String(sortField),
        sortOrder,
      }).toString();

      const res = await fetch(`/api/products?${qs}`, {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      const json = await res.json();
      setProducts(json.products ?? []);
      setTotal(json.total ?? 0);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [page, pageSize, search, sortField, sortOrder]);

  // now receives store in productData
  const handleSubmit = async (productData: Omit<Product, "id">) => {
    setIsSubmitting(true);
    try {
      const typeApi = (DISPLAY_TO_API[productData.type] ?? productData.type)
        .toString()
        .trim()
        .toUpperCase();

      const payload = {
        name: productData.name?.trim(),
        type: typeApi,
        price: Number(productData.price),
        store: productData.store,
      };

      // Validasi awal (tampilkan via Swal)
      if (!payload.name || !payload.type || Number.isNaN(payload.price)) {
        throw new Error(
          "Name, type, and price are required; price must be a number"
        );
      }
      if (!payload.store) throw new Error("Store is required");
      if (payload.price < 0) throw new Error("Price must be >= 0");

      const url = editingProduct
        ? `/api/products/${encodeURIComponent(String(editingProduct.id))}`
        : "/api/products";
      const method = editingProduct ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let msg = "";
        try {
          const body = await response.json();
          msg = body?.error || body?.message || "";
        } catch {}
        if (response.status === 401) msg ||= "Unauthorized. Please sign in.";
        if (response.status === 404) msg ||= "Product not found.";
        throw new Error(
          msg || `Failed to ${editingProduct ? "update" : "create"} product`
        );
      }
      setShowForm(false);
      setEditingProduct(null);

      await Swal.fire({
        icon: "success",
        title: "Success",
        text: `Product ${editingProduct ? "updated" : "created"} successfully`,
        confirmButtonText: "OK",
        customClass: {
          popup: "z-[9999]", // tailwind
        },
      });

      await fetchProducts();
    } catch (error) {
      console.error("Error saving product:", error);
      await Swal.fire({
        icon: "error",
        title: "Error",
        text: error instanceof Error ? error.message : "Failed to save product",
        confirmButtonText: "Close",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { isConfirmed } = await Swal.fire({
      title: "Delete product?",
      text: "This action cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete",
      cancelButtonText: "Cancel",
      reverseButtons: true,
    });

    if (!isConfirmed) return;

    try {
      const response = await fetch(`/api/products/${id}`, {
        credentials: "same-origin",
        method: "DELETE",
      });
      if (!response.ok) {
        let msg = "";
        try {
          const body = await response.json();
          msg = body?.error || body?.message || "";
        } catch {}
        throw new Error(msg || "Failed to delete product");
      }

      await Swal.fire({
        icon: "success",
        title: "Deleted",
        text: "Product deleted successfully",
        confirmButtonText: "OK",
        customClass: {
          popup: "z-[9999]", // tailwind
        },
      });

      await fetchProducts();
    } catch (error) {
      console.error("Error deleting product:", error);
      await Swal.fire({
        icon: "error",
        title: "Error",
        text:
          error instanceof Error ? error.message : "Failed to delete product",
        confirmButtonText: "Close",
      });
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setShowForm(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center rounded-2xl border border-white/20 bg-white/60 p-4 backdrop-blur dark:border-white/10 dark:bg-white/5 lg:flex-row lg:justify-between">
        <div className="text-center lg:text-left">
          <h2 className="bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600 bg-clip-text text-2xl font-extrabold text-transparent">
            {t("productManagement")}
          </h2>
          <p className="text-muted-foreground">Add and manage your products</p>
        </div>
        <div className="mt-4 lg:mt-0">
          <Button
            className="bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600 text-white hover:opacity-90"
            onClick={() => setShowForm(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t("addProduct")}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="manage" className="space-y-4">
        <TabsList className="w-full justify-start overflow-x-auto no-scrollbar bg-white/70 backdrop-blur dark:bg-white/10">
          <TabsTrigger value="manage" className="shrink-0">
            Manage Products
          </TabsTrigger>
          <TabsTrigger value="bulk" className="shrink-0">
            <Upload className="mr-2 h-4 w-4" />
            Bulk Upload
          </TabsTrigger>
        </TabsList>

        <div className="overflow-x-auto">
          <ProductsTable
            serverMode
            products={products}
            isLoading={isLoading}
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={(p) => setPage(Math.max(1, p))}
            onPageSizeChange={(ps) => {
              setPageSize(ps);
              setPage(1);
            }}
            searchTerm={search}
            onSearchChange={(q) => {
              setSearch(q);
              setPage(1);
            }}
            sortField={sortField}
            sortOrder={sortOrder}
            onSort={(field) => {
              if (sortField === field)
                setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
              else {
                setSortField(field as keyof Product);
                setSortOrder("asc");
              }
            }}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </div>

        <TabsContent value="bulk" className="space-y-4">
          <Card className="border-white/60 bg-white/70 backdrop-blur ring-1 ring-black/5 dark:border-white/10 dark:bg-white/5 dark:ring-white/10">
            <CardContent className="p-4">
              <ProductBulkUpload
                onUploadComplete={() => {
                  fetchProducts();
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {showForm && (
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingProduct ? t("editProduct") : t("addProduct")}
              </DialogTitle>
              <DialogDescription>
                {editingProduct
                  ? "Update product information"
                  : "Add a new product to your catalog"}
              </DialogDescription>
            </DialogHeader>

            <ProductForm
              product={editingProduct || undefined}
              onSubmit={handleSubmit}
              onCancel={() => setShowForm(false)}
              isLoading={isSubmitting}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
