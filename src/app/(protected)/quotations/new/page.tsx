import { getLeads } from "@/lib/actions/lead-actions";
import { getMeasurementById } from "@/lib/actions/measurement-actions";
import { getProducts } from "@/lib/actions/product-actions";
import QuotationBuilder from "@/components/quotations/QuotationBuilder";

export default async function NewQuotationPage({
    searchParams
}: {
    searchParams: Promise<{ measurementId?: string }>
}) {
    const leads = await getLeads();
    const params = await searchParams;
    let initialItems = null;
    let selectedLeadId = "";

    // If measurementId is provided, fetch and prepare quotation items
    if (params.measurementId) {
        console.log("Fetching measurement:", params.measurementId);
        const result = await getMeasurementById(params.measurementId);
        console.log("Measurement fetch result:", result.success, result.error);
        if (result.success && result.data) {
            const measurement = result.data;
            selectedLeadId = measurement.leadId || "";

            console.log("Raw measurement.data type:", typeof measurement.data);
            console.log("Raw measurement.data:", measurement.data);

            // Parse measurement data
            const data = typeof measurement.data === 'string'
                ? JSON.parse(measurement.data)
                : measurement.data;

            console.log("Parsed data:", data);
            console.log("Number of floors:", data.floors?.length || 0);

            const items: any[] = [];
            const productsResult = await getProducts();
            const allProducts = productsResult.data || [];

            console.log("Available products:", allProducts.length);

            console.log("Measurement data processed for items");

            // Process all floors and rooms
            for (const floor of data.floors || []) {
                for (const room of floor.rooms || []) {
                    for (const item of room.items || []) {
                        console.log(`Processing item: ${item.name}, type: ${item.type}, fabricProduct: ${item.fabricProduct}, trackProduct: ${item.trackProduct}`);

                        // Process curtain items
                        if (item.type === 'Curtain') {
                            // Add fabric product
                            if (item.fabricProduct) {
                                const fabricProduct = allProducts.find((p: any) => p.id === item.fabricProduct);
                                if (fabricProduct) {
                                    const fabricQty = parseFloat(item.fabricRequired || "0");
                                    items.push({
                                        id: `${items.length + 1}`,
                                        description: `${fabricProduct.name} - ${item.name} (${room.name}, ${floor.name})`,
                                        quantity: fabricQty,
                                        rate: fabricProduct.rate,
                                        amount: fabricQty * fabricProduct.rate
                                    });
                                }
                            } else {
                                // Add placeholder for fabric even if not selected
                                const fabricQty = parseFloat(item.fabricRequired || "0");
                                if (fabricQty > 0) {
                                    items.push({
                                        id: `${items.length + 1}`,
                                        description: `Fabric (select product) - ${item.name} (${room.name}, ${floor.name})`,
                                        quantity: fabricQty,
                                        rate: 0,
                                        amount: 0
                                    });
                                }
                            }

                            // Add track product if required
                            if (item.trackRequired !== false && item.trackProduct) {
                                const trackProduct = allProducts.find((p: any) => p.id === item.trackProduct);
                                if (trackProduct) {
                                    const trackSize = parseFloat(item.trackSize || "0");
                                    items.push({
                                        id: `${items.length + 1}`,
                                        description: `${trackProduct.name} - ${item.name} (${room.name}, ${floor.name})`,
                                        quantity: trackSize, // Quantity is the track size in feet
                                        rate: trackProduct.rate,
                                        amount: trackSize * trackProduct.rate
                                    });
                                }
                            } else if (item.trackRequired !== false) {
                                // Add placeholder for track if required but not selected
                                const trackSize = parseFloat(item.trackSize || "0");
                                if (trackSize > 0) {
                                    items.push({
                                        id: `${items.length + 1}`,
                                        description: `Track (select product) - ${item.name} (${room.name}, ${floor.name})`,
                                        quantity: trackSize, // Quantity is the track size in feet
                                        rate: 0,
                                        amount: 0
                                    });
                                }
                            }

                            // Add sheer fabric product if enabled
                            if (item.sheerRequired) {
                                if (item.sheerFabricProduct) {
                                    const sheerFabricProduct = allProducts.find((p: any) => p.id === item.sheerFabricProduct);
                                    if (sheerFabricProduct) {
                                        const sheerFabricQty = parseFloat(item.sheerFabricRequired || "0");
                                        items.push({
                                            id: `${items.length + 1}`,
                                            description: `${sheerFabricProduct.name} (Sheer) - ${item.name} (${room.name}, ${floor.name})`,
                                            quantity: sheerFabricQty,
                                            rate: sheerFabricProduct.rate,
                                            amount: sheerFabricQty * sheerFabricProduct.rate
                                        });
                                    }
                                } else {
                                    const sheerFabricQty = parseFloat(item.sheerFabricRequired || "0");
                                    if (sheerFabricQty > 0) {
                                        items.push({
                                            id: `${items.length + 1}`,
                                            description: `Sheer Fabric (select product) - ${item.name} (${room.name}, ${floor.name})`,
                                            quantity: sheerFabricQty,
                                            rate: 0,
                                            amount: 0
                                        });
                                    }
                                }

                                // Add sheer track (Track 2)
                                const sheerTrackProductId = item.sheerTrackProduct || item.trackProduct;
                                if (sheerTrackProductId) {
                                    const sheerTrackProduct = allProducts.find((p: any) => p.id === sheerTrackProductId);
                                    if (sheerTrackProduct) {
                                        const trackSize = parseFloat(item.trackSize || "0");
                                        items.push({
                                            id: `${items.length + 1}`,
                                            description: `${sheerTrackProduct.name} (Sheer Track) - ${item.name} (${room.name}, ${floor.name})`,
                                            quantity: trackSize,
                                            rate: sheerTrackProduct.rate,
                                            amount: trackSize * sheerTrackProduct.rate
                                        });
                                    }
                                } else {
                                    const trackSize = parseFloat(item.trackSize || "0");
                                    if (trackSize > 0) {
                                        items.push({
                                            id: `${items.length + 1}`,
                                            description: `Sheer Track (select product) - ${item.name} (${room.name}, ${floor.name})`,
                                            quantity: trackSize,
                                            rate: 0,
                                            amount: 0
                                        });
                                    }
                                }
                            }
                        }

                        // Process blind items (kept separate, not grouped)
                        if (item.type === 'Blind' && item.blindProduct) {
                            const blindProduct = allProducts.find((p: any) => p.id === item.blindProduct);
                            if (blindProduct) {
                                const sqft = parseFloat(item.sqft || "0");
                                items.push({
                                    id: `${items.length + 1}`,
                                    description: `${blindProduct.name} (${item.width}x${item.height}) - ${item.name} (${room.name}, ${floor.name})`,
                                    quantity: sqft,
                                    rate: blindProduct.rate,
                                    amount: sqft * blindProduct.rate
                                });
                            }
                        }
                    }
                }
            }

            // Group items by product name and rate to combine quantities
            // Exception: Don't group blinds as they are custom-sized per window
            const groupedItems: { [key: string]: any } = {};
            const blindItems: any[] = [];

            for (const item of items) {
                // Check if this is a blind item (blinds typically have dimensions in description)
                const isBlind = item.description.toLowerCase().includes('blind');

                if (isBlind) {
                    // Keep blinds separate - don't group them
                    blindItems.push(item);
                } else {
                    // Group fabrics and tracks
                    // Strip suffixes like "(Sheer)", "(Sheer Track)", etc. before grouping
                    const baseDescription = item.description.split(' - ')[0].trim();
                    const productName = baseDescription
                        .replace(/\s*\(Sheer\)\s*$/i, '')
                        .replace(/\s*\(Sheer Track\)\s*$/i, '')
                        .trim();

                    const key = `${productName}_${item.rate}`;

                    if (groupedItems[key]) {
                        // Combine quantities and amounts
                        groupedItems[key].quantity += item.quantity;
                        groupedItems[key].amount += item.amount;
                    } else {
                        // First occurrence of this product
                        groupedItems[key] = { ...item, description: productName };
                    }
                }
            }

            // Convert grouped items back to array and combine with blind items
            const groupedArray = Object.values(groupedItems);
            const finalItems = [...groupedArray, ...blindItems].map((item, index) => ({
                ...item,
                id: `${index + 1}`
            }));

            if (finalItems.length > 0) {
                initialItems = finalItems;
                console.log("Prepared items (grouped):", finalItems.length);
            } else {
                console.log("No items found in measurement");
            }
        } else {
            console.log("Failed to fetch measurement:", result.error);
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">New Estimate</h1>
            </div>

            <QuotationBuilder
                leads={leads}
                initialItems={initialItems}
                initialLeadId={selectedLeadId}
            />
        </div>
    );
}
