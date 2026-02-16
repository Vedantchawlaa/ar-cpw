"use server";

import db from "@/lib/db";

// Mock AI response for now. We can integrate Gemini API here later.
export async function generateChatResponse(message: string, history: { role: "user" | "assistant", content: string }[] = []) {
    try {
        console.log("Generating AI Response for:", message);

        // Fetch some shop context
        const products = await (db as any).shopProduct.findMany({
            take: 5,
            select: { name: true, rate: true, category: true }
        });

        const productContext = products.map((p: any) => `${p.name} (${p.category}) for ₹${p.rate}`).join(", ");

        // Simple rules-based mock responses for demonstration
        const lowerMessage = message.toLowerCase();

        if (lowerMessage.includes("price") || lowerMessage.includes("rate") || lowerMessage.includes("cost")) {
            return `Our current featured products include: ${productContext}. Pricing varies based on customization but we focus on premium affordability.`;
        }

        if (lowerMessage.includes("curtain") || lowerMessage.includes("blind")) {
            return "We specialize in custom curtains and zebra blinds. All our products are masterfully stitched at our Panipat workshop. Would you like to see our latest collection?";
        }

        if (lowerMessage.includes("order") || lowerMessage.includes("buy")) {
            return "You can add any product to your cart and proceed to checkout. We offer shipping pan-India!";
        }

        if (lowerMessage.includes("contact") || lowerMessage.includes("phone") || lowerMessage.includes("whatsapp")) {
            return "You can reach us at +91 74046-18501 or visit our shop in Panipat!";
        }

        return "Hello! I'm your Chawla Parde Wala assistant. How can I help you regarding our premium curtains, blinds, or your interior order today?";
    } catch (error) {
        console.error("AI Action Error:", error);
        return "I'm having a bit of trouble connecting right now. Please feel free to call us at +91 74046-18501 for immediate assistance!";
    }
}
