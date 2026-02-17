import type { Metadata } from "next";
import Link from "next/link";
import { Wallet, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Investment Portfolio Tracker - Track Your Wealth",
  description: "Track and manage your investment portfolio across multiple asset classes with real-time price updates, historical tracking, and multi-currency support.",
};

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
        {/* Marketing Header */}
        <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 font-bold text-xl">
              <Wallet className="h-6 w-6 text-primary" />
              <span>Portfolio Tracker</span>
            </Link>
            <nav className="flex items-center gap-4">
              <Link
                href="/login"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Sign In
              </Link>
              <Button asChild size="sm">
                <Link href="/login">
                  Get Started
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </nav>
          </div>
        </header>

        {children}

        {/* Marketing Footer */}
        <footer className="border-t bg-muted/30">
          <div className="container mx-auto px-4 py-12">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div className="space-y-4">
                <div className="flex items-center gap-2 font-bold text-lg">
                  <Wallet className="h-5 w-5 text-primary" />
                  <span>Portfolio Tracker</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Track your wealth across all asset classes. Simple, powerful, and secure.
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-4">Product</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li><Link href="/" className="hover:text-foreground">Features</Link></li>
                  <li><Link href="/" className="hover:text-foreground">Pricing</Link></li>
                  <li><Link href="/" className="hover:text-foreground">Security</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-4">Resources</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li><Link href="/" className="hover:text-foreground">Documentation</Link></li>
                  <li><Link href="/" className="hover:text-foreground">API</Link></li>
                  <li><Link href="/" className="hover:text-foreground">Support</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-4">Legal</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li><Link href="/" className="hover:text-foreground">Privacy</Link></li>
                  <li><Link href="/" className="hover:text-foreground">Terms</Link></li>
                </ul>
              </div>
            </div>
            <div className="border-t mt-8 pt-8 text-center text-sm text-muted-foreground">
              © {new Date().getFullYear()} Portfolio Tracker. All rights reserved.
            </div>
          </div>
        </footer>
    </>
  );
}
