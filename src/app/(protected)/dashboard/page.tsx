import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Activity, CreditCard, DollarSign, Users, ArrowUpRight } from "lucide-react";
import prisma from "@/lib/db";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { DashboardFilter } from "@/components/dashboard/DashboardFilter";
import { auth } from "@/auth";

export default async function DashboardPage(props: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const session = await auth();
    const role = (session?.user as any)?.role;
    const userId = session?.user?.id;

    const searchParams = await props.searchParams;
    const range = (searchParams.range as string) || "all";
    const from = searchParams.from as string;
    const to = searchParams.to as string;

    // Calculate date filter
    let dateFilter: any = {};
    const now = new Date();

    if (range !== "all") {
        let startDate = new Date();
        if (range === "24h") startDate.setHours(now.getHours() - 24);
        else if (range === "48h") startDate.setHours(now.getHours() - 48);
        else if (range === "7d") startDate.setDate(now.getDate() - 7);
        else if (range === "14d") startDate.setDate(now.getDate() - 14);
        else if (range === "1mo") startDate.setMonth(now.getMonth() - 1);
        else if (range === "custom" && from) {
            startDate = new Date(from);
            startDate.setHours(0, 0, 0, 0);
        }

        dateFilter = {
            gte: startDate,
        };

        if (range === "custom" && to) {
            const endDate = new Date(to);
            endDate.setHours(23, 59, 59, 999);
            dateFilter.lte = endDate;
        }
    }

    // Role-based visibility filter
    const visibilityFilter = role === 'admin' ? {} : { userId };

    // Fetch metrics with combined filters
    let totalRevenue = 0;
    let leadsCount = 0;
    let quotationsCount = 0;
    let convertedLeadsCount = 0;
    let recentQuotations: any[] = [];
    let dbError = false;

    try {
        const [
            totalRevenueResult,
            lCount,
            qCount,
            clCount,
            rQuotations
        ] = await Promise.all([
            (prisma as any).quotation.aggregate({
                where: {
                    status: 'SALE',
                    ...visibilityFilter,
                    ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {})
                },
                _sum: { receivedAmount: true }
            }),
            (prisma as any).lead.count({
                where: {
                    ...visibilityFilter,
                    ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {})
                }
            }),
            (prisma as any).quotation.count({
                where: {
                    ...visibilityFilter,
                    ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {})
                }
            }),
            (prisma as any).lead.count({
                where: {
                    ...visibilityFilter,
                    ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
                    quotations: {
                        some: {
                            status: 'SALE',
                            ...visibilityFilter,
                            ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {})
                        }
                    }
                }
            }),
            (prisma as any).quotation.findMany({
                take: 5,
                where: {
                    ...visibilityFilter,
                    ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {})
                },
                orderBy: { createdAt: 'desc' },
                include: { lead: { select: { name: true } } }
            })
        ]);

        totalRevenue = totalRevenueResult._sum.receivedAmount || 0;
        leadsCount = lCount;
        quotationsCount = qCount;
        convertedLeadsCount = clCount;
        recentQuotations = rQuotations;
    } catch (error) {
        console.error("Dashboard data fetch failed:", error);
        dbError = true;
    }

    const conversionRate = leadsCount > 0 ? Math.min((convertedLeadsCount / leadsCount) * 100, 100) : 0;

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Dashboard Overview</h1>
                    <p className="text-muted-foreground">Real-time performance metrics and insights.</p>
                </div>
                <DashboardFilter />
            </div>

            {dbError && (
                <Card className="border-rose-200 bg-rose-50/50">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-rose-800 flex items-center gap-2">
                            <Activity className="h-5 w-5" />
                            Database Connection Issue
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-rose-700">
                            The system is currently unable to fetch real-time metrics. This is usually caused by an outdated database schema or a connection limit.
                        </p>
                        <div className="mt-4 p-3 bg-rose-100/50 rounded-md border border-rose-200">
                            <h4 className="text-xs font-bold uppercase text-rose-800 mb-2">How to Fix:</h4>
                            <ol className="text-xs text-rose-800 space-y-1 list-decimal ml-4">
                                <li>Ensure your <strong>Vercel Environment Variables</strong> (DATABASE_URL, DIRECT_URL) are correctly set.</li>
                                <li>Run <code className="bg-rose-200/50 px-1 rounded">npx prisma db push</code> using your Direct URL to sync the schema.</li>
                                <li>Check your Supabase connection pool limits.</li>
                            </ol>
                        </div>
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
                        <div className="text-2xl font-bold">₹{totalRevenue.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {range === "all" ? "Lifetime earnings" : `Revenue for ${range}`}
                        </p>
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
                        <p className="text-xs text-muted-foreground mt-1">
                            {range === "all" ? "Total customer pool" : `Acquired in ${range}`}
                        </p>
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
                        <p className="text-xs text-muted-foreground mt-1">
                            {range === "all" ? "Total shared estimates" : `Created in ${range}`}
                        </p>
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
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                            </span>
                            Linked to Supabase
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:gap-8 lg:grid-cols-2 xl:grid-cols-3">
                <Card className="xl:col-span-2 shadow-sm border-slate-200/60">
                    <CardHeader className="flex flex-row items-center">
                        <div className="grid gap-1">
                            <CardTitle className="text-base font-semibold">Recent Transactions</CardTitle>
                            <p className="text-xs text-muted-foreground">
                                Business activity for the selected period.
                            </p>
                        </div>
                        <Link href="/quotations" className="ml-auto">
                            <Button variant={"outline" as any} size={"sm" as any} className="gap-1 h-8 text-xs font-medium">
                                View All
                                <ArrowUpRight className="h-3 w-3" />
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
                                        <tr>
                                            <td colSpan={3} className="px-4 py-8 text-center text-zinc-400 bg-slate-50/30">
                                                No transactions found in this period.
                                            </td>
                                        </tr>
                                    ) : (
                                        recentQuotations.map((q: any) => (
                                            <tr key={q.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-4 py-3 font-medium text-slate-700">{q.number}</td>
                                                <td className="px-4 py-3 text-slate-600">{q.lead.name}</td>
                                                <td className="px-4 py-3 text-right font-bold text-slate-900">₹{q.total.toLocaleString()}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-slate-200/60">
                    <CardHeader>
                        <CardTitle className="text-base font-semibold">Performance Overview</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-6">
                        <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 relative overflow-hidden">
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Lead Conversion</div>
                            <div className="mt-2 flex items-baseline gap-2">
                                <span className="text-3xl font-extrabold text-slate-800">
                                    {conversionRate.toFixed(1)}%
                                </span>
                            </div>
                            <div className="mt-4 h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                                <div
                                    className="h-full rounded-full bg-emerald-500 transition-all duration-1000"
                                    style={{ width: `${conversionRate}%` }}
                                />
                            </div>
                            <p className="text-[10px] text-slate-500 mt-2 font-medium">
                                {convertedLeadsCount} conversions from {leadsCount} leads
                            </p>
                        </div>

                        <div className="space-y-3">
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Quick Actions</div>
                            <div className="grid grid-cols-2 gap-2">
                                <Link href="/leads">
                                    <Button variant={"outline" as any} className="w-full text-[10px] font-bold uppercase tracking-tight h-10 border-slate-200" size={"sm" as any}>+ New Lead</Button>
                                </Link>
                                <Link href="/quotations/new">
                                    <Button variant={"outline" as any} className="w-full text-[10px] font-bold uppercase tracking-tight h-10 border-slate-200" size={"sm" as any}>+ New Quote</Button>
                                </Link>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
