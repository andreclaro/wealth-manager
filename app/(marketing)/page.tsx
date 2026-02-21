import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Card, 
  CardContent, 
  CardDescription,
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { 
  Wallet,
  Layers,
  RefreshCw,
  TrendingUp, 
  PieChart, 
  Globe, 
  Shield, 
  Zap, 
  BarChart3,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

export default function LandingPage() {
  const features = [
    {
      icon: PieChart,
      title: "Multi-Asset Tracking",
      description: "Track stocks, ETFs, bonds, real estate, crypto, and more in one place.",
    },
    {
      icon: Globe,
      title: "Multi-Currency Support",
      description: "Support for USD, EUR, GBP, CHF, JPY with automatic exchange rates.",
    },
    {
      icon: TrendingUp,
      title: "Real-Time Prices",
      description: "Automatic price updates from major exchanges and crypto markets.",
    },
    {
      icon: BarChart3,
      title: "Portfolio Analytics",
      description: "Deep insights into performance, allocation, and risk metrics.",
    },
    {
      icon: Shield,
      title: "Secure & Private",
      description: "Your data stays on your device. No cloud required.",
    },
    {
      icon: Zap,
      title: "AI-Powered Insights",
      description: "Smart recommendations to optimize your portfolio (coming soon).",
    },
  ];

  const tickerItems = [
    "Stocks",
    "ETFs",
    "Crypto",
    "Bonds",
    "Cash",
    "Real Estate",
    "Commodities",
    "Multi-Currency",
    "History Tracking",
    "Risk Analysis",
  ];

  const quickStats = [
    { label: "Asset Types", value: "9+" },
    { label: "Supported Currencies", value: "5" },
    { label: "Price Refresh", value: "Real-Time" },
    { label: "Setup Time", value: "< 2 min" },
  ];

  const workflow = [
    {
      icon: Wallet,
      title: "Connect your holdings",
      description:
        "Add accounts manually, import CSVs, or start from templates to bootstrap your portfolio quickly.",
    },
    {
      icon: Layers,
      title: "See everything in one screen",
      description:
        "Unify stocks, ETFs, crypto, and cash into one view with clean breakdowns by type, account, and currency.",
    },
    {
      icon: RefreshCw,
      title: "Review and rebalance",
      description:
        "Track performance, spot concentration risk, and take action using up-to-date allocation insights.",
    },
  ];

  return (
    <div className="flex flex-col overflow-x-clip">
      <section className="relative border-b">
        <div className="wm-grid-motion pointer-events-none absolute inset-0 opacity-60" />
        <div className="pointer-events-none absolute -left-24 top-20 h-56 w-56 rounded-full bg-foreground/8 blur-3xl wm-float-slow" />
        <div className="pointer-events-none absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-foreground/7 blur-3xl wm-float" />

        <div className="container relative mx-auto px-4 py-16 sm:py-20 lg:py-28">
          <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
            <div className="space-y-8">
              <Badge variant="outline" className="wm-fade-up gap-2 rounded-full px-3 py-1.5 text-xs font-medium tracking-wide uppercase">
                <Zap className="h-3.5 w-3.5" />
                Built for modern portfolio tracking
              </Badge>

              <div className="space-y-5">
                <h1 className="wm-fade-up wm-delay-1 text-4xl leading-tight font-semibold tracking-tight sm:text-5xl lg:text-6xl">
                  Black and white.
                  <br />
                  Pure signal.
                  <br />
                  Zero noise.
                </h1>
                <p className="wm-fade-up wm-delay-2 max-w-xl text-base text-muted-foreground sm:text-lg">
                  Wealth Manager gives you a sharp, real-time view of your full portfolio,
                  from stocks to crypto, with intelligent analytics and a fast, focused interface.
                </p>
              </div>

              <div className="wm-fade-up wm-delay-3 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="h-11 px-7 text-sm font-medium sm:text-base">
                  <Link href="/login">
                    Start Tracking
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>

              <div className="wm-fade-up wm-delay-3 grid grid-cols-2 gap-3 sm:max-w-lg sm:grid-cols-4">
                {quickStats.map((stat) => (
                  <div key={stat.label} className="rounded-lg border bg-background/80 p-3 backdrop-blur-sm">
                    <p className="text-base font-semibold sm:text-lg">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="wm-fade-up wm-delay-2 relative">
              <div className="wm-pulse-soft pointer-events-none absolute inset-0 -z-10 rounded-[2rem] bg-foreground/8 blur-2xl" />
              <Card className="relative overflow-hidden border-foreground/15 bg-background/95 shadow-2xl">
                <div className="wm-grid-motion pointer-events-none absolute inset-0 opacity-25" />
                <CardHeader className="relative space-y-3 border-b pb-5">
                  <div className="flex items-center justify-between">
                    <CardDescription className="text-xs uppercase tracking-[0.18em]">
                      Portfolio Snapshot
                    </CardDescription>
                    <Badge variant="outline" className="rounded-full border-foreground/15 bg-background/70">
                      Live
                    </Badge>
                  </div>
                  <CardTitle className="text-3xl font-semibold">$248,390.12</CardTitle>
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <TrendingUp className="h-4 w-4" />
                    +12.4% in the last 12 months
                  </p>
                </CardHeader>
                <CardContent className="relative space-y-5 pt-6">
                  <div className="rounded-xl border bg-muted/30 p-4">
                    <svg
                      className="h-24 w-full"
                      viewBox="0 0 320 120"
                      role="img"
                      aria-label="Portfolio growth line chart"
                    >
                      <defs>
                        <linearGradient id="wmLineGradient" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="currentColor" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="currentColor" stopOpacity="1" />
                        </linearGradient>
                      </defs>
                      <path
                        d="M8 98 C 48 92, 64 78, 94 80 C 132 83, 144 58, 188 61 C 228 64, 244 34, 312 26"
                        className="wm-chart-path"
                        fill="none"
                        stroke="url(#wmLineGradient)"
                        strokeWidth="3"
                        strokeLinecap="round"
                      />
                      <circle cx="312" cy="26" r="4.5" className="wm-chart-dot fill-foreground" />
                    </svg>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Stocks & ETFs</span>
                      <span className="font-medium">61%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div className="h-2 w-[61%] rounded-full bg-foreground/80 wm-grow-bar" />
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Crypto</span>
                      <span className="font-medium">24%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div className="h-2 w-[24%] rounded-full bg-foreground/60 wm-grow-bar wm-delay-2" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="wm-float absolute -left-4 top-6 hidden rounded-lg border bg-background/95 px-3 py-2 text-xs shadow-md backdrop-blur sm:block">
                +$3,140 this week
              </div>
              <div className="wm-float wm-delay-2 absolute -right-4 bottom-8 hidden rounded-lg border bg-background/95 px-3 py-2 text-xs shadow-md backdrop-blur sm:block">
                5 currencies synced
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b bg-muted/25 py-4">
        <div className="wm-marquee">
          <div className="wm-marquee-track">
            {[...tickerItems, ...tickerItems].map((item, index) => (
              <div
                key={`${item}-${index}`}
                className="mx-2 flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground sm:text-sm"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-foreground" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-24">
        <div className="container mx-auto px-4">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Everything needed to run your personal investment desk
            </h2>
            <p className="mt-4 text-muted-foreground">
              Clean data, sharp visuals, and useful signals so you can move from tracking to action.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card
                  key={feature.title}
                  className="wm-fade-up relative overflow-hidden border-foreground/10 bg-background transition-all duration-300 hover:-translate-y-1 hover:border-foreground/25 hover:shadow-xl"
                  style={{ animationDelay: `${0.05 * index}s` }}
                >
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/50 to-transparent" />
                  <CardHeader>
                    <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-lg border bg-muted/40">
                      <Icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-sm leading-relaxed">
                      {feature.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-y bg-muted/30 py-20 sm:py-24">
        <div className="container mx-auto px-4">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Move from setup to clarity in three steps
            </h2>
            <p className="mt-4 text-muted-foreground">
              The workflow is simple by design: import, analyze, and iterate.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {workflow.map((step, index) => {
              const Icon = step.icon;
              return (
                <Card
                  key={step.title}
                  className="wm-fade-up border-foreground/10 bg-background/90 backdrop-blur-sm"
                  style={{ animationDelay: `${0.12 * index}s` }}
                >
                  <CardHeader>
                    <div className="mb-2 flex items-center gap-3">
                      <div className="relative flex h-8 w-8 items-center justify-center rounded-full border bg-background text-xs font-semibold">
                        <span className="wm-ping-ring absolute inset-0 rounded-full border border-foreground/20" />
                        {index + 1}
                      </div>
                      <Icon className="h-5 w-5 text-foreground/90" />
                    </div>
                    <CardTitle className="text-lg">{step.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-sm leading-relaxed">
                      {step.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-24">
        <div className="container mx-auto px-4">
          <div className="relative overflow-hidden rounded-3xl border bg-foreground px-6 py-12 text-background sm:px-10">
            <div className="wm-grid-motion pointer-events-none absolute inset-0 opacity-20" />
            <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-background/12 blur-3xl wm-float" />
            <div className="pointer-events-none absolute -right-16 bottom-0 h-56 w-56 rounded-full bg-background/10 blur-3xl wm-float-slow" />

            <div className="relative mx-auto max-w-3xl space-y-6 text-center">
              <Badge className="mx-auto rounded-full bg-background/10 px-3 py-1 text-background">
                Ready to launch
              </Badge>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Upgrade how you manage your wealth today
              </h2>
              <p className="mx-auto max-w-2xl text-sm text-background/80 sm:text-base">
                Start free, bring your existing portfolio, and get a real-time system that stays readable as your capital grows.
              </p>
              <div className="flex flex-col justify-center gap-3 sm:flex-row">
                <Button
                  asChild
                  size="lg"
                  className="h-11 bg-background px-7 text-sm font-medium text-foreground hover:bg-background/90 sm:text-base"
                >
                  <Link href="/login">
                    Create Free Account
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="h-11 border-background/35 bg-transparent px-7 text-sm font-medium text-background hover:bg-background/10 hover:text-background sm:text-base"
                >
                  <Link href="/login">Explore the product</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
