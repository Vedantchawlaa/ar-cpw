"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { HamburgerMenu } from "@/components/shop/HamburgerMenu";
import { cn } from "@/lib/utils";

export function PublicHeader() {
    const pathname = usePathname();

    const navItems = [
        { href: "/shop", label: "Shop" },
        { href: "/shop?category=collections", label: "Our Collection" },
        { href: "/blog", label: "Blog" },
        { href: "/about", label: "About Us" },
        { href: "/contact", label: "Contact Us" },
    ];

    return (
        <header className="sticky top-0 z-50 w-full border-b border-slate-100 bg-white/80 backdrop-blur-md">
            <div className="container flex h-16 max-w-screen-2xl items-center px-4 md:px-6">
                <Link className="flex items-center gap-3 group shrink-0" href="/">
                    <img src="/logo.png" alt="Chawla Parde Wala Logo" className="h-10 w-auto transition-transform group-hover:scale-105" />
                    <div className="flex flex-col text-left">
                        <span className="font-bold text-sm tracking-tight leading-none text-slate-900 uppercase">CHAWLA</span>
                        <span className="text-[10px] font-medium text-slate-500 tracking-[0.2em] uppercase">PARDE WALA</span>
                    </div>
                </Link>

                <nav className="hidden lg:flex ml-12 gap-8 items-center">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "text-sm font-bold transition-colors uppercase tracking-widest border-b-2 py-1",
                                    isActive
                                        ? "text-slate-900 border-indigo-600"
                                        : "text-slate-500 border-transparent hover:text-slate-900 hover:border-slate-200"
                                )}
                            >
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                <div className="ml-auto flex items-center gap-4">
                    <div className="hidden md:flex items-center gap-4">
                        <Link href="/login">
                            <Button variant="ghost" size="sm" className="font-bold uppercase tracking-widest text-xs text-slate-500 hover:text-slate-900">
                                Staff Login
                            </Button>
                        </Link>
                    </div>
                    <HamburgerMenu />
                </div>
            </div>
        </header>
    );
}
