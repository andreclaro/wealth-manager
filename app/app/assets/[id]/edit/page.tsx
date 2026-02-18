"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AssetForm } from "@/components/AssetForm";
import { AssetHistory } from "@/components/AssetHistory";
import { UpdateModeDialog, UpdateMode } from "@/components/UpdateModeDialog";
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
  const [showUpdateModeDialog, setShowUpdateModeDialog] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<AssetFormData | null>(null);
  const [deletingHistoryId, setDeletingHistoryId] = useState<string | null>(null);
  const router = useRouter();
  const [assetId, setAssetId] = useState<string>("");

  useEffect(() => {
    params.then((p) => {
      setAssetId(p.id);
    });
  }, [params]);

  const fetchAsset = async () => {
    if (!assetId) return;
    try {
      const response = await fetch(`/api/assets/${assetId}`);
      if (response.ok) {
        const data = await response.json();
        setAsset(data);
      } else {
        router.push("/app/assets");
      }
    } catch (error) {
      console.error("Error fetching asset:", error);
      router.push("/app/assets");
    }
  };

  useEffect(() => {
    if (!assetId) return;

    const loadAsset = async () => {
      setLoading(true);
      await fetchAsset();
      setLoading(false);
    };

    loadAsset();
  }, [assetId, router]);

  const handleSubmit = async (data: AssetFormData) => {
    if (!assetId) return;
    
    // Store the form data and show the update mode dialog
    setPendingFormData(data);
    setShowUpdateModeDialog(true);
  };

  const handleUpdateConfirm = async (mode: UpdateMode, fixDate?: Date) => {
    if (!assetId || !pendingFormData) return;
    
    setSaving(true);
    setShowUpdateModeDialog(false);
    
    try {
      const response = await fetch(`/api/assets/${assetId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...pendingFormData,
          updateMode: mode,
          fixDate: fixDate?.toISOString(),
        }),
      });

      if (response.ok) {
        router.push("/app/assets");
      } else {
        const error = await response.json();
        console.error("Error updating asset:", error);
        alert(error.error || "Failed to update asset");
      }
    } catch (error) {
      console.error("Error updating asset:", error);
    } finally {
      setSaving(false);
      setPendingFormData(null);
    }
  };

  const handleDeleteHistoryEntry = async (historyId: string) => {
    if (!assetId) return;
    
    setDeletingHistoryId(historyId);
    try {
      const response = await fetch(`/api/history/${historyId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        // Refresh asset data to show updated history
        await fetchAsset();
      } else {
        const error = await response.json();
        alert(error.error || "Failed to delete history entry");
      }
    } catch (error) {
      console.error("Error deleting history entry:", error);
      alert("Failed to delete history entry");
    } finally {
      setDeletingHistoryId(null);
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
      <Button variant="ghost" onClick={() => router.push("/app/assets")}>
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
              onCancel={() => router.push("/app/assets")}
              isLoading={saving}
              submitLabel="Review Changes"
            />
          </CardContent>
        </Card>

        {/* History Section */}
        <div className="space-y-6">
          <AssetHistory
            priceHistory={asset.priceHistory}
            currency={asset.currency}
            symbol={asset.symbol}
            onDeleteEntry={handleDeleteHistoryEntry}
            isDeleting={deletingHistoryId}
          />
        </div>
      </div>

      {/* Update Mode Dialog */}
      <UpdateModeDialog
        open={showUpdateModeDialog}
        onOpenChange={setShowUpdateModeDialog}
        onConfirm={handleUpdateConfirm}
        priceHistory={asset.priceHistory}
        assetSymbol={asset.symbol}
      />
    </div>
  );
}
