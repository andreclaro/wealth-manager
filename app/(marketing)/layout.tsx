import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { auth } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Wealth Manager - Track Your Wealth",
  description: "Track and manage your investment portfolio across multiple asset classes with real-time price updates, historical tracking, and multi-currency support.",
};

export default async function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  if (session) {
    redirect("/app");
  }

  return (
    <div className="relative min-h-screen overflow-x-clip bg-background">
      <div className="pointer-events-none fixed inset-0 -z-10 wm-grid-motion opacity-[0.2]" />
      <div className="pointer-events-none fixed -left-24 top-16 -z-10 h-64 w-64 rounded-full bg-foreground/8 blur-3xl wm-float-slow" />
      <div className="pointer-events-none fixed -right-28 bottom-8 -z-10 h-72 w-72 rounded-full bg-foreground/8 blur-3xl wm-float" />

      {/* Marketing Header */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="group flex items-center gap-2 font-semibold text-lg">
            <Logo size={28} />
            <span className="tracking-tight transition-opacity group-hover:opacity-80">
              Wealth Manager
            </span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              Sign In
            </Link>
            <Button asChild size="sm" className="rounded-full">
              <Link href="/login">
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      <main>{children}</main>

      {/* Marketing Footer */}
      <footer className="border-t bg-background/70 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <div className="space-y-4">
              <div className="flex items-center gap-2 font-semibold text-lg">
                <Logo size={22} />
                <span>Wealth Manager</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Track your wealth across all asset classes. Simple, powerful, and secure.
              </p>
            </div>
            <div>
              <h4 className="mb-4 font-semibold">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/" className="hover:text-foreground">Features</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 font-semibold">Resources</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/" className="hover:text-foreground">Documentation</Link></li>
                <li>
                  <Link
                    href="https://github.com/andreclaro/wealth-manager"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-foreground"
                  >
                    GitHub Repo
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-8 border-t pt-8 text-center text-sm text-muted-foreground">
            <p>© {new Date().getFullYear()} Wealth Manager. All rights reserved.</p>
            <p className="mt-2">Vibe code by andreclaro.com with ❤️</p>
          </div>
        </div>
      </footer>

    </div>
  );
}
