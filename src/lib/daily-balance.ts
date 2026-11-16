// Daily bank + cash check: works out, for each saved check, the net of the
// transactions recorded since the previous check, and the gap between that and
// how much bank + cash actually changed.
// Pure functions only (no DB, no path aliases) so they can be unit tested.

export interface BalanceCheck {
    day: string; // YYYY-MM-DD (business day the balances were counted)
    bankBalance: number;
    cashBalance: number;
}

export interface DayTransaction {
    day: string; // YYYY-MM-DD
    type: string; // INCOME | EXPENSE
    amount: number;
}

export interface CheckWithGap extends BalanceCheck {
    total: number;
    /** Income - expenses recorded after the previous check, up to and including this day */
    recordedNet: number;
    /** Change in bank + cash minus recordedNet. Negative = money went out that was not recorded. null for the first check. */
    gap: number | null;
    previousDay: string | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Net of transactions with fromExclusive < day <= toInclusive (fromExclusive null = only toInclusive). */
export function netBetween(transactions: DayTransaction[], fromExclusive: string | null, toInclusive: string): number {
    let net = 0;
    for (const t of transactions) {
        const inRange = fromExclusive === null ? t.day === toInclusive : t.day > fromExclusive && t.day <= toInclusive;
        if (!inRange) continue;
        if (t.type === "INCOME") net += t.amount;
        else if (t.type === "EXPENSE") net -= t.amount;
    }
    return round2(net);
}

/**
 * @param checks any order; one per day
 * @returns newest first, each with the net since the check before it and the gap
 */
export function withGaps(checks: BalanceCheck[], transactions: DayTransaction[]): CheckWithGap[] {
    const sorted = [...checks].sort((a, b) => a.day.localeCompare(b.day));
    const out = sorted.map((c, i) => {
        const prev = i > 0 ? sorted[i - 1] : null;
        const total = round2(c.bankBalance + c.cashBalance);
        const recordedNet = netBetween(transactions, prev ? prev.day : null, c.day);
        const gap = prev ? round2(total - (prev.bankBalance + prev.cashBalance) - recordedNet) : null;
        return { ...c, total, recordedNet, gap, previousDay: prev ? prev.day : null };
    });
    return out.reverse();
}
