"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function SyncButton() {
  const [isSyncing, setIsSyncing] = useState(false);
  const router = useRouter();

  const handleSync = async () => {
    try {
      setIsSyncing(true);
      const res = await fetch("/api/sync-transactions");
      const data = await res.json();
      
      if (data.success) {
        toast.success("Success! Synced " + data.count + " new transactions.");
        // Refresh the current page to stream in the new db data
        router.refresh(); 
      } else {
        toast.error("Failed to sync: " + (data.error || "Unknown error"));
      }
    } catch (error: any) {
      toast.error("Error triggering sync: " + error.message);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <button
      onClick={handleSync}
      disabled={isSyncing}
      className="inline-flex items-center justify-center rounded-md text-sm font-medium hover:opacity-90 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-slate-900 text-slate-50 shadow h-9 px-4 py-2 gap-2 whitespace-nowrap"
    >
      {isSyncing ? (
        <>
          <RefreshCw className="h-4 w-4 animate-spin" />
          Syncing...
        </>
      ) : (
        <>
          <RefreshCw className="h-4 w-4" />
          Sync Payments
        </>
      )}
    </button>
  );
}
