"use client";

import { useState, useEffect } from "react";
import { useLanguage } from "@/components/language-provider";
import { DashboardHeader } from "@/components/dashboard-header";
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

interface Product {
  id?: string;
  name: string;
  type: string; // API value (lowercase like "sharing 8u")
  price: number;
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
  const { t, toggleLanguage, language } = useLanguage();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [activeTab, setActiveTab] = useState("manage");
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
      setProducts(json.products ?? []); // pakai key yang benar
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

  const handleSubmit = async (productData: Omit<Product, "id">) => {
    setIsSubmitting(true);
    try {
      const typeApi = (DISPLAY_TO_API[productData.type] ?? productData.type)
        .toString()
        .trim()
        .toUpperCase(); // <-- samakan dengan ALLOWED_TYPES di server

      const payload = {
        name: productData.name?.trim(),
        type: typeApi,
        price: Number(productData.price),
        // ❌ jangan kirim id di body untuk update
      };

      if (!payload.name || !payload.type || Number.isNaN(payload.price)) {
        throw new Error(
          "Name, type, and price are required; price must be a number"
        );
      }
      if (payload.price < 0) {
        throw new Error("Price must be >= 0");
      }

      const url = editingProduct
        ? `/api/products/${encodeURIComponent(String(editingProduct.id))}` // <-- pastikan id string & aman
        : "/api/products";

      const method = editingProduct ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "same-origin", // <-- pastikan cookie (sesi) ikut untuk RLS
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        // tampilkan pesan error server biar jelas
        let msg = "";
        try {
          const body = await response.json();
          msg = body?.error || body?.message || "";
        } catch {}
        if (response.status === 401)
          msg ||= "Unauthorized. Please sign in again.";
        if (response.status === 404)
          msg ||= "Product not found or not authorized.";
        throw new Error(
          msg || `Failed to ${editingProduct ? "update" : "create"} product`
        );
      }

      toast({
        title: "Success",
        description: `Product ${
          editingProduct ? "updated" : "created"
        } successfully`,
      });

      setShowForm(false);
      setEditingProduct(null);
      await fetchProducts();
    } catch (error) {
      console.error("Error saving product:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to save product",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return;

    try {
      const response = await fetch(`/api/products/${id}`, {
        credentials: "same-origin",
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete product");

      toast({
        title: "Success",
        description: "Product deleted successfully",
      });

      await fetchProducts();
    } catch (error) {
      console.error("Error deleting product:", error);
      toast({
        title: "Error",
        description: "Failed to delete product",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingProduct(null);
  };

  const handleBulkUploadComplete = () => {
    fetchProducts();
    setActiveTab("manage");
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
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

      {/* TABS */}
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

        <TabsContent value="manage" className="space-y-4">
          <Card className="border-white/60 bg-white/70 backdrop-blur ring-1 ring-black/5 dark:border-white/10 dark:bg-white/5 dark:ring-white/10">
            <CardContent className="p-0">
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bulk" className="space-y-4">
          <Card className="border-white/60 bg-white/70 backdrop-blur ring-1 ring-black/5 dark:border-white/10 dark:bg-white/5 dark:ring-white/10">
            <CardContent className="p-4">
              <ProductBulkUpload onUploadComplete={handleBulkUploadComplete} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* TODO: Modal Add Product */}
      {showForm && (
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="sm:max-w-lg">
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
