'use client';

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/Input";
import { Search, X } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";

export function TransactionSearch() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [value, setValue] = useState(searchParams.get("search") || "");
    const debouncedValue = useDebounce(value, 500);

    useEffect(() => {
        const params = new URLSearchParams(searchParams.toString());
        if (debouncedValue) {
            params.set("search", debouncedValue);
        } else {
            params.delete("search");
        }
        router.push(`${pathname}?${params.toString()}`);
    }, [debouncedValue, pathname, router, searchParams]);

    // Update local state if URL param changes (e.g. on back button)
    useEffect(() => {
        setValue(searchParams.get("search") || "");
    }, [searchParams]);

    return (
        <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
                placeholder="Search transactions..."
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="pl-9 pr-9 h-9 border-slate-200 bg-slate-50/50 focus:bg-white transition-colors"
            />
            {value && (
                <button
                    onClick={() => setValue("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-slate-200 rounded-md transition-colors"
                >
                    <X className="h-3 w-3 text-slate-400" />
                </button>
            )}
        </div>
    );
}
