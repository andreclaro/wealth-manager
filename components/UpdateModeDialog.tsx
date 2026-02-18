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
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Edit, History, Plus } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { PriceHistory } from "@prisma/client";

export type UpdateMode = "modify" | "new" | "fix";

interface UpdateModeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (mode: UpdateMode, fixDate?: Date) => void;
  priceHistory: PriceHistory[];
  assetSymbol: string;
}

export function UpdateModeDialog({
  open,
  onOpenChange,
  onConfirm,
  priceHistory,
  assetSymbol,
}: UpdateModeDialogProps) {
  const [mode, setMode] = useState<UpdateMode>("modify");
  const [fixDate, setFixDate] = useState<Date>();
  const [selectedHistoryId, setSelectedHistoryId] = useState<string>("");

  const handleConfirm = () => {
    if (mode === "fix" && !fixDate && !selectedHistoryId) {
      return;
    }
    
    // If fixing by history ID, get the date from that entry
    if (mode === "fix" && selectedHistoryId) {
      const entry = priceHistory.find(h => h.id === selectedHistoryId);
      if (entry) {
        onConfirm(mode, new Date(entry.recordedAt));
      }
    } else {
      onConfirm(mode, fixDate);
    }
    
    // Reset state
    setMode("modify");
    setFixDate(undefined);
    setSelectedHistoryId("");
  };

  const handleCancel = () => {
    onOpenChange(false);
    setMode("modify");
    setFixDate(undefined);
    setSelectedHistoryId("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>How would you like to save these changes?</DialogTitle>
          <DialogDescription>
            Choose how to update <strong>{assetSymbol}</strong>. This affects your portfolio history.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={mode}
          onValueChange={(v) => setMode(v as UpdateMode)}
          className="space-y-4"
        >
          {/* Modify Current */}
          <div
            className={cn(
              "flex items-start space-x-3 rounded-lg border p-4 cursor-pointer transition-colors",
              mode === "modify" && "border-primary bg-primary/5"
            )}
            onClick={() => setMode("modify")}
          >
            <RadioGroupItem value="modify" id="modify" className="mt-1" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Edit className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="modify" className="font-medium cursor-pointer">
                  Modify Current Entry
                </Label>
              </div>
              <p className="text-sm text-muted-foreground mt-1 ml-6">
                Updates the asset normally. Creates a new history point only if price or quantity changed.
              </p>
            </div>
          </div>

          {/* Add New Entry */}
          <div
            className={cn(
              "flex items-start space-x-3 rounded-lg border p-4 cursor-pointer transition-colors",
              mode === "new" && "border-primary bg-primary/5"
            )}
            onClick={() => setMode("new")}
          >
            <RadioGroupItem value="new" id="new" className="mt-1" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="new" className="font-medium cursor-pointer">
                  Add New History Entry
                </Label>
              </div>
              <p className="text-sm text-muted-foreground mt-1 ml-6">
                Creates a new history record for today with the new values. Useful for tracking changes over time.
              </p>
            </div>
          </div>

          {/* Fix Older Entry */}
          <div
            className={cn(
              "flex items-start space-x-3 rounded-lg border p-4 cursor-pointer transition-colors",
              mode === "fix" && "border-primary bg-primary/5"
            )}
            onClick={() => setMode("fix")}
          >
            <RadioGroupItem value="fix" id="fix" className="mt-1" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="fix" className="font-medium cursor-pointer">
                  Fix Older Entry
                </Label>
              </div>
              <p className="text-sm text-muted-foreground mt-1 ml-6">
                Corrects a historical record. Use this to fix data errors in your history.
              </p>
              
              {mode === "fix" && (
                <div className="mt-3 ml-6 space-y-3">
                  {priceHistory.length > 0 ? (
                    <div className="space-y-2">
                      <Label className="text-xs">Select historical entry:</Label>
                      <select
                        value={selectedHistoryId}
                        onChange={(e) => {
                          setSelectedHistoryId(e.target.value);
                          setFixDate(undefined);
                        }}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="">-- Select a date --</option>
                        {priceHistory.slice(0, 20).map((h) => (
                          <option key={h.id} value={h.id}>
                            {format(new Date(h.recordedAt), "PPP")} - {h.price.toFixed(2)} ({h.quantity} units)
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                  
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Or pick a date:</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            "justify-start text-left font-normal",
                            !fixDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {fixDate ? format(fixDate, "PPP") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={fixDate}
                          onSelect={(date) => {
                            setFixDate(date);
                            setSelectedHistoryId("");
                          }}
                          disabled={(date) => date > new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  
                  {(fixDate || selectedHistoryId) && (
                    <p className="text-xs text-amber-600">
                      Will update the history entry closest to: {" "}
                      {fixDate ? format(fixDate, "PPP") : selectedHistoryId ? format(new Date(priceHistory.find(h => h.id === selectedHistoryId)?.recordedAt || new Date()), "PPP") : ""}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </RadioGroup>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={mode === "fix" && !fixDate && !selectedHistoryId}
          >
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
