import type React from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardLayoutClient } from "./dashboard-layout-client";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // If Supabase is not configured, redirect to home
  if (!isSupabaseConfigured) {
    redirect("/");
  }

  // Get the user from the server
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If no user, redirect to login
  if (!user) {
    redirect("/auth/login");
  }

  return <DashboardLayoutClient user={user}>{children}</DashboardLayoutClient>;
}
