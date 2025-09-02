"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { signIn } from "@/lib/actions";
import { useLanguage } from "@/components/language-provider";
import { cn } from "@/lib/utils";

function SubmitButton() {
  const { pending } = useFormStatus();
  const { t } = useLanguage();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {t("signingIn")}
        </>
      ) : (
        t("signIn")
      )}
    </Button>
  );
}

export default function LoginForm() {
  const router = useRouter();
  const { t } = useLanguage();
  const [state, formAction] = useActionState(signIn, null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (state?.success) router.push("/dashboard");
  }, [state, router]);

  return (
    <Card
      className={cn(
        "w-full max-w-md border-white/60 bg-white/75 shadow-sm ring-1 ring-black/5 backdrop-blur",
        "dark:border-white/10 dark:bg-white/5 dark:ring-white/10"
      )}
    >
      <CardHeader className="space-y-1 text-center">
        <span className="mx-auto inline-flex items-center rounded-full border bg-white/70 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
          Admin Panel
        </span>
        <CardTitle className="text-2xl font-extrabold bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600 bg-clip-text text-transparent dark:from-sky-400 dark:via-indigo-400 dark:to-fuchsia-400">
          {t("welcomeBack")}
        </CardTitle>
        <CardDescription>{t("signInToAccount")}</CardDescription>
      </CardHeader>

      <CardContent>
        <form action={formAction} className="space-y-4">
          {state?.error && (
            <div className="bg-destructive/10 border border-destructive/50 text-destructive px-4 py-3 rounded">
              {state.error}
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium">
              {t("email")}
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder={t("emailPlaceholder")}
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium">
              {t("password")}
            </label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                className="pr-10"
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-2 grid place-items-center rounded-md px-2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          <SubmitButton />

          {/* <div className="text-center text-sm text-muted-foreground">
            {t("dontHaveAccount")}{" "}
            <Link href="/auth/sign-up" className="text-primary hover:underline">
              {t("signUp")}
            </Link>
          </div> */}
        </form>
      </CardContent>
    </Card>
  );
}
