// components/dashboard-sidebar.tsx
"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  BarChart3,
  Package,
  LogOut,
  Globe,
  Menu,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/actions";
import Image from "next/image";
import logo from "../public/assets/logo.webp";
import { useEffect, useState } from "react";

const navigation = [
  { name: "Revenue", href: "/dashboard/revenue", icon: BarChart3 },
  { name: "Products", href: "/dashboard/products", icon: Package },
];

interface DashboardSidebarProps {
  user: any;
  onLanguageToggle: () => void;
  currentLanguage: string;
  // ⬇️ baru (controlled)
  collapsed?: boolean;
  onCollapsedChange?: (v: boolean) => void;
}

export function DashboardSidebar({
  user,
  onLanguageToggle,
  currentLanguage,
  collapsed: collapsedProp,
  onCollapsedChange,
}: DashboardSidebarProps) {
  const pathname = usePathname();

  // Drawer (mobile)
  const [mobileOpen, setMobileOpen] = useState(false);

  // Controlled/uncontrolled collapse (desktop)
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const isControlled = typeof collapsedProp === "boolean";
  const collapsed = isControlled
    ? (collapsedProp as boolean)
    : internalCollapsed;
  const setCollapsed = (v: boolean) => {
    if (!isControlled) setInternalCollapsed(v);
    onCollapsedChange?.(v);
  };

  // Tutup drawer saat route berubah
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const desktopWidth = collapsed ? "md:w-16" : "md:w-64";

  return (
    <>
      {/* Floating hamburger (mobile only) */}
      <button
        className="fixed top-3 left-3 z-[60] inline-flex items-center justify-center rounded-md border border-sidebar-border bg-sidebar p-2 shadow md:hidden"
        onClick={() => setMobileOpen(true)}
        aria-label="Open sidebar"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Overlay saat drawer terbuka */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-[55] flex h-full flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-200",
          mobileOpen ? "translate-x-0 w-64" : "-translate-x-full w-64",
          "md:translate-x-0",
          desktopWidth
        )}
      >
        {/* Header */}
        <Link href={"/dashboard"}>
          <div className="flex h-16 items-center border-b border-sidebar-border px-3 md:px-4">
            <Image
              src={logo}
              alt="Logo"
              className="mr-2 rounded-2xl"
              width={40}
              height={40}
            />
            <h1
              className={cn(
                "text-base font-semibold text-sidebar-foreground transition-opacity",
                collapsed ? "opacity-0 md:opacity-0 w-0" : "opacity-100"
              )}
            >
              Happiest Store
            </h1>

            {/* Collapse toggle (desktop) */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="ml-auto hidden md:inline-flex"
              onClick={() => setCollapsed(!collapsed)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand" : "Collapse"}
            >
              {collapsed ? (
                <ChevronRight className="h-5 w-5" />
              ) : (
                <ChevronLeft className="h-5 w-5" />
              )}
            </Button>
          </div>
        </Link>

        {/* Navigation */}
        <ScrollArea className="flex-1 px-2 py-4">
          <nav className="space-y-2">
            {navigation.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link key={item.name} href={item.href}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    className={cn(
                      "w-full gap-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      isActive &&
                        "bg-sidebar-accent text-sidebar-accent-foreground",
                      collapsed ? "justify-center px-0" : "justify-start"
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!collapsed && (
                      <span className="truncate">{item.name}</span>
                    )}
                  </Button>
                </Link>
              );
            })}
          </nav>
        </ScrollArea>

        {/* User section */}
        <div className="border-t border-sidebar-border p-3 space-y-2">
          <div
            className={cn(
              "flex items-center gap-3",
              collapsed ? "justify-center" : "px-1"
            )}
          >
            <div className="h-8 w-8 rounded-full bg-sidebar-primary flex items-center justify-center">
              <span className="text-xs font-medium text-sidebar-primary-foreground">
                {user?.email?.charAt(0).toUpperCase()}
              </span>
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-sidebar-foreground">
                  {user?.email}
                </p>
              </div>
            )}
          </div>

          <div className={cn("flex gap-2", collapsed && "justify-center")}>
            <Button
              variant="ghost"
              size={collapsed ? "icon" : "sm"}
              onClick={onLanguageToggle}
              className={cn(
                "text-sidebar-foreground hover:bg-sidebar-accent",
                collapsed ? "w-9 h-9" : "flex-1"
              )}
              title="Toggle language"
            >
              <Globe className={cn("h-4 w-4", !collapsed && "mr-2")} />
              {!collapsed && (currentLanguage === "en" ? "ID" : "EN")}
            </Button>

            <form action={signOut} className={cn(collapsed ? "" : "flex-1")}>
              <Button
                type="submit"
                variant="ghost"
                size={collapsed ? "icon" : "sm"}
                className={cn(
                  "text-sidebar-foreground hover:bg-sidebar-accent w-full",
                  collapsed ? "w-9 h-9" : ""
                )}
                title="Sign Out"
              >
                <LogOut className={cn("h-4 w-4", !collapsed && "mr-2")} />
                {!collapsed && "Sign Out"}
              </Button>
            </form>
          </div>
        </div>
      </aside>
    </>
  );
}
