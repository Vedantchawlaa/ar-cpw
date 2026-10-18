import { getPnLStats, getTransactions } from "@/lib/actions/transaction-actions";
import { getMonthlyBalance } from "@/lib/actions/balance-actions";
import { getThisWeekBankBalance, getWeeklyBankHistory } from "@/lib/actions/bank-balance-actions";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { TransactionList } from "@/components/transactions/TransactionList";
import { BalanceWidget } from "@/components/transactions/BalanceWidget";
import { MondayBankPrompt } from "@/components/transactions/MondayBankPrompt";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
// @ts-ignore
import { TrendingUp, TrendingDown, DollarSign, ListFilter } from "lucide-react";
import { MonthFilter } from "@/components/transactions/MonthFilter";
import { ExpensePieChart } from "@/components/transactions/ExpensePieChart";
import { TransactionSearch } from "@/components/transactions/TransactionSearch";
import { SyncButton } from "@/components/transactions/SyncButton";
import { ImportTransactions } from "@/components/transactions/ImportTransactions";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { RealtimeListener } from "@/components/RealtimeListener";

export default async function TransactionsPage(props: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const searchParams = await props.searchParams;
    const search = searchParams.search as string;
    const range = (searchParams.range as string) || "month";
    const month = searchParams.month as string;
    const year = searchParams.year as string;
    const from = searchParams.from as string;
    const to = searchParams.to as string;

    // Calculate date filter
    let dateFilter: any = {};
    const now = new Date();

    if (range === "month") {
        const selectedMonth = month ? parseInt(month) : now.getMonth();
        const selectedYear = year ? parseInt(year) : now.getFullYear();

        const startDate = new Date(selectedYear, selectedMonth, 1);
        const endDate = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59, 999);

        dateFilter = {
            gte: startDate,
            lte: endDate,
        };
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

        dateFilter = {
            gte: startDate,
        };

        if (range === "custom" && to) {
            const endDate = new Date(to);
            endDate.setHours(23, 59, 59, 999);
            dateFilter.lte = endDate;
        }
    }

    const stats = await getPnLStats(dateFilter, search);
    const allTransactions = await getTransactions(500, dateFilter, search);
    const displayTransactions = allTransactions.slice(0, 6);

    // Load monthly balance for reconciliation widget
    const selectedMonth = month ? parseInt(month) : now.getMonth();
    const selectedYear = year ? parseInt(year) : now.getFullYear();
    const monthlyBalance = range === "month" ? await getMonthlyBalance(selectedMonth, selectedYear) : null;

    // Load weekly bank balance data
    const isMonday = now.getDay() === 1;
    const [thisWeekEntry, weeklyHistory] = await Promise.all([
        getThisWeekBankBalance(),
        getWeeklyBankHistory(12),
    ]);

    // Aggregate expenses for the pie chart using all period transactions
    const expenseDataMap: Record<string, number> = {};
    allTransactions.forEach((t: any) => {
        if (t.type === 'EXPENSE') {
            expenseDataMap[t.category] = (expenseDataMap[t.category] || 0) + Number(t.amount);
        }
    });

    const expenseData = Object.entries(expenseDataMap).map(([category, amount]) => ({
        category,
        amount
    }));

    // Dynamic Labels based on filter
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const currentViewLabel = range === "month"
        ? `${monthNames[month ? parseInt(month) : now.getMonth()]} ${year ? year : now.getFullYear()}`
        : range === "all" ? "All Time" : "Filtered View";

    const subTextLabel = range === "month" ? "This month's performance" : "Performance for selected period";

    return (
        <div className="flex flex-col gap-8 p-6">
            <RealtimeListener tables={['Transaction']} />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Financial Overview</h1>
                    <p className="text-muted-foreground flex items-center gap-1">
                        Viewing <span className="text-slate-900 font-semibold">{currentViewLabel}</span>
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <TransactionSearch />
                    <MonthFilter />
                    <ImportTransactions />
                    <SyncButton />
                </div>
            </div>

            {/* P&L Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="border-l-4 border-l-green-500 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wider">Total Income</CardTitle>
                        <TrendingUp className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-green-600">₹{formatCurrency(stats.income)}</div>
                        <p className="text-xs text-muted-foreground mt-1">{subTextLabel}</p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-red-500 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wider">Total Expenses</CardTitle>
                        <TrendingDown className="h-4 w-4 text-red-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-red-600">₹{formatCurrency(stats.expenses)}</div>
                        <p className="text-xs text-muted-foreground mt-1">{subTextLabel}</p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-blue-500 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wider">Net Profit</CardTitle>
                        <DollarSign className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-3xl font-bold ${stats.netProfit >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
                            {stats.netProfit >= 0 ? '+' : '-'}₹{formatCurrency(Math.abs(stats.netProfit))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{stats.netProfit >= 0 ? "You're profitable!" : "In loss for this period"}</p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-purple-500 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wider">Predicted Salary (50%)</CardTitle>
                        <TrendingUp className="h-4 w-4 text-purple-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-purple-600">
                            ₹{formatCurrency(Math.max(0, stats.netProfit / 2))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Based on profit for this period</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-8 lg:grid-cols-3">
                {/* Transaction Entry Form & Chart */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="sticky top-6 space-y-6">
                        <TransactionForm />
                        {range === "month" && (
                            <BalanceWidget
                                month={selectedMonth}
                                year={selectedYear}
                                income={stats.income}
                                expenses={stats.expenses}
                                initialStarting={monthlyBalance?.startingBalance ?? 0}
                                initialEnding={monthlyBalance?.endingBalance ?? null}
                                carriedForward={monthlyBalance?.carriedForward ?? false}
                            />
                        )}
                        <MondayBankPrompt
                            isMonday={isMonday}
                            thisWeekEntry={thisWeekEntry ? {
                                ...thisWeekEntry,
                                weekStart: thisWeekEntry.weekStart instanceof Date
                                    ? thisWeekEntry.weekStart.toISOString()
                                    : thisWeekEntry.weekStart,
                            } : null}
                            history={(weeklyHistory as any[]).map((h: any) => ({
                                ...h,
                                weekStart: h.weekStart instanceof Date ? h.weekStart.toISOString() : h.weekStart,
                            }))}
                        />
                        <ExpensePieChart data={expenseData} />
                    </div>
                </div>

                {/* Transaction History */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b">
                        <div>
                            <h2 className="text-lg font-bold tracking-tight">Statement</h2>
                            <p className="text-xs text-muted-foreground uppercase font-bold tracking-widest">{currentViewLabel}</p>
                        </div>
                        <div className="h-8 px-3 rounded-full bg-slate-100 flex items-center gap-2 text-[10px] font-bold text-slate-500">
                            <ListFilter className="h-3 w-3" />
                            SHOWING LATEST {displayTransactions.length}
                        </div>
                    </div>
                    <TransactionList transactions={displayTransactions} />

                    <div className="pt-4 flex justify-center">
                        <Link
                            href={`/transactions/statement?${new URLSearchParams(Object.fromEntries(Object.entries(searchParams).map(([k, v]) => [k, String(v)]))).toString()}`}
                            className="inline-flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors py-2 px-4 rounded-full bg-blue-50 hover:bg-blue-100"
                        >
                            View More Statement
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
