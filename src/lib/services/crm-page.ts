import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { toActor } from "./types";
import { getSalesActor, visibleTeam } from "./crm-service";
import { istDay, resolveRange } from "@/lib/sales-crm";

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** First value of a search param. */
export const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** The CRM user for a page; the layout already shows the no-access message. */
export async function pageActor() {
    const session = await auth();
    const sa = session?.user ? await getSalesActor(toActor(session.user)) : null;
    if (!sa) redirect("/leads");
    return sa;
}

export function pageRange(sp: Record<string, string | string[] | undefined>, fallback = "today") {
    return resolveRange(one(sp.range) || fallback, istDay(new Date()), one(sp.from), one(sp.to));
}

export async function teamOptions(sa: Awaited<ReturnType<typeof pageActor>>) {
    const team = await visibleTeam(sa);
    return team.map((u) => ({ value: u.id, label: u.name }));
}
