"use client";

import { useState } from "react";
import { LeadList } from "./LeadList";
import { Lead } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { ArrowLeft, Search } from "lucide-react";
import Link from "next/link";

interface AllLeadsDashboardProps {
    initialLeads: Lead[];
}

export function AllLeadsDashboard({ initialLeads }: AllLeadsDashboardProps) {
    const [searchQuery, setSearchQuery] = useState("");

    const filteredLeads = initialLeads.filter(lead =>
        lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.phone.includes(searchQuery)
    );

    const handleEdit = (lead: Lead) => {
        // Since this is a full-page view, we might want to redirect to the main leads page to edit
        // or eventually implement a modal here. For now, let's redirect to the main page with editing intent.
        // But since we don't have a direct "edit" route, we'll just log it or provide a hint.
        window.location.href = `/leads?edit=${lead.id}`;
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/leads">
                        <Button variant="ghost" size="sm" className="gap-2">
                            <ArrowLeft className="h-4 w-4" />
                            Back to Dashboard
                        </Button>
                    </Link>
                    <h1 className="text-2xl font-bold tracking-tight">All Leads</h1>
                </div>
                <div className="text-sm text-muted-foreground">
                    Showing {filteredLeads.length} of {initialLeads.length} leads
                </div>
            </div>

            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                    type="text"
                    placeholder="Search all leads by name, city, or phone..."
                    className="w-full p-3 pl-10 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition-all"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                />
            </div>

            <LeadList
                leads={filteredLeads}
                onEdit={handleEdit}
            />
        </div>
    );
}
