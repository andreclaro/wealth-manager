"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { 
  TrendingUp, 
  PieChart, 
  Building2, 
  User, 
  BarChart3,
  LogOut,
  Loader2,
  LineChart
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const navItems = [
    { href: "/app", label: "Dashboard", icon: PieChart },
    { href: "/app/assets", label: "Assets", icon: TrendingUp },
    { href: "/app/analysis", label: "Analysis", icon: BarChart3 },
    { href: "/app/accounts", label: "Accounts", icon: Building2 },
    { href: "/app/tradingview", label: "Charts", icon: LineChart },
  ];

  useEffect(() => {
    // Check if user is logged in
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  const handleLogout = () => {
    signOut({ callbackUrl: "/" });
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const isActiveLink = (href: string) => {
    if (href === "/app") {
      return pathname === "/app";
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <div className="relative min-h-screen overflow-x-clip bg-background">
      <div className="pointer-events-none fixed inset-0 -z-10 wm-grid-motion opacity-[0.22]" />
      <div className="pointer-events-none fixed -left-24 top-20 -z-10 h-72 w-72 rounded-full bg-foreground/8 blur-3xl wm-float-slow" />
      <div className="pointer-events-none fixed -right-24 bottom-10 -z-10 h-80 w-80 rounded-full bg-foreground/8 blur-3xl wm-float" />

      {/* App Header */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/app" className="group flex items-center gap-2 font-semibold text-lg">
            <Logo size={28} />
            <span className="tracking-tight transition-opacity group-hover:opacity-80">
              Wealth Manager
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <nav className="hidden items-center gap-1 rounded-full border bg-background/75 p-1 lg:flex">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActiveLink(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0">
                  <Avatar className="h-8 w-8">
                    {session.user?.image && (
                      <AvatarImage src={session.user.image} alt={session.user.name || ""} />
                    )}
                    <AvatarFallback>{session.user?.name?.charAt(0) || "U"}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <div className="flex items-center justify-start gap-2 p-2">
                  <div className="flex flex-col space-y-1 leading-none">
                    {session.user?.name && (
                      <p className="font-medium">{session.user.name}</p>
                    )}
                    {session.user?.email && (
                      <p className="w-[200px] truncate text-sm text-muted-foreground">
                        {session.user.email}
                      </p>
                    )}
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/app/profile" className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer text-red-600 focus:text-red-600"
                  onClick={handleLogout}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="container mx-auto overflow-x-auto px-4 pb-3 lg:hidden">
          <nav className="flex min-w-max items-center gap-1 rounded-full border bg-background/70 p-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActiveLink(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    active
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 sm:py-10">{children}</main>

      <footer className="mt-auto border-t bg-background/70 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 items-center justify-center px-4 text-sm text-muted-foreground">
          Wealth Manager - Track your wealth across all asset classes
        </div>
      </footer>
    </div>
  );
}
