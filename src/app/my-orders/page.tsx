import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getMyOrders } from "@/lib/actions/my-orders-actions";
import { MyOrdersClient } from "@/components/orders/MyOrdersClient";

export default async function MyOrdersPage() {
    const session = await auth();

    if (!session?.user?.email) {
        redirect("/login");
    }

    const orders = await getMyOrders(session.user.email);

    return <MyOrdersClient orders={orders} />;
}
