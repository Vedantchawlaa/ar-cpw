'use client';

import * as React from "react";
import { cn } from "@/lib/utils";

const TabsContext = React.createContext<{
    value: string;
    onValueChange: (value: string) => void;
} | null>(null);

export function Tabs({ defaultValue, value, onValueChange, children, className }: any) {
    const [stateValue, setStateValue] = React.useState(defaultValue || value);

    const handleValueChange = (newValue: string) => {
        setStateValue(newValue);
        if (onValueChange) onValueChange(newValue);
    };

    const currentValue = value !== undefined ? value : stateValue;

    return (
        <TabsContext.Provider value={{ value: currentValue, onValueChange: handleValueChange }}>
            <div className={cn("", className)}>{children}</div>
        </TabsContext.Provider>
    );
}

export function TabsList({ children, className }: any) {
    return (
        <div className={cn("inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground", className)}>
            {children}
        </div>
    );
}

export function TabsTrigger({ value, children, className }: any) {
    const context = React.useContext(TabsContext);
    const isActive = context?.value === value;

    return (
        <button
            className={cn(
                "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                isActive ? "bg-background text-foreground shadow-sm" : "hover:bg-background/50 hover:text-foreground",
                className
            )}
            onClick={() => context?.onValueChange(value)}
        >
            {children}
        </button>
    );
}

export function TabsContent({ value, children, className }: any) {
    const context = React.useContext(TabsContext);
    if (context?.value !== value) return null;

    return (
        <div className={cn("mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", className)}>
            {children}
        </div>
    );
}
