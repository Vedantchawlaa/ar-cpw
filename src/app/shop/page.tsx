import { getAllShopProducts } from "@/lib/actions/shop-product-actions";
import { ShopClient } from "@/components/shop/ShopClient";

export default async function ShopPage() {
    const products = await getAllShopProducts();

    return <ShopClient products={products} />;
}
