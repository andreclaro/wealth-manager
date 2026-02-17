import Link from "next/link";
import { Button } from "@/components/ui/button";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { 
  TrendingUp, 
  PieChart, 
  Globe, 
  Shield, 
  Zap, 
  BarChart3,
  ArrowRight,
  CheckCircle2
} from "lucide-react";

export default function LandingPage() {
  const features = [
    {
      icon: <PieChart className="h-6 w-6" />,
      title: "Multi-Asset Tracking",
      description: "Track stocks, ETFs, bonds, real estate, crypto, and more in one place.",
    },
    {
      icon: <Globe className="h-6 w-6" />,
      title: "Multi-Currency Support",
      description: "Support for USD, EUR, GBP, CHF, JPY with automatic exchange rates.",
    },
    {
      icon: <TrendingUp className="h-6 w-6" />,
      title: "Real-Time Prices",
      description: "Automatic price updates from major exchanges and crypto markets.",
    },
    {
      icon: <BarChart3 className="h-6 w-6" />,
      title: "Portfolio Analytics",
      description: "Deep insights into performance, allocation, and risk metrics.",
    },
    {
      icon: <Shield className="h-6 w-6" />,
      title: "Secure & Private",
      description: "Your data stays on your device. No cloud required.",
    },
    {
      icon: <Zap className="h-6 w-6" />,
      title: "AI-Powered Insights",
      description: "Smart recommendations to optimize your portfolio (coming soon).",
    },
  ];

  const assetTypes = [
    "Stocks & ETFs",
    "Cryptocurrencies",
    "Bonds",
    "Real Estate",
    "Commodities",
    "Cash & Savings",
  ];

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative py-20 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-background" />
        <div className="container mx-auto px-4 relative">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
              <Zap className="h-4 w-4" />
              Now with AI-Powered Analysis
            </div>
            <h1 className="text-4xl lg:text-6xl font-bold tracking-tight">
              Track Your Wealth{" "}
              <span className="text-primary">All in One Place</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              The modern portfolio tracker for sophisticated investors. 
              Track stocks, crypto, real estate, and more across multiple currencies.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="text-lg px-8">
                <Link href="/login">
                  Get Started Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="text-lg px-8">
                <Link href="/login">
                  View Demo
                </Link>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              No credit card required. Free forever.
            </p>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 border-y bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-3xl font-bold">9+</div>
              <div className="text-sm text-muted-foreground">Asset Types</div>
            </div>
            <div>
              <div className="text-3xl font-bold">5</div>
              <div className="text-sm text-muted-foreground">Currencies</div>
            </div>
            <div>
              <div className="text-3xl font-bold">Real-Time</div>
              <div className="text-sm text-muted-foreground">Price Updates</div>
            </div>
            <div>
              <div className="text-3xl font-bold">100%</div>
              <div className="text-sm text-muted-foreground">Free</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl font-bold mb-4">Everything You Need</h2>
            <p className="text-muted-foreground">
              Powerful features to help you track, analyze, and optimize your investment portfolio.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <Card key={feature.title} className="group hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    {feature.icon}
                  </div>
                  <CardTitle>{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Asset Types Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">Track Any Asset</h2>
              <p className="text-muted-foreground">
                From traditional stocks to modern cryptocurrencies, track all your investments.
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {assetTypes.map((type) => (
                <div 
                  key={type}
                  className="flex items-center gap-3 p-4 bg-background rounded-lg border"
                >
                  <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                  <span className="font-medium">{type}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <h2 className="text-3xl font-bold">Ready to Start Tracking?</h2>
            <p className="text-xl text-muted-foreground">
              Join thousands of investors who trust Portfolio Tracker to manage their wealth.
            </p>
            <Button asChild size="lg" className="text-lg px-8">
              <Link href="/login">
                Create Free Account
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
