"use client";

import { useState, type MouseEvent } from "react";
import { FileDown, FolderDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { getClientFileData, type ClientFileData } from "@/lib/actions/client-file-actions";
import { cn } from "@/lib/utils";

type Look = "full" | "compact" | "icon";

/**
 * Downloads the client's Client File PDF. Loads the data when clicked, so it is
 * cheap to drop into lists. Safe inside links/clickable cards (stops the click).
 *   full    - "Download Client File" (page headers)
 *   compact - "Download"
 *   icon    - icon only, for table rows and cards
 */
export function DownloadClientFileButton({
    leadId,
    data,
    compact,
    look,
    variant,
    className,
}: {
    leadId: string;
    data?: ClientFileData | null;
    /** Same as look="compact"; kept for existing callers. */
    compact?: boolean;
    look?: Look;
    variant?: "default" | "outline" | "ghost" | "secondary";
    className?: string;
}) {
    const [busy, setBusy] = useState(false);
    const mode: Look = look ?? (compact ? "compact" : "full");

    const download = async (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (busy) return;
        setBusy(true);
        try {
            let file = data ?? null;
            if (!file) {
                const res = await getClientFileData(leadId);
                if (!res.ok) return alert(res.error);
                file = res.data;
            }
            const { downloadClientFilePdf } = await import("@/lib/client-file-pdf");
            await downloadClientFilePdf(file);
        } catch (err) {
            console.error(err);
            alert("Could not create the client file.");
        } finally {
            setBusy(false);
        }
    };

    if (mode === "icon") {
        return (
            <Button
                type="button"
                variant={variant ?? "ghost"}
                size="sm"
                onClick={download}
                disabled={busy}
                title="Download Client File"
                aria-label="Download Client File"
                className={cn("text-indigo-600 hover:text-indigo-700", className)}
            >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderDown className="h-4 w-4" />}
            </Button>
        );
    }

    return (
        <Button type="button" variant={variant} onClick={download} disabled={busy} className={cn("gap-2", className)}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            {busy ? "Preparing..." : mode === "compact" ? "Download" : "Download Client File"}
        </Button>
    );
}
