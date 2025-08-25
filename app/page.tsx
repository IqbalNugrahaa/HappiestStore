import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import Link from "next/link";
import { BarChart3, DollarSign, Package, ArrowRight } from "lucide-react";

export default async function HomePage() {
  // Jika Supabase belum dikonfigurasi, tampilkan UI setup yang lebih ramah
  if (!isSupabaseConfigured) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
        {/* dekorasi */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(40%_40%_at_50%_20%,rgba(59,130,246,0.25),transparent),radial-gradient(30%_30%_at_80%_0%,rgba(139,92,246,0.2),transparent)]" />
        <div className="mx-auto max-w-xl rounded-2xl border bg-white/60 p-8 text-center shadow-xl backdrop-blur dark:border-white/10 dark:bg-black/30">
          <h1 className="mb-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-3xl font-extrabold text-transparent dark:from-sky-400 dark:via-indigo-400 dark:to-fuchsia-400">
            Connect Supabase to get started
          </h1>
          <p className="text-sm text-muted-foreground">
            Your environment variables are missing. Add your Supabase URL and
            anon key to continue.
          </p>
          <div className="mt-6">
            <Button asChild>
              <Link href="https://supabase.com/docs" target="_blank">
                Open Docs <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Cek sesi login
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session) redirect("/dashboard");

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-white via-blue-50/60 to-indigo-50 dark:from-[#0B1020] dark:via-[#0B1020] dark:to-[#0B1020]">
      {/* dekorasi latar: grid halus + blob */}
      <div className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_90%_70%_at_50%_20%,black,transparent)]">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.045)_1px,transparent_1px)] bg-[size:22px_22px] dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)]" />
        <div className="absolute -top-24 left-1/2 h-[38rem] w-[38rem] -translate-x-1/2 rounded-full bg-gradient-to-tr from-indigo-400/30 via-blue-400/20 to-purple-400/20 blur-3xl" />
      </div>

      <header className="relative z-10">
        <div className="container mx-auto flex items-center justify-between px-4 py-6">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 shadow-md ring-1 ring-white/50 dark:ring-white/10" />
            <span className="text-lg font-semibold text-foreground">
              Happiest Store
            </span>
          </div>
          <div className="hidden gap-2 sm:flex">
            <Button asChild variant="ghost">
              <Link href="/auth/login">Sign In</Link>
            </Button>
            <Button asChild>
              <Link href="/auth/sign-up">
                Get Started <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        {/* HERO */}
        <section className="container mx-auto px-4 pt-10 pb-12 sm:pt-16 sm:pb-16">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center rounded-full border bg-white/70 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
              Admin Panel
            </span>
            <h1 className="mt-4 bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600 bg-clip-text text-4xl font-extrabold leading-tight text-transparent sm:text-5xl dark:from-sky-400 dark:via-indigo-400 dark:to-fuchsia-400">
              Manage products & track revenue with ease
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
              A fast, clean dashboard to keep your store organized—supports
              Rupiah currency and multilingual UI.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link href="/auth/sign-up">
                  Create account <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="w-full sm:w-auto"
              >
                <Link href="/auth/login">I already have an account</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section className="container mx-auto px-4 pb-24">
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="group relative border-white/60 bg-white/70 shadow-sm ring-1 ring-black/5 backdrop-blur transition hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-white/5 dark:ring-white/10">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 ring-1 ring-blue-200 dark:bg-sky-500/15 dark:ring-sky-400/20">
                  <Package className="h-7 w-7 text-blue-700 dark:text-sky-300" />
                </div>
                <CardTitle>Product Management</CardTitle>
                <CardDescription>
                  Add, edit, and organize products with flexible pricing.
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-6 text-center">
                <Button
                  asChild
                  variant="ghost"
                  className="group-hover:translate-x-0.5 transition"
                >
                  <Link href="/auth/login">
                    Go to products <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="group relative border-white/60 bg-white/70 shadow-sm ring-1 ring-black/5 backdrop-blur transition hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-white/5 dark:ring-white/10">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-green-100 ring-1 ring-green-200 dark:bg-emerald-500/15 dark:ring-emerald-400/20">
                  <DollarSign className="h-7 w-7 text-green-700 dark:text-emerald-300" />
                </div>
                <CardTitle>Revenue Tracking</CardTitle>
                <CardDescription>
                  Monitor transactions and revenue in IDR—clean & accurate.
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-6 text-center">
                <Button
                  asChild
                  variant="ghost"
                  className="group-hover:translate-x-0.5 transition"
                >
                  <Link href="/auth/login">
                    View analytics <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="group relative border-white/60 bg-white/70 shadow-sm ring-1 ring-black/5 backdrop-blur transition hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-white/5 dark:ring-white/10">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-100 ring-1 ring-purple-200 dark:bg-fuchsia-500/15 dark:ring-fuchsia-400/20">
                  <BarChart3 className="h-7 w-7 text-purple-700 dark:text-fuchsia-300" />
                </div>
                <CardTitle>Bulk Import</CardTitle>
                <CardDescription>
                  Upload CSV with intelligent product matching.
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-6 text-center">
                <Button
                  asChild
                  variant="ghost"
                  className="group-hover:translate-x-0.5 transition"
                >
                  <Link href="/auth/login">
                    Import data <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      {/* CTA bar untuk layar kecil (opsional) */}
      <div className="fixed inset-x-0 bottom-0 z-20 bg-white/80 p-3 shadow-lg backdrop-blur sm:hidden dark:bg-black/40">
        <div className="mx-auto flex max-w-md gap-2">
          <Button asChild className="flex-1">
            <Link href="/auth/sign-up">Sign Up</Link>
          </Button>
          <Button asChild variant="outline" className="flex-1">
            <Link href="/auth/login">Sign In</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
