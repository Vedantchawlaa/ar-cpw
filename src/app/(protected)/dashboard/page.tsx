import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Activity, CreditCard, DollarSign, Users, ArrowUpRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import prisma from "@/lib/db";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { DashboardFilter } from "@/components/dashboard/DashboardFilter";
import { auth } from "@/auth";
import { Suspense } from "react";
import { RealtimeListener } from "@/components/RealtimeListener";

export const dynamic = "force-dynamic";

// ─── Skeleton shown instantly while stats load ────────────────────────────────
function StatsSkeleton() {
    return (
        <div className="flex flex-col gap-6">
            <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                    <Card key={i} className="animate-pulse">
                        <CardHeader className="pb-2">
                            <div className="h-3 w-24 bg-slate-200 rounded" />
                        </CardHeader>
                        <CardContent>
                            <div className="h-8 w-32 bg-slate-200 rounded mb-2" />
                            <div className="h-2 w-20 bg-slate-100 rounded" />
                        </CardContent>
                    </Card>
                ))}
            </div>
            <div className="grid gap-4 md:gap-8 lg:grid-cols-2 xl:grid-cols-3">
                <Card className="xl:col-span-2 animate-pulse">
                    <CardHeader><div className="h-5 w-40 bg-slate-200 rounded" /></CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-slate-100 rounded" />)}
                        </div>
                    </CardContent>
                </Card>
                <Card className="animate-pulse">
                    <CardHeader><div className="h-5 w-32 bg-slate-200 rounded" /></CardHeader>
                    <CardContent><div className="h-32 bg-slate-100 rounded" /></CardContent>
                </Card>
            </div>
        </div>
    );
}

// ─── Async data component (streamed via Suspense) ─────────────────────────────
async function DashboardStats({ range, from, to }: { range: string; from?: string; to?: string }) {
    const session = await auth();
    const role = (session?.user as any)?.role;
    const userId = session?.user?.id;

    // Date filter
    const now = new Date();
    let dateFilter: any = {};
    if (range !== "all") {
        let startDate = new Date();
        if (range === "24h") startDate.setHours(now.getHours() - 24);
        else if (range === "48h") startDate.setHours(now.getHours() - 48);
        else if (range === "7d") startDate.setDate(now.getDate() - 7);
        else if (range === "14d") startDate.setDate(now.getDate() - 14);
        else if (range === "1mo") startDate.setMonth(now.getMonth() - 1);
        else if (range === "curr") { startDate = new Date(now.getFullYear(), now.getMonth(), 1); startDate.setHours(0, 0, 0, 0); }
        else if (range === "custom" && from) { startDate = new Date(from); startDate.setHours(0, 0, 0, 0); }
        dateFilter = { gte: startDate };
        if (range === "custom" && to) { const endDate = new Date(to); endDate.setHours(23, 59, 59, 999); dateFilter.lte = endDate; }
    }

    const vf = role === "admin" ? {} : { userId };
    const df = Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {};
    const tdf = Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {};

    let totalRevenue = 0, leadsCount = 0, quotationsCount = 0, convertedLeadsCount = 0;
    let recentQuotations: any[] = [];
    let cashIn = 0, cashOut = 0;
    let openingBalance: number | null = null;
    let currentBalance: number | null = null;
    let dbError = false, errorMessage = "";

    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    try {
        const [rev, lc, qc, cc, rq, txns, monthBal] = await Promise.all([
            (prisma as any).quotation.aggregate({ where: { status: "SALE", ...vf, ...df }, _sum: { receivedAmount: true } }),
            (prisma as any).lead.count({ where: { ...vf, ...df } }),
            (prisma as any).quotation.count({ where: { ...vf, ...df } }),
            (prisma as any).lead.count({ where: { ...vf, ...df, quotations: { some: { status: "SALE" } } } }),
            (prisma as any).quotation.findMany({ take: 5, where: { ...vf, ...df }, orderBy: { createdAt: "desc" }, include: { lead: { select: { name: true } } } }),
            (prisma as any).transaction.groupBy({ by: ["type"], where: { ...tdf }, _sum: { amount: true } }),
            (prisma as any).monthlyBalance.findUnique({ where: { month_year: { month: thisMonth, year: thisYear } } }),
        ]);
        totalRevenue = rev._sum.receivedAmount || 0;
        leadsCount = lc; quotationsCount = qc; convertedLeadsCount = cc; recentQuotations = rq;
        for (const t of txns) {
            if (t.type === "INCOME") cashIn = t._sum.amount || 0;
            if (t.type === "EXPENSE") cashOut = t._sum.amount || 0;
        }
        if (monthBal) {
            openingBalance = monthBal.startingBalance;
            currentBalance = monthBal.endingBalance ?? null;
        }
    } catch (e: any) {
        console.error("Dashboard fetch failed:", e);
        dbError = true; errorMessage = e.message || String(e);
    }

    const conversionRate = leadsCount > 0 ? Math.min((convertedLeadsCount / leadsCount) * 100, 100) : 0;

    return (
        <div className="flex flex-col gap-6">
            {dbError && (
                <Card className="border-rose-200 bg-rose-50/50">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-rose-800 flex items-center gap-2">
                            <Activity className="h-5 w-5" /> Database Connection Issue
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-rose-700">Unable to fetch metrics. Check your database connection.</p>
                        {errorMessage && <div className="mt-2 p-2 bg-rose-200/30 rounded text-rose-900 font-mono text-[10px] break-all">Error: {errorMessage}</div>}
                    </CardContent>
                </Card>
            )}

            <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
                <Card className="hover:shadow-md transition-shadow relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                        <DollarSign className="h-4 w-4 text-emerald-600 group-hover:scale-110 transition-transform" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">₹{formatCurrency(Math.round(totalRevenue))}</div>
                        <p className="text-xs text-muted-foreground mt-1">{range === "all" ? "Lifetime earnings" : `Revenue for ${range}`}</p>
                    </CardContent>
                </Card>
                <Card className="hover:shadow-md transition-shadow relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">New Leads</CardTitle>
                        <Users className="h-4 w-4 text-blue-600 group-hover:scale-110 transition-transform" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{leadsCount}</div>
                        <p className="text-xs text-muted-foreground mt-1">{range === "all" ? "Total customer pool" : `Acquired in ${range}`}</p>
                    </CardContent>
                </Card>
                <Card className="hover:shadow-md transition-shadow relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Quotations</CardTitle>
                        <CreditCard className="h-4 w-4 text-amber-600 group-hover:scale-110 transition-transform" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{quotationsCount}</div>
                        <p className="text-xs text-muted-foreground mt-1">{range === "all" ? "Total shared estimates" : `Created in ${range}`}</p>
                    </CardContent>
                </Card>
                <Card className="hover:shadow-md transition-shadow relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-rose-500" />
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">System Status</CardTitle>
                        <Activity className="h-4 w-4 text-rose-600 group-hover:scale-110 transition-transform" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">Live</div>
                        <p className="text-xs text-rose-600 font-medium flex items-center gap-1 mt-1">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
                            </span>
                            Linked to Server
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Cash Flow Card */}
            <Card className="shadow-sm border-slate-200/60">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-base font-semibold">Cash Flow</CardTitle>
                            <p className="text-xs text-muted-foreground mt-0.5">{range === "all" ? "All time" : `For selected period`} — from recorded transactions</p>
                        </div>
                        <Link href="/transactions">
                            <Button variant={"outline" as any} size={"sm" as any} className="gap-1 h-8 text-xs font-medium">
                                View Transactions <ArrowUpRight className="h-3 w-3" />
                            </Button>
                        </Link>
                    </div>
                </CardHeader>
                <CardContent>
                    {/* Opening & Current Balance */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                            <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                                <span className="text-slate-600 text-xs font-bold">OB</span>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Opening Balance</p>
                                <p className="text-base font-extrabold text-slate-800">
                                    {openingBalance !== null ? `₹${formatCurrency(openingBalance)}` : <span className="text-slate-400 text-xs font-medium">Not set</span>}
                                </p>
                                <p className="text-[10px] text-slate-400">This month&apos;s start</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                            <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                                <span className="text-amber-700 text-xs font-bold">CB</span>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Current Balance</p>
                                <p className="text-base font-extrabold text-slate-800">
                                    {currentBalance !== null ? `₹${formatCurrency(currentBalance)}` : <span className="text-slate-400 text-xs font-medium">Not entered</span>}
                                </p>
                                <p className="text-[10px] text-slate-400">Actual cash in hand</p>
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-slate-100 pt-4">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">Period Cash Flow</p>
                        <div className="grid grid-cols-3 gap-4 mb-4">
                            <div className="text-center p-3 rounded-xl bg-green-50 border border-green-100">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-green-600 mb-1">Cash In</p>
                                <p className="text-xl font-extrabold text-green-700">₹{formatCurrency(cashIn)}</p>
                            </div>
                            <div className="text-center p-3 rounded-xl bg-red-50 border border-red-100">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-red-600 mb-1">Cash Out</p>
                                <p className="text-xl font-extrabold text-red-700">₹{formatCurrency(cashOut)}</p>
                            </div>
                            <div className={`text-center p-3 rounded-xl border ${
                                cashIn - cashOut >= 0 ? "bg-blue-50 border-blue-100" : "bg-orange-50 border-orange-100"
                            }`}>
                                <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${
                                    cashIn - cashOut >= 0 ? "text-blue-600" : "text-orange-600"
                                }`}>Net Flow</p>
                                <p className={`text-xl font-extrabold ${
                                    cashIn - cashOut >= 0 ? "text-blue-700" : "text-orange-700"
                                }`}>
                                    {cashIn - cashOut >= 0 ? "+" : "-"}₹{formatCurrency(Math.abs(cashIn - cashOut))}
                                </p>
                            </div>
                        </div>
                        {(cashIn > 0 || cashOut > 0) && (() => {
                            const total = cashIn + cashOut;
                            const inPct = total > 0 ? (cashIn / total) * 100 : 50;
                            const outPct = 100 - inPct;
                            return (
                                <div className="space-y-2">
                                    <div className="flex h-3 w-full rounded-full overflow-hidden gap-0.5">
                                        <div className="bg-green-400 transition-all duration-700 rounded-l-full" style={{ width: `${inPct}%` }} />
                                        <div className="bg-red-400 transition-all duration-700 rounded-r-full" style={{ width: `${outPct}%` }} />
                                    </div>
                                    <div className="flex justify-between text-[10px] text-slate-500 font-medium">
                                        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-400 inline-block" />Income {inPct.toFixed(0)}%</span>
                                        <span className="flex items-center gap-1">Expenses {outPct.toFixed(0)}%<span className="h-2 w-2 rounded-full bg-red-400 inline-block" /></span>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-4 md:gap-8 lg:grid-cols-2 xl:grid-cols-3">
                <Card className="xl:col-span-2 shadow-sm border-slate-200/60">
                    <CardHeader className="flex flex-row items-center">
                        <div className="grid gap-1">
                            <CardTitle className="text-base font-semibold">Recent Transactions</CardTitle>
                            <p className="text-xs text-muted-foreground">Business activity for the selected period.</p>
                        </div>
                        <Link href="/quotations" className="ml-auto">
                            <Button variant={"outline" as any} size={"sm" as any} className="gap-1 h-8 text-xs font-medium">
                                View All <ArrowUpRight className="h-3 w-3" />
                            </Button>
                        </Link>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold tracking-wider border-b border-slate-100">
                                    <tr>
                                        <th className="px-4 py-3">Number</th>
                                        <th className="px-4 py-3">Customer</th>
                                        <th className="px-4 py-3 text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {recentQuotations.length === 0 ? (
                                        <tr><td colSpan={3} className="px-4 py-8 text-center text-zinc-400 bg-slate-50/30">No transactions found.</td></tr>
                                    ) : (
                                        recentQuotations.map((q: any) => (
                                            <tr key={q.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-4 py-3 font-medium text-slate-700">{q.number}</td>
                                                <td className="px-4 py-3 text-slate-600">{q.lead.name}</td>
                                                <td className="px-4 py-3 text-right font-bold text-slate-900">₹{formatCurrency(Math.round(q.total))}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-slate-200/60">
                    <CardHeader><CardTitle className="text-base font-semibold">Performance Overview</CardTitle></CardHeader>
                    <CardContent className="grid gap-6">
                        <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Lead Conversion</div>
                            <div className="mt-2 flex items-baseline gap-2">
                                <span className="text-3xl font-extrabold text-slate-800">{conversionRate.toFixed(1)}%</span>
                            </div>
                            <div className="mt-4 h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                                <div className="h-full rounded-full bg-emerald-500 transition-all duration-1000" style={{ width: `${conversionRate}%` }} />
                            </div>
                            <p className="text-[10px] text-slate-500 mt-2 font-medium">{convertedLeadsCount} conversions from {leadsCount} leads</p>
                        </div>
                        <div className="space-y-3">
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Quick Actions</div>
                            <div className="grid grid-cols-2 gap-2">
                                <Link href="/leads"><Button variant={"outline" as any} className="w-full text-[10px] font-bold uppercase tracking-tight h-10 border-slate-200" size={"sm" as any}>+ New Lead</Button></Link>
                                <Link href="/quotations/new"><Button variant={"outline" as any} className="w-full text-[10px] font-bold uppercase tracking-tight h-10 border-slate-200" size={"sm" as any}>+ New Quote</Button></Link>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

// ─── Page shell — renders instantly, streams stats ────────────────────────────
export default async function DashboardPage(props: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const searchParams = await props.searchParams;
    const range = (searchParams.range as string) || "curr";
    const from = searchParams.from as string | undefined;
    const to = searchParams.to as string | undefined;

    return (
        <div className="flex flex-col gap-6">
            <RealtimeListener tables={["Lead", "Quotation", "Transaction"]} />
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Dashboard Overview</h1>
                    <p className="text-muted-foreground">Real-time performance metrics and insights.</p>
                </div>
                <DashboardFilter />
            </div>

            <Suspense fallback={<StatsSkeleton />}>
                <DashboardStats range={range} from={from} to={to} />
            </Suspense>
        </div>
    );
}
