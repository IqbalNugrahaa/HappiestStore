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
  TrendingUp,
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
  { name: "Revenue Month", href: "/dashboard/revenue-month", icon: TrendingUp },
];

interface DashboardSidebarProps {
  user: any;
  onLanguageToggle: () => void;
  currentLanguage: string;
  collapsed?: boolean; // controlled
  onCollapsedChange?: (v: boolean) => void; // controlled
}

/** Simple media-query hook, client-only */
function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [query]);
  return matches;
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

  // Responsif: collapse hanya berlaku di desktop (>= md)
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const showLabel = isDesktop ? !collapsed : true;

  // Tutup drawer saat route berubah
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Dengarkan event global untuk collapse/expand
  useEffect(() => {
    const handleCollapse = () => setCollapsed(true);
    const handleExpand = () => setCollapsed(false);
    window.addEventListener("dash:collapse", handleCollapse as EventListener);
    window.addEventListener("dash:expand", handleExpand as EventListener);
    return () => {
      window.removeEventListener(
        "dash:collapse",
        handleCollapse as EventListener
      );
      window.removeEventListener("dash:expand", handleExpand as EventListener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const desktopWidth = collapsed ? "md:w-28" : "md:w-64";

  function isPathActive(href: string, pathname: string) {
    if (href === "/") return pathname === "/";
    const base = href.endsWith("/") ? href.slice(0, -1) : href;
    // exact
    if (pathname === base) return true;
    // hanya aktif untuk child segment yang valid (base + "/...")
    return pathname.startsWith(base + "/");
  }

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
          // mobile drawer width & slide
          mobileOpen ? "translate-x-0 w-64" : "-translate-x-full w-64",
          // desktop state
          "md:translate-x-0",
          desktopWidth
        )}
      >
        {/* Header */}
        <div className="relative flex h-16 items-center px-3 md:px-4">
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-indigo-500/30 via-blue-500/30 to-purple-500/30" />
          <Link href={"/dashboard"} className="flex items-center">
            <Image
              src={logo}
              alt="Logo"
              className="mr-2 rounded-2xl"
              width={40}
              height={40}
              priority
            />
            <h1
              className={cn(
                "text-base font-semibold text-foreground transition-opacity",
                isDesktop && collapsed ? "opacity-0 w-0" : "opacity-100"
              )}
            >
              Happiest Store
            </h1>
          </Link>
          {/* Collapse toggle (desktop) */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="hidden md:flex ml-auto"
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
              const isActive = isPathActive(item.href, pathname); // <--- ganti ini

              return (
                <Button
                  key={item.name}
                  asChild
                  variant="ghost"
                  className={cn(
                    "relative w-full min-w-0 gap-3 px-3 hover:bg-white/60 hover:text-foreground dark:hover:bg-white/10",
                    isDesktop && collapsed
                      ? "justify-center px-0"
                      : "justify-start",
                    isActive &&
                      "bg-white/70 text-foreground ring-1 ring-indigo-500/30 dark:bg-white/10 dark:ring-indigo-400/30"
                  )}
                >
                  <Link
                    href={item.href}
                    className="flex w-full items-center overflow-hidden"
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
                      aria-hidden="true"
                    />
                    {showLabel && <span className="truncate">{item.name}</span>}
                  </Link>
                </Button>
              );
            })}
          </nav>
        </ScrollArea>

        {/* User section */}
        <div className="border-t border-white/10 p-3 space-y-2 dark:border-white/10">
          <div
            className={cn(
              "flex items-center gap-3",
              isDesktop && collapsed ? "justify-center" : "px-1"
            )}
          >
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 text-white ring-1 ring-white/60 dark:ring-white/10">
              <span className="text-xs font-semibold">
                {user?.email?.charAt(0)?.toUpperCase() ?? "U"}
              </span>
            </div>
            {showLabel && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {user?.email ?? ""}
                </p>
              </div>
            )}
          </div>

          <div
            className={cn(
              "flex gap-2",
              isDesktop && collapsed && "justify-center"
            )}
          >
            <Button
              variant="ghost"
              size={isDesktop && collapsed ? "icon" : "sm"}
              onClick={onLanguageToggle}
              className={cn(
                "text-foreground hover:bg-white/60 dark:hover:bg-white/10",
                isDesktop && collapsed ? "h-9 w-9" : "flex-1"
              )}
              title="Toggle language"
            >
              <Globe className={cn("h-4 w-4", showLabel && "mr-2")} />
              {showLabel && (currentLanguage === "en" ? "ID" : "EN")}
            </Button>

            <form
              action={signOut}
              className={cn(isDesktop && collapsed ? "" : "flex-1")}
            >
              <Button
                type="submit"
                variant="ghost"
                size={isDesktop && collapsed ? "icon" : "sm"}
                className={cn(
                  "w-full text-foreground hover:bg-white/60 dark:hover:bg-white/10",
                  isDesktop && collapsed ? "h-9 w-9" : ""
                )}
                title="Sign Out"
              >
                <LogOut className={cn("h-4 w-4", showLabel && "mr-2")} />
                {showLabel && "Sign Out"}
              </Button>
            </form>
          </div>
        </div>
      </aside>
    </>
  );
}
