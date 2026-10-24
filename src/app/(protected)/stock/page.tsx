import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getStock } from "@/lib/actions/stock-actions";
import { StockClient } from "@/components/stock/StockClient";

export default async function StockPage() {
    const session = await auth();

    if ((session?.user as any)?.role !== "admin") {
        redirect("/dashboard");
    }

    const products = await getStock();

    return <StockClient products={JSON.parse(JSON.stringify(products))} />;
}
