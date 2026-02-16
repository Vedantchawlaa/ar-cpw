"use client";

import { useState } from "react";
// @ts-ignore
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface User {
    id: string;
    name: string | null;
    email: string;
    role: string;
    createdAt: Date;
}

interface UserListProps {
    users: User[];
    title: string;
    icon: React.ReactNode;
    description: string;
    emptyMessage?: string;
}

export function UserList({ users, title, icon, description, emptyMessage = "No users found." }: UserListProps) {
    const [showAll, setShowAll] = useState(false);
    const displayedUsers = showAll ? users : users.slice(0, 3);
    const hasMore = users.length > 3;

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
                    {icon}
                    {title} ({users.length})
                </h2>
                <p className="text-sm text-muted-foreground">{description}</p>
            </div>

            {users.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed text-slate-400 flex flex-col items-center">
                    <div className="opacity-50 mb-2 scale-150 relative">
                        {icon}
                    </div>
                    <p>{emptyMessage}</p>
                </div>
            ) : (
                <>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {displayedUsers.map(user => (
                            <div key={user.id} className="flex items-center gap-4 p-4 rounded-xl border bg-white shadow-sm">
                                <div className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center text-white font-bold ${user.role === 'customer'
                                    ? 'bg-emerald-100 text-emerald-600'
                                    : (user.role === 'admin' ? 'bg-indigo-600' : 'bg-slate-500')
                                    }`}>
                                    {user.name?.charAt(0).toUpperCase() || 'U'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{user.name}</p>
                                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                                </div>
                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${user.role === 'customer'
                                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                    : (user.role === 'admin'
                                        ? 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                                        : 'bg-slate-100 text-slate-600 border border-slate-200')
                                    }`}>
                                    {user.role === 'admin' ? 'Admin' : (user.role === 'customer' ? 'Customer' : 'Staff')}
                                </span>
                            </div>
                        ))}
                    </div>

                    {hasMore && (
                        <div className="flex justify-center">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowAll(!showAll)}
                                className="text-muted-foreground"
                            >
                                {showAll ? (
                                    <>Show Less <ChevronUp className="ml-2 h-4 w-4" /></>
                                ) : (
                                    <>Show {users.length - 3} More <ChevronDown className="ml-2 h-4 w-4" /></>
                                )}
                            </Button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
