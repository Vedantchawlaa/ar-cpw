"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/Card";
import { createLead, updateLead } from "@/lib/actions/lead-actions";
import { Lead } from "@prisma/client";

interface LeadFormProps {
    initialData?: Lead | null;
    onSuccess?: () => void;
}

export function LeadForm({ initialData, onSuccess }: LeadFormProps) {
    const [error, setError] = useState<string | null>(null);
    const formRef = useRef<HTMLFormElement>(null);

    const handleSubmit = async (formData: FormData) => {
        setError(null);
        let result;
        if (initialData) {
            result = await updateLead(initialData.id, formData);
        } else {
            result = await createLead(formData);
        }

        if (result.success) {
            formRef.current?.reset();
            onSuccess?.();
        } else {
            setError(result.error || "An unexpected error occurred");
        }
    };

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle>{initialData ? "Edit Lead" : "Add New Lead"}</CardTitle>
            </CardHeader>
            <form ref={formRef} action={handleSubmit} key={initialData?.id || "new"}>
                <CardContent className="grid gap-4">
                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm font-medium border border-red-200">
                            {error}
                        </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label htmlFor="name" className="text-sm font-medium">Name</label>
                            <Input id="name" name="name" required placeholder="Client Name" defaultValue={initialData?.name} />
                        </div>
                        <div className="space-y-2">
                            <label htmlFor="city" className="text-sm font-medium">City</label>
                            <Input id="city" name="city" required placeholder="Mumbai" defaultValue={initialData?.city} />
                        </div>
                        <div className="space-y-2">
                            <label htmlFor="phone" className="text-sm font-medium">Phone Number</label>
                            <Input id="phone" name="phone" required placeholder="+91..." defaultValue={initialData?.phone} />
                        </div>
                        <div className="space-y-2">
                            <label htmlFor="lastContacted" className="text-sm font-medium">Last Contacted</label>
                            <Input
                                id="lastContacted"
                                name="lastContacted"
                                type="date"
                                required
                                defaultValue={initialData?.lastContacted ? (initialData.lastContacted as any).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}
                            />
                        </div>
                        <div className="space-y-2">
                            <label htmlFor="nextContactDate" className="text-sm font-medium">Next Contact Date (Reminder)</label>
                            <Input
                                id="nextContactDate"
                                name="nextContactDate"
                                type="date"
                                defaultValue={(initialData as any)?.nextContactDate ? ((initialData as any).nextContactDate as any).toISOString().split('T')[0] : ""}
                            />
                        </div>
                        <div className="space-y-2">
                            <label htmlFor="expectedOrderValue" className="text-sm font-medium">Expected Order Value (₹)</label>
                            <Input id="expectedOrderValue" name="expectedOrderValue" type="number" placeholder="50000" defaultValue={initialData?.expectedOrderValue} />
                        </div>
                        <div className="space-y-2">
                            <label htmlFor="type" className="text-sm font-medium">Lead Type</label>
                            <select
                                id="type"
                                name="type"
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                defaultValue={initialData?.type || "Warm"}
                            >
                                <option value="Hot">Hot 🔥</option>
                                <option value="Warm">Warm 🌤️</option>
                                <option value="Cold">Cold ❄️</option>
                            </select>
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <label htmlFor="description" className="text-sm font-medium">Description / Notes</label>
                            <textarea
                                id="description"
                                name="description"
                                rows={3}
                                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                placeholder="Add any specific requirements or notes about this lead..."
                                defaultValue={(initialData as any)?.description || ""}
                            />
                        </div>
                        <div className="flex items-center space-x-2 md:col-span-2 pt-2">
                            <input
                                type="checkbox"
                                id="quotationShared"
                                name="quotationShared"
                                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                defaultChecked={initialData?.quotationShared}
                            />
                            <label htmlFor="quotationShared" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                Quotation Shared?
                            </label>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                    {initialData && (
                        /* @ts-ignore */
                        <Button type="button" variant="ghost" onClick={onSuccess}>Cancel</Button>
                    )}
                    <Button type="submit" className={initialData ? "flex-1 ml-2" : "w-full"}>
                        {initialData ? "Update Lead" : "Add Lead"}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    );
}
