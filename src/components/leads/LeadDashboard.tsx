"use client";

import { useState } from "react";
import { LeadForm } from "./LeadForm";
import { LeadList } from "./LeadList";
import { Lead } from "@prisma/client";

interface LeadDashboardProps {
    initialLeads: Lead[];
}

export function LeadDashboard({ initialLeads }: LeadDashboardProps) {
    const [editingLead, setEditingLead] = useState<Lead | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    const filteredLeads = initialLeads.filter(lead =>
        lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.phone.includes(searchQuery)
    );

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
                    leads={filteredLeads}
                    onEdit={handleEdit}
                />
            </div>
        </div>
    );
}
