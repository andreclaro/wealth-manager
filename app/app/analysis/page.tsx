"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  PieChart, 
  AlertTriangle,
  Target,
  Brain,
  Wallet,
  Percent
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Cell,
} from "recharts";
import { PortfolioAnalysis, AssetPerformance, ASSET_TYPE_LABELS, ASSET_TYPE_COLORS } from "@/types";
import { formatCurrency, formatPercent } from "@/lib/utils";

export default function AnalysisPage() {
  const [data, setData] = useState<PortfolioAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalysis();
  }, []);

  const fetchAnalysis = async () => {
    try {
      const response = await fetch("/api/analysis");
      if (!response.ok) throw new Error("Failed to fetch analysis");
      const analysis = await response.json();
      setData(analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analysis");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <AnalysisSkeleton />;
  if (error) return <div className="text-red-500">{error}</div>;
  if (!data) return null;

  const { summary, performance, topPerformers, worstPerformers, allocation, riskMetrics } = data;

  // Prepare chart data
  const typeChartData = Object.entries(allocation.byType).map(([type, data]) => ({
    name: ASSET_TYPE_LABELS[type as keyof typeof ASSET_TYPE_LABELS] || type,
    value: data.valueUSD,
    percent: data.percent,
    color: ASSET_TYPE_COLORS[type as keyof typeof ASSET_TYPE_COLORS] || "#8884d8",
  }));

  const currencyChartData = Object.entries(allocation.byCurrency).map(([currency, data]) => ({
    name: currency,
    value: data.valueUSD,
    percent: data.percent,
  }));

  const accountChartData = Object.entries(allocation.byAccount).map(([account, data]) => ({
    name: account,
    value: data.valueUSD,
    percent: data.percent,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Portfolio Analysis</h1>
          <p className="text-muted-foreground">
            Deep insights into your portfolio performance and risk metrics
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Current Value"
          value={formatCurrency(summary.currentValueUSD, "USD")}
          icon={<Wallet className="h-4 w-4" />}
        />
        <SummaryCard
          title="Total Invested"
          value={formatCurrency(summary.totalInvestedUSD, "USD")}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <SummaryCard
          title="Unrealized P&L"
          value={formatCurrency(summary.totalUnrealizedPnLUSD, "USD")}
          icon={summary.totalUnrealizedPnLUSD >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          trend={summary.totalUnrealizedPnLUSD >= 0 ? "positive" : "negative"}
        />
        <SummaryCard
          title="Total Return"
          value={formatPercent(summary.totalReturnPercent)}
          icon={<Percent className="h-4 w-4" />}
          trend={summary.totalReturnPercent >= 0 ? "positive" : "negative"}
        />
      </div>

      {/* AI Insights Placeholder */}
      <Card className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30 border-purple-200 dark:border-purple-800">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-600" />
            <CardTitle className="text-purple-900 dark:text-purple-100">AI Insights</CardTitle>
          </div>
          <CardDescription className="text-purple-700 dark:text-purple-300">
            Smart analysis and recommendations powered by AI (coming soon)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-white/60 dark:bg-black/20 rounded-lg">
              <Target className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Portfolio Optimization</p>
                <p className="text-sm text-muted-foreground">
                  AI-powered recommendations will appear here to help optimize your asset allocation and reduce risk.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-white/60 dark:bg-black/20 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Risk Alerts</p>
                <p className="text-sm text-muted-foreground">
                  Potential risk factors and concentration warnings will be highlighted here.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Allocation Charts */}
      <Tabs defaultValue="type" className="space-y-4">
        <TabsList>
          <TabsTrigger value="type">By Type</TabsTrigger>
          <TabsTrigger value="currency">By Currency</TabsTrigger>
          <TabsTrigger value="account">By Account</TabsTrigger>
        </TabsList>
        
        <TabsContent value="type">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                Asset Allocation by Type
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                    <Pie
                      data={typeChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(1)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {typeChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(Number(value) || 0, "USD")} />
                  </RePieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="currency">
          <Card>
            <CardHeader>
              <CardTitle>Allocation by Currency</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={currencyChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(value) => typeof value === "number" ? formatCurrency(value, "USD") : value} />
                    <Bar dataKey="value" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="account">
          <Card>
            <CardHeader>
              <CardTitle>Allocation by Account</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={accountChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(value) => typeof value === "number" ? formatCurrency(value, "USD") : value} />
                    <Bar dataKey="value" fill="#8b5cf6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Risk Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Risk Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Diversification Score */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Diversification Score</span>
              <Badge variant={riskMetrics.diversificationScore > 60 ? "default" : "destructive"}>
                {riskMetrics.diversificationScore}/100
              </Badge>
            </div>
            <Progress value={riskMetrics.diversificationScore} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {riskMetrics.diversificationScore > 60 
                ? "Your portfolio is well diversified across asset types."
                : "Consider diversifying across more asset types to reduce risk."}
            </p>
          </div>

          {/* Top Holdings */}
          <div className="space-y-3">
            <h4 className="font-medium">Top Holdings</h4>
            {riskMetrics.topHoldings.map((holding, index) => (
              <div key={holding.symbol} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground w-4">{index + 1}</span>
                  <div>
                    <p className="font-medium text-sm">{holding.symbol}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[150px]">{holding.name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-sm">{formatCurrency(holding.valueUSD, "USD")}</p>
                  <p className="text-xs text-muted-foreground">{holding.allocationPercent.toFixed(1)}%</p>
                </div>
              </div>
            ))}
          </div>

          {/* Currency Exposure */}
          <div className="space-y-3">
            <h4 className="font-medium">Currency Exposure</h4>
            <div className="grid gap-2 sm:grid-cols-2">
              {riskMetrics.currencyExposure.map((item) => (
                <div key={item.currency} className="flex items-center justify-between p-2 bg-muted rounded">
                  <span className="text-sm font-medium">{item.currency}</span>
                  <span className="text-sm">{item.percent.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Tables */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Top Performers */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-green-600">
              <TrendingUp className="h-5 w-5" />
              Top Performers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topPerformers.map((asset) => (
                <PerformanceRow key={asset.id} asset={asset} positive />
              ))}
              {topPerformers.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No data available</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Worst Performers */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-red-600">
              <TrendingDown className="h-5 w-5" />
              Needs Attention
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {worstPerformers.map((asset) => (
                <PerformanceRow key={asset.id} asset={asset} positive={false} />
              ))}
              {worstPerformers.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No data available</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Full Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Assets Performance</CardTitle>
          <CardDescription>Detailed breakdown of every asset in your portfolio</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2 text-sm font-medium">Asset</th>
                  <th className="text-right py-3 px-2 text-sm font-medium">Cost Basis</th>
                  <th className="text-right py-3 px-2 text-sm font-medium">Current Value</th>
                  <th className="text-right py-3 px-2 text-sm font-medium">P&L</th>
                  <th className="text-right py-3 px-2 text-sm font-medium">Return</th>
                  <th className="text-right py-3 px-2 text-sm font-medium">Allocation</th>
                </tr>
              </thead>
              <tbody>
                {performance
                  .sort((a, b) => b.currentValueUSD - a.currentValueUSD)
                  .map((asset) => (
                    <tr key={asset.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-2">
                        <div>
                          <p className="font-medium text-sm">{asset.symbol}</p>
                          <p className="text-xs text-muted-foreground">{asset.name}</p>
                        </div>
                      </td>
                      <td className="text-right py-3 px-2 text-sm">
                        {formatCurrency(asset.costBasisUSD, "USD")}
                      </td>
                      <td className="text-right py-3 px-2 text-sm font-medium">
                        {formatCurrency(asset.currentValueUSD, "USD")}
                      </td>
                      <td className={`text-right py-3 px-2 text-sm ${asset.unrealizedPnLUSD >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {formatCurrency(asset.unrealizedPnLUSD, "USD")}
                      </td>
                      <td className={`text-right py-3 px-2 text-sm ${asset.returnPercent >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {formatPercent(asset.returnPercent)}
                      </td>
                      <td className="text-right py-3 px-2 text-sm">
                        {asset.allocationPercent.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ 
  title, 
  value, 
  icon, 
  trend 
}: { 
  title: string; 
  value: string; 
  icon: React.ReactNode;
  trend?: "positive" | "negative";
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={`${trend === "positive" ? "text-green-600" : trend === "negative" ? "text-red-600" : "text-muted-foreground"}`}>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${trend === "positive" ? "text-green-600" : trend === "negative" ? "text-red-600" : ""}`}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

function PerformanceRow({ asset, positive }: { asset: AssetPerformance | { symbol: string; name?: string; type: AssetPerformance["type"]; currency: AssetPerformance["currency"]; returnPercent: number; currentValueUSD: number }; positive: boolean }) {
  return (
    <div className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${positive ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"}`}>
          {positive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
        </div>
        <div>
          <p className="font-medium text-sm">{asset.symbol}</p>
          <p className="text-xs text-muted-foreground">{ASSET_TYPE_LABELS[asset.type]}</p>
        </div>
      </div>
      <div className="text-right">
        <p className={`font-medium text-sm ${positive ? "text-green-600" : "text-red-600"}`}>
          {formatPercent(asset.returnPercent)}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatCurrency(asset.currentValueUSD, "USD")}
        </p>
      </div>
    </div>
  );
}

function AnalysisSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-4 w-96" />
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      
      <Skeleton className="h-48" />
      
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}
