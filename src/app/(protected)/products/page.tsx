'use client';

import ProductList from "@/components/products/ProductList";
import { Button } from "@/components/ui/Button";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

export default function ProductsPage() {
    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8">
            <div className="flex flex-col gap-4">
                <Link href="/dashboard">
                    {/* @ts-ignore */}
                    <Button variant="ghost" size="sm" className="-ml-2 text-zinc-500 hover:text-zinc-900">
                        <ChevronLeft className="h-4 w-4 mr-1" /> Back to Dashboard
                    </Button>
                </Link>
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Products & Rates</h1>
                    <p className="text-zinc-500">Manage your items and their current selling rates. These appear as suggestions in the builder.</p>
                </div>
            </div>

            <ProductList />
        </div>
    );
}
