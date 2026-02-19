"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
// @ts-ignore
import { Menu, X, ShoppingBag, Grid, Info, Mail, FileText, LogIn, LogOut, User, Package } from "lucide-react";

export function HamburgerMenu() {
    const [isOpen, setIsOpen] = useState(false);
    const { data: session } = useSession();

    // Close menu on escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") setIsOpen(false);
        };

        if (isOpen) {
            document.addEventListener("keydown", handleEscape);
            document.body.style.overflow = "hidden";
        }

        return () => {
            document.removeEventListener("keydown", handleEscape);
            document.body.style.overflow = "unset";
        };
    }, [isOpen]);

    const menuItems = [
        { href: "/about", icon: Info, label: "About Us" },
    ];

    // Add My Orders if user is logged in
    const userMenuItems = session?.user
        ? [{ href: "/my-orders", icon: Package, label: "My Orders" }]
        : [];

    return (
        <>
            {/* Hamburger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                aria-label="Menu"
            >
                {isOpen ? (
                    <X className="h-6 w-6 text-slate-700" />
                ) : (
                    <Menu className="h-6 w-6 text-slate-700" />
                )}
            </button>

            {/* Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm transition-opacity duration-300 ease-out"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Slide-out Menu */}
            <div
                className={`fixed top-0 right-0 h-full w-80 max-w-[85vw] bg-white shadow-2xl z-50 transform transition-all duration-500 ease-in-out ${isOpen ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
                    }`}
            >
                <div className="flex flex-col h-full">
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-slate-200">
                        <div className="flex items-center gap-3">
                            <img src="/logo.png" alt="Logo" className="h-8 w-auto" />
                            <div className="flex flex-col">
                                <span className="font-bold text-sm tracking-tight leading-none">CHAWLA</span>
                                <span className="text-[10px] font-medium text-slate-500 tracking-[0.2em]">PARDE WALA</span>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            <X className="h-5 w-5 text-slate-500" />
                        </button>
                    </div>

                    {/* User Info (if logged in) */}
                    {session?.user && (
                        <div className="p-6 bg-slate-50 border-b border-slate-200">
                            <div className="flex items-center gap-3">
                                <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                                    <User className="h-6 w-6" />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-900">{session.user.name}</p>
                                    <p className="text-xs text-slate-500">{session.user.email}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Navigation Links */}
                    <div className="flex-1 p-4 flex flex-col justify-center">
                        <div className="space-y-1">
                            {menuItems.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={() => setIsOpen(false)}
                                    className="flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-slate-100 transition-colors group"
                                >
                                    <item.icon className="h-5 w-5 text-slate-400 group-hover:text-slate-700" />
                                    <span className="font-medium text-slate-700 group-hover:text-slate-900">
                                        {item.label}
                                    </span>
                                </Link>
                            ))}

                            {/* My Orders - Only show if logged in */}
                            {userMenuItems.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={() => setIsOpen(false)}
                                    className="flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-indigo-50 transition-colors group border-t border-slate-200 mt-2 pt-4"
                                >
                                    <item.icon className="h-5 w-5 text-indigo-400 group-hover:text-indigo-600" />
                                    <span className="font-medium text-indigo-600 group-hover:text-indigo-700">
                                        {item.label}
                                    </span>
                                </Link>
                            ))}
                        </div>
                    </div>

                    {/* Footer - Login/Logout */}
                    <div className="p-4 border-t border-slate-200">
                        {session?.user ? (
                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    signOut();
                                }}
                                className="flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-red-50 transition-colors w-full text-left group"
                            >
                                <LogOut className="h-5 w-5 text-red-400 group-hover:text-red-600" />
                                <span className="font-medium text-red-600 group-hover:text-red-700">
                                    Logout
                                </span>
                            </button>
                        ) : (
                            <Link
                                href="/login"
                                onClick={() => setIsOpen(false)}
                                className="flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-indigo-50 transition-colors group"
                            >
                                <LogIn className="h-5 w-5 text-indigo-400 group-hover:text-indigo-600" />
                                <span className="font-medium text-indigo-600 group-hover:text-indigo-700">
                                    Login
                                </span>
                            </Link>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
