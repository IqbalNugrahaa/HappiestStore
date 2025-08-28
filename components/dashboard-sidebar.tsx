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
  collapsed?: boolean; // controlled
  onCollapsedChange?: (v: boolean) => void; // controlled
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

  useEffect(() => {
    const handleCollapse = () => setCollapsed(true);
    const handleExpand = () => setCollapsed(false);

    // dengarkan event global
    window.addEventListener("dash:collapse", handleCollapse as EventListener);
    window.addEventListener("dash:expand", handleExpand as EventListener);

    return () => {
      window.removeEventListener(
        "dash:collapse",
        handleCollapse as EventListener
      );
      window.removeEventListener("dash:expand", handleExpand as EventListener);
    };
  }, []);

  const desktopWidth = collapsed ? "md:w-28" : "md:w-64";

  return (
    <>
      {/* Floating hamburger (mobile only) */}
      <button
        className="fixed top-3 left-3 z-[60] inline-flex items-center justify-center rounded-md border border-white/20 bg-white/70 p-2 shadow backdrop-blur md:hidden dark:border-white/10 dark:bg-white/10"
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
          // base
          "fixed inset-y-0 left-0 z-[55] flex h-full flex-col transition-transform duration-200",
          // glass + palette
          "border-r border-white/10 bg-white/70 backdrop-blur-md ring-1 ring-black/5 dark:border-white/10 dark:bg-white/5 dark:ring-white/10",
          // mobile
          mobileOpen ? "translate-x-0 w-64" : "-translate-x-full w-64",
          // desktop
          "md:translate-x-0",
          desktopWidth
        )}
      >
        {/* Header */}
        <div className="relative flex h-16 items-center px-3 md:px-4">
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-indigo-500/30 via-blue-500/30 to-purple-500/30" />
          <Image
            src={logo}
            alt="Logo"
            className="mr-2 rounded-2xl"
            width={40}
            height={40}
          />
          <h1
            className={cn(
              "text-base font-semibold text-foreground transition-opacity",
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
            className="hidden md:flex mx-auto"
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

        {/* Navigation */}
        <ScrollArea className="flex-1 px-2 py-4">
          <nav className="flex flex-col gap-y-2">
            {navigation.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link key={item.name} href={item.href}>
                  <Button
                    variant="ghost"
                    className={cn(
                      "relative w-full gap-3 hover:bg-white/60 hover:text-foreground dark:hover:bg-white/10",
                      collapsed ? "justify-center px-0" : "justify-start",
                      isActive &&
                        "bg-white/70 text-foreground ring-1 ring-indigo-500/30 dark:bg-white/10 dark:ring-indigo-400/30"
                    )}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r bg-gradient-to-b from-indigo-500 via-blue-500 to-purple-500" />
                    )}
                    <item.icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        isActive
                          ? "text-indigo-600 dark:text-indigo-300"
                          : "text-muted-foreground"
                      )}
                    />
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
        <div className="border-t border-white/10 p-3 space-y-2 dark:border-white/10">
          <div
            className={cn(
              "flex items-center gap-3",
              collapsed ? "justify-center" : "px-1"
            )}
          >
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 text-white ring-1 ring-white/60 dark:ring-white/10">
              <span className="text-xs font-semibold">
                {user?.email?.charAt(0).toUpperCase()}
              </span>
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
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
                "text-foreground hover:bg-white/60 dark:hover:bg-white/10",
                collapsed ? "h-9 w-9" : "flex-1"
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
                  "w-full text-foreground hover:bg-white/60 dark:hover:bg-white/10",
                  collapsed ? "h-9 w-9" : ""
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
