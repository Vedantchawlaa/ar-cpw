import { getPnLStats, getTransactions } from "@/lib/actions/transaction-actions";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { TransactionList } from "@/components/transactions/TransactionList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
// @ts-ignore
import { TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { DashboardFilter } from "@/components/dashboard/DashboardFilter";

export default async function TransactionsPage(props: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
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

    const stats = await getPnLStats(dateFilter);
    const transactions = await getTransactions(20, dateFilter);

    return (
        <div className="flex flex-col gap-8 p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Financial Overview</h1>
                    <p className="text-muted-foreground">Track income, expenses, and profit.</p>
                </div>
                <DashboardFilter />
            </div>

            {/* P&L Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Income</CardTitle>
                        <TrendingUp className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">₹{stats.income.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">All time revenue</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                        <TrendingDown className="h-4 w-4 text-red-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">₹{stats.expenses.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">All time spending</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
                        <DollarSign className="h-4 w-4 text-indigo-600" />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${stats.netProfit >= 0 ? 'text-indigo-600' : 'text-red-500'}`}>
                            {stats.netProfit >= 0 ? '+' : '-'}₹{Math.abs(stats.netProfit).toLocaleString()}
                        </div>
                        <p className="text-xs text-muted-foreground">Income - Expenses</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-8 lg:grid-cols-3">
                {/* Transaction Entry Form */}
                <div className="lg:col-span-1">
                    <TransactionForm />
                </div>

                {/* Transaction History */}
                <div className="lg:col-span-2 space-y-6">
                    <div>
                        <h2 className="text-lg font-semibold tracking-tight">Recent Transactions</h2>
                        <p className="text-sm text-muted-foreground">History of your financial activity.</p>
                    </div>
                    <TransactionList transactions={transactions} />
                </div>
            </div>
        </div>
    );
}
