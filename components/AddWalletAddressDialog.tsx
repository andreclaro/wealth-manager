"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus } from "lucide-react";
import { WalletChainType } from "@/types";

interface AddWalletAddressDialogProps {
  accountId: string;
  onAdd: (data: {
    chainType: WalletChainType;
    address: string;
    evmChainId?: number;
    isPChain?: boolean;
    label?: string;
    syncEnabled: boolean;
  }) => Promise<void>;
}

const EVM_CHAINS = [
  { id: 1, name: "Ethereum Mainnet" },
  { id: 137, name: "Polygon" },
  { id: 42161, name: "Arbitrum" },
  { id: 8453, name: "Base" },
  { id: 43114, name: "Avalanche C-Chain" },
  { id: 10, name: "Optimism" },
];

export function AddWalletAddressDialog({
  accountId,
  onAdd,
}: AddWalletAddressDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    chainType: "EVM" as WalletChainType,
    address: "",
    evmChainId: "",
    isPChain: false,
    label: "",
    syncEnabled: true,
  });
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      // Basic validation
      if (!formData.address.trim()) {
        setError("Address is required");
        return;
      }

      // Validate address format based on chain
      if (formData.chainType === "EVM") {
        const isEvm = /^0x[a-fA-F0-9]{40}$/.test(formData.address.trim());
        const isPChain = /^P-avax1[0-9a-z]+$/i.test(formData.address.trim());
        const isPChainAlt = /^avax1[0-9a-z]+$/i.test(formData.address.trim());
        
        if (!isEvm && !isPChain && !isPChainAlt) {
          setError("Invalid EVM address format (should be 0x... or P-avax1...)");
          return;
        }

        // Auto-detect P-Chain
        if (isPChain || isPChainAlt) {
          await onAdd({
            chainType: "EVM",
            address: formData.address.trim(),
            isPChain: true,
            label: formData.label || undefined,
            syncEnabled: formData.syncEnabled,
          });
        } else {
          // Regular EVM
          if (!formData.evmChainId) {
            setError("Please select a chain");
            return;
          }
          await onAdd({
            chainType: "EVM",
            address: formData.address.trim(),
            evmChainId: parseInt(formData.evmChainId),
            label: formData.label || undefined,
            syncEnabled: formData.syncEnabled,
          });
        }
      } else if (formData.chainType === "SOLANA") {
        const isSolana = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(formData.address.trim());
        if (!isSolana) {
          setError("Invalid Solana address format");
          return;
        }
        await onAdd({
          chainType: "SOLANA",
          address: formData.address.trim(),
          label: formData.label || undefined,
          syncEnabled: formData.syncEnabled,
        });
      }

      // Reset and close
      setFormData({
        chainType: "EVM",
        address: "",
        evmChainId: "",
        isPChain: false,
        label: "",
        syncEnabled: true,
      });
      setIsOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add wallet address");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Add Address
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Wallet Address</DialogTitle>
          <DialogDescription>
            Add a blockchain address to track your crypto assets
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="chainType">Chain Type</Label>
            <Select
              value={formData.chainType}
              onValueChange={(value) =>
                setFormData((prev) => ({
                  ...prev,
                  chainType: value as WalletChainType,
                  evmChainId: "",
                  isPChain: false,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EVM">EVM (Ethereum, Polygon, etc.)</SelectItem>
                <SelectItem value="SOLANA">Solana</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.chainType === "EVM" && (
            <div className="space-y-2">
              <Label htmlFor="evmChain">Chain</Label>
              <Select
                value={formData.evmChainId}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, evmChainId: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select chain" />
                </SelectTrigger>
                <SelectContent>
                  {EVM_CHAINS.map((chain) => (
                    <SelectItem key={chain.id} value={String(chain.id)}>
                      {chain.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="p-chain">Avalanche P-Chain</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                For Avalanche P-Chain, select "Avalanche P-Chain" or enter address starting with P-avax1
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, address: e.target.value }))
              }
              placeholder={
                formData.chainType === "EVM"
                  ? "0x... or P-avax1..."
                  : "Solana address"
              }
              className="font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="label">Label (Optional)</Label>
            <Input
              id="label"
              value={formData.label}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, label: e.target.value }))
              }
              placeholder="e.g., Main Wallet, Cold Storage"
            />
          </div>

          <div className="flex items-center justify-between space-x-2">
            <Label htmlFor="syncEnabled" className="text-sm font-normal">
              Enable automatic syncing
            </Label>
            <Switch
              id="syncEnabled"
              checked={formData.syncEnabled}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({
                  ...prev,
                  syncEnabled: checked,
                }))
              }
            />
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Adding..." : "Add Address"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
