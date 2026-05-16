/** Returns the Monday of the week containing `date`, at midnight UTC */
export function getMondayOf(date: Date): Date {
    const d = new Date(date);
    const day = d.getUTCDay(); // 0=Sun,1=Mon,...,6=Sat
    const diff = day === 0 ? -6 : 1 - day; // shift to Monday
    d.setUTCDate(d.getUTCDate() + diff);
    d.setUTCHours(0, 0, 0, 0);
    return d;
}
