import { getShopProductById } from "@/lib/actions/shop-product-actions";
import { ProductDetailClient } from "@/components/shop/ProductDetailClient";
import { notFound } from "next/navigation";

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function ProductPage({ params }: PageProps) {
    const { id } = await params;
    const product = await getShopProductById(id);

    if (!product) {
        notFound();
    }

    return <ProductDetailClient product={product} />;
}

