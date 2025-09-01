"use client";

import type React from "react";
import { useState, useMemo } from "react";
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
import { CurrencyInput } from "@/components/currency-input";
import { useLanguage } from "@/components/language-provider";
import { Loader2 } from "lucide-react";

interface Product {
  id?: string;
  name: string;
  type: string; // API shape (lowercase, e.g. "sharing 8u", "edukasi")
  price: number;
  store: string; // <-- NEW (mandatory in form)
  created_at?: string;
}

interface ProductFormProps {
  product?: Product; // when provided, 'type' is API value
  onSubmit: (product: Omit<Product, "id">) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

/** Display values for dropdown */
const PRODUCT_TYPES_DISPLAY = [
  "SHARING",
  "SHARING 8u",
  "SHARING 4u",
  "SHARING 2u",
  "SHARING BIASA",
  "SHARING ANTILIMIT",
  "PRIVATE",
  "EDUCATION",
  "SOSMED",
  "GOOGLE",
  "EDITING",
  "MUSIC",
  "FAMPLAN",
  "INDPLAN",
] as const;

type DisplayType = (typeof PRODUCT_TYPES_DISPLAY)[number];

/** Map API (lowercase) -> Display (uppercase-ish) */
const API_TO_DISPLAY: Record<string, DisplayType> = {
  sharing: "SHARING",
  "sharing 8u": "SHARING 8u",
  "sharing 4u": "SHARING 4u",
  "sharing 2u": "SHARING 2u",
  "sharing biasa": "SHARING BIASA",
  "sharing antilimit": "SHARING ANTILIMIT",
  private: "PRIVATE",
  edukasi: "EDUCATION",
  sosmed: "SOSMED",
  google: "GOOGLE",
  editing: "EDITING",
  music: "MUSIC",
  famplan: "FAMPLAN",
  indplan: "INDPLAN",
};

/** Map Display -> API */
const DISPLAY_TO_API: Record<DisplayType, string> = Object.entries(
  API_TO_DISPLAY
).reduce((acc, [api, disp]) => {
  acc[disp as DisplayType] = api;
  return acc;
}, {} as Record<DisplayType, string>);

/** Store options */
const STORE_OPTIONS = ["Happiest Store", "BB Store"] as const;

export function ProductForm({
  product,
  onSubmit,
  onCancel,
  isLoading,
}: ProductFormProps) {
  const { t } = useLanguage();

  // Derive default display type from API type when editing
  const defaultDisplayType: DisplayType = useMemo(() => {
    if (!product?.type) return "SHARING";
    const disp = API_TO_DISPLAY[product.type.toLowerCase()] as
      | DisplayType
      | undefined;
    return disp ?? "SHARING";
  }, [product?.type]);

  const [formData, setFormData] = useState({
    name: product?.name || "",
    /** store DISPLAY value in the form; convert to API at submit */
    type: defaultDisplayType,
    price: product?.price || 0,
    store: product?.store ?? "", // <-- NEW
  });

  const isSubmitDisabled =
    isLoading ||
    !formData.name.trim() ||
    formData.price <= 0 ||
    !formData.store; // <-- make store mandatory

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitDisabled) return;

    // Convert display value back to API value before submit
    const apiType =
      DISPLAY_TO_API[formData.type] || formData.type.toLowerCase();

    await onSubmit({
      name: formData.name.trim(),
      type: apiType,
      price: formData.price,
      store: formData.store, // <-- include in payload
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{product ? t("editProduct") : t("addProduct")}</CardTitle>
        <CardDescription>
          {product
            ? "Update product information"
            : "Add a new product to your catalog"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t("productName")}</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="Enter product name"
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Product Type</Label>
            <Select
              value={formData.type}
              onValueChange={(type) =>
                setFormData({ ...formData, type: type as DisplayType })
              }
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select product type" />
              </SelectTrigger>
              <SelectContent>
                {PRODUCT_TYPES_DISPLAY.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* STORE - mandatory */}
          <div className="space-y-2">
            <Label htmlFor="store">Store</Label>
            <Select
              value={formData.store}
              onValueChange={(store) => setFormData({ ...formData, store })}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select store (required)" />
              </SelectTrigger>
              <SelectContent>
                {STORE_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!formData.store && (
              <p className="text-xs text-red-500">Store is required.</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="price">{t("price")}</Label>
            <CurrencyInput
              value={formData.price}
              onChange={(price) => setFormData({ ...formData, price })}
              placeholder="Enter price"
              disabled={isLoading}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={isSubmitDisabled}>
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
