"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Rocket, 
  TrendingUp, 
  Landmark, 
  Globe, 
  Coins, 
  Cpu,
  CheckCircle2,
  AlertCircle,
  Loader2
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Template {
  id: string;
  name: string;
  description: string;
  accountName: string;
  assetCount: number;
}

const ICONS: Record<string, React.ReactNode> = {
  "📈": <TrendingUp className="h-5 w-5" />,
  "₿": <Coins className="h-5 w-5" />,
  "🏦": <Landmark className="h-5 w-5" />,
  "🌍": <Globe className="h-5 w-5" />,
  "💰": <Rocket className="h-5 w-5" />,
  "🚀": <Cpu className="h-5 w-5" />,
};

interface TemplateImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function TemplateImportDialog({ open, onOpenChange, onSuccess }: TemplateImportDialogProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [customAccountName, setCustomAccountName] = useState("");
  const [isApplying, setIsApplying] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    template: string;
    account: { name: string; created: boolean };
    assets: { created: number; skipped: number; list: string[] };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchTemplates();
    }
  }, [open]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/import/template");
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates);
      }
    } catch (err) {
      console.error("Failed to fetch templates:", err);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setSelectedTemplate(null);
    setCustomAccountName("");
    setResult(null);
    setError(null);
  };

  const applyTemplate = async () => {
    if (!selectedTemplate) return;

    setIsApplying(true);
    setError(null);

    try {
      const response = await fetch("/api/import/template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          customAccountName: customAccountName || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to apply template");
      } else {
        setResult(data);
      }
    } catch (err) {
      setError("Failed to apply template: " + (err as Error).message);
    } finally {
      setIsApplying(false);
    }
  };

  const getIcon = (name: string) => {
    const icon = name.charAt(0);
    return ICONS[icon] || <TrendingUp className="h-5 w-5" />;
  };

  const getCleanName = (name: string) => {
    return name.replace(/^[📈₿🏦🌍💰🚀]\s*/, "");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        if (!newOpen) reset();
        onOpenChange(newOpen);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Quick Start Templates</DialogTitle>
          <DialogDescription>
            Choose a template to instantly set up your portfolio structure
          </DialogDescription>
        </DialogHeader>

        {!selectedTemplate && !result && (
          <div className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {templates.map((template) => (
                  <Card
                    key={template.id}
                    className="cursor-pointer transition-all hover:border-primary hover:shadow-md"
                    onClick={() => {
                      setSelectedTemplate(template);
                      setCustomAccountName(template.accountName);
                    }}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            {getIcon(template.name)}
                          </div>
                          <CardTitle className="text-base">
                            {getCleanName(template.name)}
                          </CardTitle>
                        </div>
                        <Badge variant="secondary">{template.assetCount} assets</Badge>
                      </div>
                      <CardDescription className="pt-2">
                        {template.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-sm text-muted-foreground">
                        Account: <span className="font-medium">{template.accountName}</span>
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <div className="flex justify-end">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {selectedTemplate && !result && (
          <div className="space-y-6">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This will create a new account and {selectedTemplate.assetCount} assets with{" "}
                <strong>0 quantity</strong>. You can edit quantities afterward.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 rounded-lg">
                  {getIcon(selectedTemplate.name)}
                </div>
                <div>
                  <h3 className="font-semibold">{getCleanName(selectedTemplate.name)}</h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedTemplate.description}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="account-name">Account Name</Label>
                <Input
                  id="account-name"
                  value={customAccountName}
                  onChange={(e) => setCustomAccountName(e.target.value)}
                  placeholder={selectedTemplate.accountName}
                />
                <p className="text-xs text-muted-foreground">
                  Customize the account name or leave as default
                </p>
              </div>

              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm font-medium mb-2">Assets to create:</p>
                <div className="flex flex-wrap gap-2">
                  {templates
                    .find((t) => t.id === selectedTemplate.id)
                    ?.assetCount && (
                    <>
                      {Array.from({ length: Math.min(6, selectedTemplate.assetCount) }).map(
                        (_, i) => (
                          <Badge key={i} variant="outline">
                            Asset {i + 1}
                          </Badge>
                        )
                      )}
                      {selectedTemplate.assetCount > 6 && (
                        <Badge variant="outline">
                          +{selectedTemplate.assetCount - 6} more
                        </Badge>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setSelectedTemplate(null)}>
                Back
              </Button>
              <Button onClick={applyTemplate} disabled={isApplying}>
                {isApplying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Apply Template
              </Button>
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <Alert className="border-green-500">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <AlertDescription className="text-green-700">
                <p className="font-medium">Template applied successfully!</p>
                <p className="text-sm mt-1">
                  Created {result.assets.created} assets in account "{result.account.name}"
                </p>
              </AlertDescription>
            </Alert>

            <div className="bg-muted p-4 rounded-lg space-y-2">
              <p className="text-sm font-medium">Summary:</p>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>
                  Account: {result.account.name}{" "}
                  {result.account.created ? "(created)" : "(already existed)"}
                </li>
                <li>Assets created: {result.assets.created}</li>
                {result.assets.skipped > 0 && (
                  <li>Assets skipped (already exist): {result.assets.skipped}</li>
                )}
              </ul>
              {result.assets.list.length > 0 && (
                <div className="pt-2">
                  <p className="text-xs text-muted-foreground mb-2">Created symbols:</p>
                  <div className="flex flex-wrap gap-1">
                    {result.assets.list.map((symbol) => (
                      <Badge key={symbol} variant="secondary" className="text-xs">
                        {symbol}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={reset}>
                Apply Another
              </Button>
              <Button
                onClick={() => {
                  onOpenChange(false);
                  onSuccess();
                }}
              >
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
