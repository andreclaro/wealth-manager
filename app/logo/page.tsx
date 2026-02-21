import type { ComponentType } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface LogoProps {
  size?: number;
  className?: string;
}

type LogoComponent = ComponentType<LogoProps>;

function AscendLogo({ size = 96, className = "" }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect x="8" y="8" width="48" height="48" rx="14" fill="currentColor" opacity="0.1" />
      <path d="M16 43H48" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <rect x="18" y="32" width="7" height="11" rx="2" fill="currentColor" />
      <rect x="29" y="26" width="7" height="17" rx="2" fill="currentColor" opacity="0.9" />
      <rect x="40" y="20" width="7" height="23" rx="2" fill="currentColor" opacity="0.8" />
      <path
        d="M18 24L29 18L36 22L46 14"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M46 14H41" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M46 14V19" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function OrbitLogo({ size = 96, className = "" }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <circle cx="32" cy="32" r="23" stroke="currentColor" strokeWidth="2.5" opacity="0.28" />
      <circle cx="32" cy="32" r="16" stroke="currentColor" strokeWidth="2.5" opacity="0.5" />
      <ellipse cx="32" cy="32" rx="27" ry="11" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="51" cy="37" r="3.2" fill="currentColor" />
      <circle cx="32" cy="32" r="9.5" fill="currentColor" opacity="0.14" />
      <path
        d="M25.5 37V26.5L30.5 34L35.5 26.5V37"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M38.5 37V27.5L44 37V27.5" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
    </svg>
  );
}

function ShieldLogo({ size = 96, className = "" }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M32 8L50 15V27C50 38.2 43 48.6 32 54C21 48.6 14 38.2 14 27V15L32 8Z"
        fill="currentColor"
        opacity="0.1"
      />
      <path
        d="M32 8L50 15V27C50 38.2 43 48.6 32 54C21 48.6 14 38.2 14 27V15L32 8Z"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinejoin="round"
      />
      <path d="M22 37L29 30L34 35L43 24" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M43 24H39" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M43 24V28" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function PrismLogo({ size = 96, className = "" }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path d="M32 8L54 20V44L32 56L10 44V20L32 8Z" fill="currentColor" opacity="0.08" />
      <path d="M32 8L54 20V44L32 56L10 44V20L32 8Z" stroke="currentColor" strokeWidth="2.8" strokeLinejoin="round" />
      <path d="M32 8V56" stroke="currentColor" strokeWidth="2.4" opacity="0.9" />
      <path d="M10 20L32 32L54 20" stroke="currentColor" strokeWidth="2.4" opacity="0.9" />
      <path d="M10 44L32 32L54 44" stroke="currentColor" strokeWidth="2.4" opacity="0.65" />
      <circle cx="32" cy="32" r="4" fill="currentColor" />
    </svg>
  );
}

function MonogramLogo({ size = 96, className = "" }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect x="9" y="9" width="46" height="46" rx="12" stroke="currentColor" strokeWidth="2.8" />
      <path
        d="M15 41L20 22L26.5 37L32 22L37.5 37L44 22L49 41"
        stroke="currentColor"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="20" cy="22" r="2.2" fill="currentColor" />
      <circle cx="32" cy="22" r="2.2" fill="currentColor" />
      <circle cx="44" cy="22" r="2.2" fill="currentColor" />
      <path d="M15 46H49" stroke="currentColor" strokeWidth="2.4" opacity="0.5" />
    </svg>
  );
}

const logoConcepts: {
  id: string;
  name: string;
  intent: string;
  component: LogoComponent;
}[] = [
  {
    id: "A",
    name: "Ascend",
    intent: "Growth-first icon with bars and momentum line. Clear and compact at small app-icon sizes.",
    component: AscendLogo,
  },
  {
    id: "B",
    name: "Orbit",
    intent: "Global portfolio feel with orbital rings around a WM monogram for cross-asset tracking.",
    component: OrbitLogo,
  },
  {
    id: "C",
    name: "Shield",
    intent: "Protection + performance, combining a shield silhouette with an upward trend line.",
    component: ShieldLogo,
  },
  {
    id: "D",
    name: "Prism",
    intent: "Diversification concept built around connected portfolio segments and a central core.",
    component: PrismLogo,
  },
  {
    id: "E",
    name: "Monogram",
    intent: "A premium WM mark using a geometric monogram with subtle chart cues.",
    component: MonogramLogo,
  },
];

function SizePreview({ Logo }: { Logo: LogoComponent }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="rounded-lg border bg-background p-4 flex items-center justify-center">
        <Logo size={28} className="text-foreground" />
      </div>
      <div className="rounded-lg border bg-background p-4 flex items-center justify-center">
        <Logo size={44} className="text-foreground" />
      </div>
      <div className="rounded-lg border bg-background p-4 flex items-center justify-center">
        <Logo size={64} className="text-foreground" />
      </div>
    </div>
  );
}

export default function LogoPage() {
  return (
    <main className="min-h-screen bg-background py-12">
      <div className="container mx-auto px-4 max-w-6xl space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <p className="text-sm font-medium text-primary">Temporary Logo Lab</p>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Wealth Manager Logo Concepts</h1>
            <p className="text-muted-foreground max-w-2xl">
              Five custom directions to compare side-by-side before choosing the final brand mark.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Link>
          </Button>
        </div>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {logoConcepts.map((concept) => {
            const Logo = concept.component;

            return (
              <Card key={concept.id} className="h-full">
                <CardHeader className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                      Concept {concept.id}
                    </div>
                    <div className="text-lg font-semibold">{concept.name}</div>
                  </div>
                  <CardDescription>{concept.intent}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="rounded-xl border bg-muted/40 p-6 flex flex-col sm:flex-row items-center justify-center gap-4">
                    <Logo size={84} className="text-foreground" />
                    <div className="text-center sm:text-left">
                      <p className="text-sm text-muted-foreground">Wordmark pairing</p>
                      <p className="text-2xl font-semibold tracking-tight">Wealth Manager</p>
                    </div>
                  </div>
                  <SizePreview Logo={Logo} />
                </CardContent>
              </Card>
            );
          })}
        </section>
      </div>
    </main>
  );
}
