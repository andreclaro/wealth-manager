"use client";

import { useEffect } from "react";
import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Chrome, Wallet } from "lucide-react";

export default function LoginPage() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.push("/app");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse">
          <Wallet className="h-12 w-12 text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-[calc(100vh-64px)] items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0 wm-grid-motion opacity-40" />
      <div className="pointer-events-none absolute -left-20 top-10 h-56 w-56 rounded-full bg-foreground/8 blur-3xl wm-float-slow" />
      <div className="pointer-events-none absolute -right-16 bottom-0 h-64 w-64 rounded-full bg-foreground/8 blur-3xl wm-float" />

      <Card className="wm-fade-up wm-surface w-full max-w-md border-foreground/20">
        <CardHeader className="space-y-4 text-center">
          <div className="flex justify-center">
            <div className="rounded-full border bg-muted/40 p-3">
              <Wallet className="h-9 w-9 text-foreground" />
            </div>
          </div>
          <div className="flex justify-center">
            <Badge variant="outline" className="rounded-full px-3 py-1 uppercase tracking-wide text-[10px]">
              Secure Access
            </Badge>
          </div>
          <div>
            <CardTitle className="text-2xl tracking-tight">Welcome Back</CardTitle>
            <CardDescription className="mt-2">
              Sign in to track your investment portfolio
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            variant="default"
            className="h-12 w-full text-base font-medium"
            onClick={() => signIn("google", { callbackUrl: "/app" })}
          >
            <Chrome className="mr-2 h-5 w-5" />
            Continue with Google
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                Secure login
              </span>
            </div>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            By signing in, you agree to our Terms of Service and Privacy Policy
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
