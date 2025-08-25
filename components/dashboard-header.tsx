"use client";

import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";

interface DashboardHeaderProps {
  title: string;
  description?: string;
  onLanguageToggle: () => void;
  currentLanguage: string;
}

export function DashboardHeader({
  title,
  description,
  onLanguageToggle,
  currentLanguage,
}: DashboardHeaderProps) {
  return (
    <div className="flex h-16 items-center justify-between border-b bg-background px-6 pb-2 pt-1">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>

      <Button variant="outline" size="sm" onClick={onLanguageToggle}>
        <Globe className="h-4 w-4 mr-2" />
        {currentLanguage === "en" ? "Bahasa Indonesia" : "English"}
      </Button>
    </div>
  );
}
