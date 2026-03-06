import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { formatDate } from "@/lib/utils";
// @ts-ignore
import { TrendingUp, TrendingDown, Clock } from "lucide-react";

interface Transaction {
    id: string;
    type: string;
    amount: number;
    category: string;
    description: string | null;
    date: Date;
    user?: { name: string | null } | null;
}

export function TransactionList({ transactions }: { transactions: Transaction[] }) {
    if (transactions.length === 0) {
        return (
            <div className="text-center py-10 text-muted-foreground border rounded-lg bg-slate-50">
                No recent transactions.
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {transactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-4 border rounded-lg bg-white shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center ${t.type === 'INCOME' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                            }`}>
                            {t.type === 'INCOME' ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                        </div>
                        <div>
                            <p className="font-medium text-sm">{t.category}</p>
                            <p className="text-xs text-muted-foreground">{t.description || t.user?.name || 'No description'}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className={`font-bold ${t.type === 'INCOME' ? 'text-green-600' : 'text-red-600'}`}>
                            {t.type === 'INCOME' ? '+' : '-'}₹{t.amount.toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">{formatDate(t.date)}</p>
                    </div>
                </div>
            ))}
        </div>
    );
}
