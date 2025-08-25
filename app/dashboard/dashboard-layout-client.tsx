"use client"

import type React from "react"

import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { LanguageProvider, useLanguage } from "@/components/language-provider"

function DashboardLayoutInner({ user, children }: { user: any; children: React.ReactNode }) {
  const { language, toggleLanguage } = useLanguage()

  return (
    <div className="flex h-screen bg-background">
      <DashboardSidebar user={user} onLanguageToggle={toggleLanguage} currentLanguage={language} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  )
}

export function DashboardLayoutClient({ user, children }: { user: any; children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <DashboardLayoutInner user={user}>{children}</DashboardLayoutInner>
    </LanguageProvider>
  )
}
