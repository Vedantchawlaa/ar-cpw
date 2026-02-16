import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getAllProductsWithStock, getLowStockProducts } from "@/lib/actions/stock-actions";
import { StockClient } from "@/components/stock/StockClient";

export default async function StockPage() {
    const session = await auth();

    if ((session?.user as any)?.role !== "admin") {
        redirect("/dashboard");
    }

    const products = await getAllProductsWithStock();
    const lowStockProducts = await getLowStockProducts(10);

    return <StockClient products={products} lowStockProducts={lowStockProducts} />;
}
