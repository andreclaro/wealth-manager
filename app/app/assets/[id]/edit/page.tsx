"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AssetForm } from "@/components/AssetForm";
import { AssetHistory } from "@/components/AssetHistory";
import { ArrowLeft, Loader2 } from "lucide-react";
import { AssetFormData } from "@/types";
import { Asset, AssetType, Currency, PriceHistory, Account } from "@prisma/client";

interface AssetWithHistory extends Asset {
  priceHistory: PriceHistory[];
  account: Account;
}

interface EditAssetPageProps {
  params: Promise<{ id: string }>;
}

export default function EditAssetPage({ params }: EditAssetPageProps) {
  const [asset, setAsset] = useState<AssetWithHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const [assetId, setAssetId] = useState<string>("");

  useEffect(() => {
    params.then((p) => {
      setAssetId(p.id);
    });
  }, [params]);

  useEffect(() => {
    if (!assetId) return;

    const fetchAsset = async () => {
      try {
        const response = await fetch(`/api/assets/${assetId}`);
        if (response.ok) {
          const data = await response.json();
          setAsset(data);
        } else {
          router.push("/assets");
        }
      } catch (error) {
        console.error("Error fetching asset:", error);
        router.push("/assets");
      } finally {
        setLoading(false);
      }
    };

    fetchAsset();
  }, [assetId, router]);

  const handleSubmit = async (data: AssetFormData) => {
    if (!assetId) return;
    
    setSaving(true);
    try {
      const response = await fetch(`/api/assets/${assetId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        router.push("/assets");
      }
    } catch (error) {
      console.error("Error updating asset:", error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!asset) {
    return null;
  }

  const initialData: AssetFormData = {
    symbol: asset.symbol,
    name: asset.name,
    type: asset.type as AssetType,
    quantity: asset.quantity,
    purchasePrice: asset.purchasePrice || undefined,
    currency: asset.currency as Currency,
    currentPrice: asset.currentPrice || undefined,
    notes: asset.notes || "",
    isManualPrice: asset.isManualPrice,
    accountId: asset.accountId || "",
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Button variant="ghost" onClick={() => router.push("/assets")}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Assets
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Edit Form */}
        <Card>
          <CardHeader>
            <CardTitle>Edit Asset: {asset.symbol}</CardTitle>
          </CardHeader>
          <CardContent>
            <AssetForm
              initialData={initialData}
              onSubmit={handleSubmit}
              onCancel={() => router.push("/assets")}
              isLoading={saving}
              submitLabel="Save Changes"
            />
          </CardContent>
        </Card>

        {/* History Section */}
        <div className="space-y-6">
          <AssetHistory
            priceHistory={asset.priceHistory}
            currency={asset.currency}
            symbol={asset.symbol}
          />
        </div>
      </div>
    </div>
  );
}
