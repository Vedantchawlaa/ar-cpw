'use client';

import * as React from 'react';
import { Search, ChevronDown, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from './Input';

export interface Option {
    id: string;
    name: string;
    [key: string]: any;
}

interface SearchableSelectProps {
    options: Option[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    emptyMessage?: string;
    className?: string;
    renderOption?: (option: Option) => React.ReactNode;
    allowClear?: boolean;
    editable?: boolean; // New prop: allows manual text entry
}

export function SearchableSelect({
    options,
    value,
    onChange,
    placeholder = "Select an option...",
    searchPlaceholder = "Search...",
    emptyMessage = "No options found.",
    className,
    renderOption,
    allowClear = false,
    editable = false,
}: SearchableSelectProps) {
    const [isOpen, setIsOpen] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState("");
    const containerRef = React.useRef<HTMLDivElement>(null);

    const selectedOption = options.find((opt) => opt.id === value || opt.name === value);

    React.useEffect(() => {
        if (editable) {
            setSearchQuery(value);
        }
    }, [value, editable]);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredOptions = options.filter((opt) =>
        opt.name.toLowerCase().includes((editable ? value : searchQuery).toLowerCase())
    );

    return (
        <div className={cn("relative w-full", className)} ref={containerRef}>
            {editable ? (
                <div className="relative">
                    <Input
                        className={cn(
                            "h-9 pr-8",
                            isOpen && "ring-2 ring-ring ring-offset-2"
                        )}
                        placeholder={placeholder}
                        value={value}
                        onChange={(e) => {
                            onChange(e.target.value);
                            setIsOpen(true);
                        }}
                        onFocus={() => setIsOpen(true)}
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <ChevronDown
                            className={cn("h-4 w-4 text-muted-foreground cursor-pointer transition-transform", isOpen && "rotate-180")}
                            onClick={() => setIsOpen(!isOpen)}
                        />
                    </div>
                </div>
            ) : (
                <div
                    className={cn(
                        "flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background cursor-pointer",
                        isOpen && "ring-2 ring-ring ring-offset-2"
                    )}
                    onClick={() => setIsOpen(!isOpen)}
                >
                    <span className={cn("truncate", !selectedOption && "text-muted-foreground")}>
                        {selectedOption ? selectedOption.name : placeholder}
                    </span>
                    <div className="flex items-center gap-1">
                        {allowClear && value && (
                            <X
                                className="h-4 w-4 text-muted-foreground hover:text-foreground cursor-pointer"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onChange("");
                                }}
                            />
                        )}
                        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                    </div>
                </div>
            )}

            {isOpen && (
                <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md outline-none animate-in fade-in zoom-in-95">
                    {!editable && (
                        <div className="flex items-center border-b px-3 py-2">
                            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                            <input
                                className="flex h-7 w-full rounded-md bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                                placeholder={searchPlaceholder}
                                autoFocus
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                    )}                    <div className="max-h-60 overflow-auto py-1">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((option) => (
                                <div
                                    key={option.id}
                                    className={cn(
                                        "relative flex w-full cursor-default select-none items-center rounded-sm px-3 py-2 text-sm outline-none hover:bg-zinc-100 transition-colors",
                                        (value === option.id || (editable && value === option.name)) && "bg-blue-50 text-blue-700"
                                    )}
                                    onClick={() => {
                                        onChange(editable ? option.name : option.id);
                                        setIsOpen(false);
                                        setSearchQuery("");
                                    }}
                                >
                                    <div className="flex-1">
                                        {renderOption ? renderOption(option) : (
                                            <span className="font-medium">{option.name}</span>
                                        )}
                                    </div>
                                    {(value === option.id || (editable && value === option.name)) && <Check className="ml-2 h-4 w-4" />}
                                </div>
                            ))
                        ) : (
                            <div className="px-3 py-4 text-sm text-center text-muted-foreground">
                                {emptyMessage}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
