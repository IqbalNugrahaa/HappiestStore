"use client";

import type React from "react";

import { Input } from "@/components/ui/input";
import { formatRupiahInput, parseRupiah } from "@/lib/currency";
import { useState, useEffect } from "react";

interface CurrencyInputProps {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function CurrencyInput({
  value,
  onChange,
  placeholder,
  className,
  disabled,
}: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = useState("");

  // Formatter yang aman untuk nilai negatif
  const formatDisplay = (n: number) => {
    if (!Number.isFinite(n)) return "";
    const isNeg = n < 0;
    const absStr = Math.abs(n).toString();
    const formattedAbs = formatRupiahInput(absStr); // contoh: "61000" -> "61,000"
    return isNeg ? `-${formattedAbs}` : formattedAbs;
  };

  // Sinkronkan tampilan saat prop `value` berubah (termasuk nilai negatif & nol)
  useEffect(() => {
    setDisplayValue(formatDisplay(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    setDisplayValue(inputValue);

    // Biarkan user ketik tanda minus; parsing akan hasilkan nilai negatif
    const numericValue = parseRupiah(inputValue);
    onChange(numericValue);
  };

  const handleBlur = () => {
    // Normalisasi tampilan saat blur berdasarkan input yang sedang ada
    const normalized = parseRupiah(displayValue);
    setDisplayValue(formatDisplay(normalized));
    onChange(normalized);
  };

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
        Rp
      </span>
      <Input
        type="text"
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={`pl-8 ${className || ""}`}
        disabled={disabled}
      />
    </div>
  );
}
