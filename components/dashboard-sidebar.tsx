"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BarChart3, Package, LogOut, Globe } from "lucide-react";
import Link from "next/link";
import { redirect, usePathname } from "next/navigation";
import { signOut } from "@/lib/actions";
import Image from "next/image";
import logo from "../public/assets/logo.webp";

const navigation = [
  {
    name: "Revenue",
    href: "/dashboard/revenue",
    icon: BarChart3,
  },
  {
    name: "Products",
    href: "/dashboard/products",
    icon: Package,
  },
];

interface DashboardSidebarProps {
  user: any;
  onLanguageToggle: () => void;
  currentLanguage: string;
}

export function DashboardSidebar({
  user,
  onLanguageToggle,
  currentLanguage,
}: DashboardSidebarProps) {
  const pathname = usePathname();

  return (
    <div className="flex h-full w-64 flex-col bg-sidebar border-r border-sidebar-border">
      {/* Header */}
      <Link href={"/dashboard"}>
        <div className="flex h-16 items-center border-b border-sidebar-border px-6">
          <Image
            src={logo}
            alt="Logo"
            className="mr-2 rounded-2xl"
            width={50}
            height={50}
          />
          <h1 className="text-lg font-semibold text-sidebar-foreground">
            Happiest Store
          </h1>
        </div>
      </Link>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-2">
          {navigation.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link key={item.name} href={item.href}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    isActive &&
                      "bg-sidebar-accent text-sidebar-accent-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Button>
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      {/* User section */}
      <div className="border-t border-sidebar-border p-4 space-y-2">
        <div className="flex items-center gap-3 px-2 py-1">
          <div className="h-8 w-8 rounded-full bg-sidebar-primary flex items-center justify-center">
            <span className="text-xs font-medium text-sidebar-primary-foreground">
              {user?.email?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {user?.email}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onLanguageToggle}
            className="flex-1 text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <Globe className="h-4 w-4 mr-2" />
            {currentLanguage === "en" ? "ID" : "EN"}
          </Button>

          <form action={signOut} className="flex-1">
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="w-full text-sidebar-foreground hover:bg-sidebar-accent"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
