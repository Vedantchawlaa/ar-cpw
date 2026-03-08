import { getPnLStats, getTransactions } from "@/lib/actions/transaction-actions";
import { TransactionList } from "@/components/transactions/TransactionList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { TrendingUp, TrendingDown, DollarSign, ListFilter, ArrowLeft, Search } from "lucide-react";
import { TransactionSearch } from "@/components/transactions/TransactionSearch";
import { MonthFilter } from "@/components/transactions/MonthFilter";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";

export default async function StatementPage(props: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const searchParams = await props.searchParams;
    const search = searchParams.search as string;
    const range = (searchParams.range as string) || "month";
    const month = searchParams.month as string;
    const year = searchParams.year as string;
    const from = searchParams.from as string;
    const to = searchParams.to as string;

    // Calculate date filter (same as main page)
    let dateFilter: any = {};
    const now = new Date();

    if (range === "month") {
        const selectedMonth = month ? parseInt(month) : now.getMonth();
        const selectedYear = year ? parseInt(year) : now.getFullYear();
        const startDate = new Date(selectedYear, selectedMonth, 1);
        const endDate = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999);
        dateFilter = { gte: startDate, lte: endDate };
    } else if (range !== "all") {
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
        dateFilter = { gte: startDate };
        if (range === "custom" && to) {
            const endDate = new Date(to);
            endDate.setHours(23, 59, 59, 999);
            dateFilter.lte = endDate;
        }
    }

    const stats = await getPnLStats(dateFilter, search);
    const transactions = await getTransactions(500, dateFilter, search); // High limit for statement

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const currentViewLabel = range === "month"
        ? `${monthNames[month ? parseInt(month) : now.getMonth()]} ${year ? year : now.getFullYear()}`
        : range === "all" ? "All Time" : "Filtered View";

    return (
        <div className="flex flex-col gap-8 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                    <Link
                        href="/transactions"
                        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-slate-900 transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Overview
                    </Link>
                    <h1 className="text-2xl font-bold tracking-tight">Full Statement</h1>
                    <p className="text-muted-foreground">Detailed transaction record for {currentViewLabel}</p>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <TransactionSearch />
                    <MonthFilter />
                </div>
            </div>

            {/* P&L Summary Row (Compact) */}
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
                <Card className="bg-green-50/50 border-green-100">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold text-green-600 uppercase tracking-wider">Income</p>
                            <p className="text-xl font-bold text-green-700">₹{formatCurrency(stats.income)}</p>
                        </div>
                        <TrendingUp className="h-8 w-8 text-green-200" />
                    </CardContent>
                </Card>
                <Card className="bg-red-50/50 border-red-100">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider">Expenses</p>
                            <p className="text-xl font-bold text-red-700">₹{formatCurrency(stats.expenses)}</p>
                        </div>
                        <TrendingDown className="h-8 w-8 text-red-200" />
                    </CardContent>
                </Card>
                <Card className="bg-blue-50/50 border-blue-100">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Net</p>
                            <p className="text-xl font-bold text-blue-700">
                                {stats.netProfit >= 0 ? '+' : '-'}₹{formatCurrency(Math.abs(stats.netProfit))}
                            </p>
                        </div>
                        <DollarSign className="h-8 w-8 text-blue-200" />
                    </CardContent>
                </Card>
                <Card className="bg-purple-50/50 border-purple-100">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">Predicted Salary (50%)</p>
                            <p className="text-xl font-bold text-purple-700">₹{formatCurrency(Math.max(0, stats.netProfit / 2))}</p>
                        </div>
                        <TrendingUp className="h-8 w-8 text-purple-200" />
                    </CardContent>
                </Card>
            </div>

            <Card className="shadow-sm border-slate-200 overflow-hidden">
                <CardHeader className="bg-slate-50 border-b border-slate-200 py-4">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-bold text-slate-600 uppercase tracking-widest flex items-center gap-2">
                            <ListFilter className="h-4 w-4 text-slate-400" />
                            Transaction Record ({transactions.length})
                        </CardTitle>
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-500 uppercase">
                            {currentViewLabel}
                        </span>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <TransactionList transactions={transactions} />
                </CardContent>
            </Card>
        </div>
    );
}
