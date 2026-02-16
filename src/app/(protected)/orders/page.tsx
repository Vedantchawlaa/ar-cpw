import { getAllOrders } from "@/lib/actions/order-actions";
import { OrdersClient } from "@/components/orders/OrdersClient";

export default async function OrdersPage() {
    const orders = await getAllOrders();

    return <OrdersClient orders={orders} />;
}
