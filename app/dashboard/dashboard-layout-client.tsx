"use client";

import type React from "react";
import { useState } from "react";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { LanguageProvider, useLanguage } from "@/components/language-provider";

function DashboardLayoutInner({
  user,
  children,
}: {
  user: any;
  children: React.ReactNode;
}) {
  const { language, toggleLanguage } = useLanguage();

  // state collapse di parent → konten ikut mengecil
  const [collapsed, setCollapsed] = useState(false);
  const contentMl = collapsed ? "md:ml-28" : "md:ml-64";

  return (
    <div className="flex h-screen">
      <DashboardSidebar
        user={user}
        onLanguageToggle={toggleLanguage}
        currentLanguage={language}
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
      />

      <div
        className={`
          ${contentMl}
          relative flex-1 overflow-hidden
          bg-gradient-to-b from-white via-blue-50/60 to-indigo-50
          dark:from-[#0B1020] dark:via-[#0B1020] dark:to-[#0B1020]
        `}
      >
        {/* dekor grid halus + blob */}
        <div className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_90%_70%_at_50%_20%,black,transparent)]">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.045)_1px,transparent_1px)] bg-[size:22px_22px] dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)]" />
          <div className="absolute -top-24 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-gradient-to-tr from-indigo-400/30 via-blue-400/20 to-purple-400/20 blur-3xl" />
        </div>

        <main className="relative z-10 h-full overflow-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

export function DashboardLayoutClient({
  user,
  children,
}: {
  user: any;
  children: React.ReactNode;
}) {
  return (
    <LanguageProvider>
      <DashboardLayoutInner user={user}>{children}</DashboardLayoutInner>
    </LanguageProvider>
  );
}
