"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface CSVPreviewRow {
  row: number;
  account: string;
  symbol: string;
  assetType: string;
  quantity: number;
  currency: string;
  willCreate: boolean;
  error?: string;
}

interface CSVImportResult {
  success: boolean;
  imported?: {
    accounts: string[];
    assets: number;
  };
  errors?: Array<{
    row: number;
    account?: string;
    symbol?: string;
    error: string;
  }>;
}

interface CSVImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CSVImportDialog({ open, onOpenChange, onSuccess }: CSVImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [preview, setPreview] = useState<{
    totalRows: number;
    validRows: number;
    invalidRows: number;
    errors: Array<{ row: number; error: string }>;
    accountsToCreate: string[];
    previewData: CSVPreviewRow[];
  } | null>(null);
  const [result, setResult] = useState<CSVImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.endsWith(".csv")) {
      setFile(droppedFile);
      setError(null);
    } else {
      setError("Please drop a CSV file");
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
    }
  };

  const previewCSV = async () => {
    if (!file) return;

    setIsPreviewing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("preview", "true");

      const response = await fetch("/api/import/csv", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to preview CSV");
      } else {
        setPreview(data);
      }
    } catch (err) {
      setError("Failed to preview CSV: " + (err as Error).message);
    } finally {
      setIsPreviewing(false);
    }
  };

  const importCSV = async () => {
    if (!file) return;

    setIsImporting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("preview", "false");

      const response = await fetch("/api/import/csv", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to import CSV");
      } else {
        setResult(data);
      }
    } catch (err) {
      setError("Failed to import CSV: " + (err as Error).message);
    } finally {
      setIsImporting(false);
    }
  };

  const downloadTemplate = () => {
    const template = `account,symbol,name,assetType,quantity,price,currency
"Interactive Brokers",AAPL,"Apple Inc.",STOCK,10,,USD
"Interactive Brokers",MSFT,"Microsoft Corporation",STOCK,5,,USD
"Coinbase",BTC,Bitcoin,CRYPTO,0.5,,USD
"ING Bank",EUR,"Cash - EUR",CASH,5000,1,EUR
"Revolut",VWCE,"Vanguard FTSE All-World UCITS ETF",ETF,20,,EUR`;

    const blob = new Blob([template], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "portfolio_template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        if (!newOpen) reset();
        onOpenChange(newOpen);
      }}
    >
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import from CSV
          </DialogTitle>
          <DialogDescription>
            Upload a CSV file with your accounts and assets
          </DialogDescription>
        </DialogHeader>

        {!preview && !result && (
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                CSV should have columns: <strong>account, symbol, assetType, quantity, currency</strong>
                <br />
                Optional: name, price, accountType
                <br />
                <button
                  onClick={downloadTemplate}
                  className="text-primary underline hover:no-underline mt-1"
                >
                  Download template CSV
                </button>
              </AlertDescription>
            </Alert>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`
                border-2 border-dashed rounded-lg p-8 text-center transition-colors
                ${isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"}
                ${file ? "bg-muted/50" : ""}
              `}
            >
              {file ? (
                <div className="space-y-2">
                  <FileSpreadsheet className="h-8 w-8 mx-auto text-primary" />
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFile(null)}
                  >
                    Choose different file
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                  <p className="font-medium">Drag & drop your CSV file here</p>
                  <p className="text-sm text-muted-foreground">or</p>
                  <label>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <Button variant="outline" asChild>
                      <span>Browse files</span>
                    </Button>
                  </label>
                </div>
              )}
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={previewCSV} disabled={!file || isPreviewing}>
                {isPreviewing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Preview Import
              </Button>
            </div>
          </div>
        )}

        {preview && !result && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-muted p-3 rounded text-center">
                <p className="text-2xl font-bold">{preview.totalRows}</p>
                <p className="text-sm text-muted-foreground">Total Rows</p>
              </div>
              <div className="bg-green-50 p-3 rounded text-center">
                <p className="text-2xl font-bold text-green-600">{preview.validRows}</p>
                <p className="text-sm text-muted-foreground">Valid</p>
              </div>
              <div className="bg-red-50 p-3 rounded text-center">
                <p className="text-2xl font-bold text-red-600">{preview.invalidRows}</p>
                <p className="text-sm text-muted-foreground">Invalid</p>
              </div>
            </div>

            {preview.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-medium">Errors found:</p>
                  <ul className="mt-1 space-y-1">
                    {preview.errors.slice(0, 5).map((err) => (
                      <li key={err.row} className="text-sm">
                        Row {err.row}: {err.error}
                      </li>
                    ))}
                    {preview.errors.length > 5 && (
                      <li className="text-sm">
                        ...and {preview.errors.length - 5} more
                      </li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {preview.accountsToCreate.length > 0 && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  Will create {preview.accountsToCreate.length} account(s):{" "}
                  {preview.accountsToCreate.join(", ")}
                </AlertDescription>
              </Alert>
            )}

            <div className="max-h-[300px] overflow-auto border rounded">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Row</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead>Currency</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.previewData.slice(0, 20).map((row) => (
                    <TableRow key={row.row}>
                      <TableCell>{row.row}</TableCell>
                      <TableCell>{row.account}</TableCell>
                      <TableCell className="font-medium">{row.symbol}</TableCell>
                      <TableCell>{row.assetType}</TableCell>
                      <TableCell className="text-right">{row.quantity}</TableCell>
                      <TableCell>{row.currency}</TableCell>
                    </TableRow>
                  ))}
                  {preview.previewData.length > 20 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        ...and {preview.previewData.length - 20} more rows
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setPreview(null)}>
                Back
              </Button>
              <Button
                onClick={importCSV}
                disabled={isImporting || preview.validRows === 0}
              >
                {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Import {preview.validRows} Assets
              </Button>
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <Alert className="border-green-500">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <AlertDescription className="text-green-700">
                Successfully imported {result.imported?.assets} assets across{" "}
                {result.imported?.accounts.length} account(s)
              </AlertDescription>
            </Alert>

            {result.errors && result.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-medium">
                    {result.errors.length} error(s) occurred:
                  </p>
                  <ul className="mt-1 space-y-1 max-h-[150px] overflow-auto">
                    {result.errors.map((err, idx) => (
                      <li key={idx} className="text-sm">
                        Row {err.row}: {err.error}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={reset}>
                Import Another
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
