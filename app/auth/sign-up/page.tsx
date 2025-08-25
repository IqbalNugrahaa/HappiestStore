import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SignUpForm from "@/components/sign-up-form";

export default async function SignUpPage() {
  if (!isSupabaseConfigured) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(40%_40%_at_50%_20%,rgba(59,130,246,0.25),transparent),radial-gradient(30%_30%_at_80%_0%,rgba(139,92,246,0.2),transparent)]" />
        <h1 className="relative z-10 text-2xl font-bold mb-4 bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600 bg-clip-text text-transparent">
          Connect Supabase to get started
        </h1>
      </div>
    );
  }

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session) redirect("/dashboard");

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-b from-white via-blue-50/60 to-indigo-50 dark:from-[#0B1020] dark:via-[#0B1020] dark:to-[#0B1020] px-4">
      <div className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_90%_70%_at_50%_20%,black,transparent)]">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.045)_1px,transparent_1px)] bg-[size:22px_22px] dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)]" />
        <div className="absolute -top-24 left-1/2 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-gradient-to-tr from-indigo-400/30 via-blue-400/20 to-purple-400/20 blur-3xl" />
      </div>
      <div className="relative z-10 w-full max-w-md">
        <SignUpForm />
      </div>
    </div>
  );
}
