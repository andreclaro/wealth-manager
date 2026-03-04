"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { AccountDetailView } from "@/components/AccountDetailView";
import { AccountWithTotals } from "@/types";
import Link from "next/link";

export default function AccountDetailPage() {
  const params = useParams();
  const router = useRouter();
  const accountId = params.id as string;
  
  const [account, setAccount] = useState<AccountWithTotals | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAccount = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/accounts/${accountId}`);
      if (response.ok) {
        const data = await response.json();
        setAccount(data);
      } else if (response.status === 404) {
        setError("Account not found");
      } else {
        setError("Failed to load account");
      }
    } catch (err) {
      console.error("Error loading account:", err);
      setError("Failed to load account");
    } finally {
      setIsLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    loadAccount();
  }, [loadAccount]);

  if (isLoading) {
    return (
      <div className="wm-page flex items-center justify-center min-h-[60vh]">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading account...
        </div>
      </div>
    );
  }

  if (error || !account) {
    return (
      <div className="wm-page">
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold mb-2">
            {error || "Account not found"}
          </h2>
          <p className="text-muted-foreground mb-4">
            The account you&apos;re looking for doesn&apos;t exist or you don&apos;t have access.
          </p>
          <Button asChild>
            <Link href="/app/accounts">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Accounts
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="wm-page">
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link href="/app/accounts">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Accounts
          </Link>
        </Button>
      </div>
      
      <AccountDetailView account={account} onUpdate={loadAccount} />
    </div>
  );
}
