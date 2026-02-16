import Link from "next/link";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { auth } from "@/auth";
import { Button } from "@/components/ui/Button";
import { UserMenu } from "@/components/layout/UserMenu";

export async function Header() {
    const session = await auth();

    return (
        <header className="flex h-16 items-center gap-4 border-b bg-white px-6 w-full lg:h-[64px]">
            <div className="w-full flex-1">
                <form>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Search leads, orders..."
                            className="w-full appearance-none bg-slate-50 pl-9 shadow-none md:w-2/3 lg:w-1/3"
                        />
                    </div>
                </form>
            </div>
            <div className="flex items-center gap-4">
                {session?.user ? (
                    <UserMenu
                        userName={session.user.name || "User"}
                        userEmail={session.user.email || undefined}
                    />
                ) : (
                    <Link href="/login">
                        <Button size="sm">Login</Button>
                    </Link>
                )}
            </div>
        </header>
    );
}
