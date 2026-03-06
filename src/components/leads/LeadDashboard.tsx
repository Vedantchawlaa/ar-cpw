"use client";

import { useState, useEffect } from "react";
import { LeadForm } from "./LeadForm";
import { LeadList } from "./LeadList";
import { Lead } from "@prisma/client";
import { MoveRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { useSearchParams } from "next/navigation";

interface LeadDashboardProps {
    initialLeads: Lead[];
}

export function LeadDashboard({ initialLeads }: LeadDashboardProps) {
    const [editingLead, setEditingLead] = useState<Lead | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const searchParams = useSearchParams();

    useEffect(() => {
        const editId = searchParams.get('edit');
        if (editId) {
            const leadToEdit = initialLeads.find(l => l.id === editId);
            if (leadToEdit) {
                setEditingLead(leadToEdit);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }
    }, [searchParams, initialLeads]);

    const filteredLeads = initialLeads.filter(lead =>
        lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.phone.includes(searchQuery)
    );

    // Only show a limited number of leads in the dashboard view
    const displayedLeads = searchQuery ? filteredLeads : filteredLeads.slice(0, 15);

    const handleEdit = (lead: Lead) => {
        setEditingLead(lead);
        // Scroll to form for better UX on mobile
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSuccess = () => {
        setEditingLead(null);
    };

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <div className="col-span-3">
                <LeadForm
                    initialData={editingLead}
                    onSuccess={handleSuccess}
                />
            </div>
            <div className="col-span-4 space-y-4">
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Search leads by name, city, or phone..."
                        className="w-full p-2 pl-3 border rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <LeadList
                    leads={displayedLeads}
                    onEdit={handleEdit}
                />
                {!searchQuery && initialLeads.length > 15 && (
                    <div className="flex justify-center pt-2">
                        <Link href="/leads/all">
                            <Button variant="outline" className="gap-2 text-blue-600 border-blue-200 hover:bg-blue-50">
                                View More Leads
                                <MoveRight className="h-4 w-4" />
                            </Button>
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
