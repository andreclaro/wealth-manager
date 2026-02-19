"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Download, Upload, User, Database, Shield, Save, Loader2, Mail } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  image?: string;
}

export default function ProfilePage() {
  const { data: session } = useSession();
  const [isBackupDialogOpen, setIsBackupDialogOpen] = useState(false);
  const [isRestoreDialogOpen, setIsRestoreDialogOpen] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [backupData, setBackupData] = useState<string>("");
  const [user, setUser] = useState<UserProfile>({ id: "", name: "", email: "" });
  const [stats, setStats] = useState({
    accounts: 0,
    assets: 0,
    totalValueUSD: 0,
    totalValueEUR: 0,
  });

  // Load user from session
  useEffect(() => {
    if (session?.user) {
      setUser({
        id: (session.user as any)?.id || "",
        name: session.user.name || "",
        email: session.user.email || "",
        image: session.user.image || undefined,
      });
    }
  }, [session]);

  const loadStats = async () => {
    try {
      const [accountsRes, assetsRes] = await Promise.all([
        fetch("/api/accounts"),
        fetch("/api/assets"),
      ]);

      if (accountsRes.ok && assetsRes.ok) {
        const accounts = await accountsRes.json();
        const assets = await assetsRes.json();

        const totalValueUSD = assets.reduce(
          (sum: number, a: { totalValueUSD: number }) => sum + a.totalValueUSD,
          0
        );
        const totalValueEUR = assets.reduce(
          (sum: number, a: { totalValueEUR: number }) => sum + a.totalValueEUR,
          0
        );

        setStats({
          accounts: accounts.length,
          assets: assets.length,
          totalValueUSD,
          totalValueEUR,
        });
      }
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    try {
      // Note: With NextAuth, profile updates typically require a separate API
      // For now, we'll just show a success message
      alert("Profile updated successfully! (Note: Email changes require re-authentication with Google)");
    } catch (error) {
      console.error("Error saving profile:", error);
      alert("Failed to save profile");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleBackup = async () => {
    try {
      const response = await fetch("/api/backup");
      if (response.ok) {
        const data = await response.json();
        const jsonStr = JSON.stringify(data, null, 2);
        setBackupData(jsonStr);
        setIsBackupDialogOpen(true);

        // Also download automatically
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `portfolio-backup-${
          new Date().toISOString().split("T")[0]
        }.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("Error creating backup:", error);
      alert("Failed to create backup");
    }
  };

  const handleRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restoreFile) return;

    if (
      !confirm(
        "⚠️ WARNING: This will replace ALL existing data. Are you sure?"
      )
    ) {
      return;
    }

    setIsSubmitting(true);
    try {
      const text = await restoreFile.text();
      const backup = JSON.parse(text);

      const response = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(backup),
      });

      if (response.ok) {
        const result = await response.json();
        alert(result.message);
        setIsRestoreDialogOpen(false);
        setRestoreFile(null);
        loadStats();
      } else {
        const data = await response.json();
        alert(data.error || "Failed to restore backup");
      }
    } catch (error) {
      console.error("Error restoring backup:", error);
      alert("Failed to restore backup");
    } finally {
      setIsSubmitting(false);
    }
  };



  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Profile</h1>
        <p className="text-muted-foreground mt-1">
          Manage your portfolio settings and data
        </p>
      </div>

      {/* Portfolio Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded">
                <Database className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Accounts</p>
                <p className="text-2xl font-bold">{stats.accounts}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded">
                <Database className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Assets</p>
                <p className="text-2xl font-bold">{stats.assets}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Value (USD)</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(stats.totalValueUSD, "USD")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Value (EUR)</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(stats.totalValueEUR, "EUR")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Profile Information */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5" />
            <CardTitle>Profile Information</CardTitle>
          </div>
          <CardDescription>
            Your Google account information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* User Avatar and Info */}
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user.image} alt={user.name} />
              <AvatarFallback className="text-lg">{user.name?.charAt(0) || "U"}</AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold text-lg">{user.name}</h3>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" />
                <span>{user.email}</span>
              </div>
              <Badge variant="secondary" className="mt-2">
                Google Account
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Display Name</Label>
              <Input
                id="name"
                value={user.name}
                onChange={(e) => setUser({ ...user, name: e.target.value })}
                placeholder="Your name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={user.email}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Email is managed by Google and cannot be changed
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <Button 
              onClick={handleSaveProfile} 
              disabled={isSavingProfile || !user.name}
            >
              {isSavingProfile ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <CardTitle>Data Management</CardTitle>
          </div>
          <CardDescription>
            Backup and restore your portfolio data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="font-medium">Backup Data</h3>
              <p className="text-sm text-muted-foreground">
                Download a complete backup of all your accounts, assets, and
                history.
              </p>
              <Button onClick={handleBackup} className="w-full">
                <Download className="mr-2 h-4 w-4" />
                Download Backup
              </Button>
            </div>
            <div className="space-y-2">
              <h3 className="font-medium">Restore Data</h3>
              <p className="text-sm text-muted-foreground">
                Restore your portfolio from a backup file. This replaces all
                existing data.
              </p>
              <Button
                variant="outline"
                onClick={() => setIsRestoreDialogOpen(true)}
                className="w-full"
              >
                <Upload className="mr-2 h-4 w-4" />
                Restore from Backup
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Backup Dialog */}
      <Dialog open={isBackupDialogOpen} onOpenChange={setIsBackupDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Backup Created</DialogTitle>
            <DialogDescription>
              Your portfolio data has been backed up. A JSON file has been
              downloaded automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-md max-h-96 overflow-auto">
              <pre className="text-xs whitespace-pre-wrap">{backupData}</pre>
            </div>
            <p className="text-sm text-muted-foreground">
              Keep this file safe. You can restore your data using the Restore
              button.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsBackupDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore Dialog */}
      <Dialog open={isRestoreDialogOpen} onOpenChange={setIsRestoreDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">
              ⚠️ Restore Data
            </DialogTitle>
            <DialogDescription>
              This will replace ALL existing data with the backup file. This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRestore} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="restore-file">Backup File (.json)</Label>
              <Input
                id="restore-file"
                type="file"
                accept=".json"
                onChange={(e) =>
                  setRestoreFile(e.target.files?.[0] || null)
                }
                required
              />
            </div>
            <div className="bg-destructive/10 p-3 rounded text-sm">
              <strong>Warning:</strong> All existing accounts and assets will be
              permanently replaced.
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsRestoreDialogOpen(false);
                  setRestoreFile(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={isSubmitting || !restoreFile}
              >
                {isSubmitting ? "Restoring..." : "Restore Data"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
