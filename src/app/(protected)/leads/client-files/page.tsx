import { getClientFileList } from "@/lib/actions/client-file-actions";
import { LeadsTabs } from "@/components/leads/LeadsTabs";
import { ClientFilesList } from "@/components/leads/ClientFilesList";

export default async function ClientFilesPage() {
    const clients = await getClientFileList();

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Client Files</h2>
                    <p className="text-sm text-muted-foreground">Download a client&apos;s full printable file: profile, measurements, tracks, cutting plan and more.</p>
                </div>
                <LeadsTabs />
            </div>
            <ClientFilesList clients={clients} />
        </div>
    );
}
