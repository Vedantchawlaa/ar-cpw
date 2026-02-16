const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const demoProducts = [
    {
        name: "Imperial Velvet Drapes",
        rate: 4999,
        description: "Luxurious velvet curtains that add elegance and warmth to any room. Perfect for living rooms and bedrooms.",
        category: "Curtains",
        tag: "Best Seller",
        images: [
            "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?q=80&w=800&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?q=80&w=800&auto=format&fit=crop"
        ],
        specifications: {
            "Material": "100% Velvet",
            "Dimensions": "7ft x 4ft",
            "Care": "Dry clean only",
            "Lining": "Blackout"
        },
        stock: 15,
        rating: 4.8,
        reviewCount: 24
    },
    {
        name: "Dual Zone Zebra Blinds",
        rate: 2499,
        description: "Modern zebra blinds with dual sheer and solid stripes for perfect light control. Easy to operate and maintain.",
        category: "Blinds",
        tag: "Modern",
        images: [
            "https://images.unsplash.com/photo-1505691938895-1758d7eaa511?q=80&w=800&auto=format&fit=crop"
        ],
        specifications: {
            "Material": "Polyester Fabric",
            "Width": "Custom sizes available",
            "Operation": "Chain control",
            "Light Control": "Adjustable"
        },
        stock: 30,
        rating: 4.6,
        reviewCount: 18
    },
    {
        name: "Blackout Roller Shades",
        rate: 1899,
        description: "Complete light blocking roller shades ideal for bedrooms and media rooms. Energy efficient and noise reducing.",
        category: "Blinds",
        tag: "Functional",
        images: [
            "https://images.unsplash.com/photo-1615873968403-89e068628265?q=80&w=800&auto=format&fit=crop"
        ],
        specifications: {
            "Material": "Blackout Fabric",
            "Light Blocking": "100%",
            "Installation": "Easy mount",
            "Warranty": "2 years"
        },
        stock: 25,
        rating: 4.7,
        reviewCount: 31
    },
    {
        name: "Sheer Elegance Netting",
        rate: 1299,
        description: "Delicate sheer curtains that filter light beautifully while maintaining privacy. Perfect for layering.",
        category: "Curtains",
        tag: "Lightweight",
        images: [
            "https://images.unsplash.com/photo-1548611635-b6e78bb0d502?q=80&w=800&auto=format&fit=crop"
        ],
        specifications: {
            "Material": "Sheer Polyester",
            "Transparency": "Semi-transparent",
            "Dimensions": "9ft x 5ft",
            "Care": "Machine washable"
        },
        stock: 40,
        rating: 4.5,
        reviewCount: 15
    },
    {
        name: "Silk Embroidery Panel",
        rate: 7500,
        description: "Hand-embroidered silk curtains featuring intricate patterns. A statement piece for luxury interiors.",
        category: "Curtains",
        tag: "Premium",
        images: [
            "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?q=80&w=800&auto=format&fit=crop"
        ],
        specifications: {
            "Material": "Pure Silk",
            "Embroidery": "Hand-crafted",
            "Dimensions": "8ft x 4.5ft",
            "Care": "Professional dry clean"
        },
        stock: 5,
        rating: 5.0,
        reviewCount: 8
    },
    {
        name: "Automated Roller System",
        rate: 12999,
        description: "Smart motorized roller blinds with remote and app control. Compatible with Alexa and Google Home.",
        category: "Blinds",
        tag: "Smart Home",
        images: [
            "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=800&auto=format&fit=crop"
        ],
        specifications: {
            "Control": "Remote + App",
            "Power": "Rechargeable battery",
            "Smart Home": "Alexa, Google compatible",
            "Warranty": "3 years"
        },
        stock: 8,
        rating: 4.9,
        reviewCount: 12
    },
    {
        name: "Linen Blend Curtains",
        rate: 3499,
        description: "Natural linen blend curtains with a relaxed, casual look. Breathable and eco-friendly.",
        category: "Curtains",
        tag: "Eco-Friendly",
        images: [
            "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?q=80&w=800&auto=format&fit=crop"
        ],
        specifications: {
            "Material": "55% Linen, 45% Cotton",
            "Dimensions": "7.5ft x 4ft",
            "Sustainability": "Eco-friendly",
            "Care": "Machine washable cold"
        },
        stock: 20,
        rating: 4.4,
        reviewCount: 22
    },
    {
        name: "Vertical Blinds - Office",
        rate: 2199,
        description: "Professional vertical blinds perfect for offices and large windows. Durable and easy to maintain.",
        category: "Blinds",
        tag: "Commercial",
        images: [
            "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?q=80&w=800&auto=format&fit=crop"
        ],
        specifications: {
            "Material": "PVC Slats",
            "Width": "Up to 12ft",
            "Durability": "Heavy-duty",
            "Maintenance": "Wipe clean"
        },
        stock: 35,
        rating: 4.3,
        reviewCount: 19
    },
    {
        name: "Decorative Curtain Rods",
        rate: 899,
        description: "Premium metal curtain rods with decorative finials. Available in multiple finishes.",
        category: "Accessories",
        tag: "Hardware",
        images: [
            "https://images.unsplash.com/photo-1600607687644-c7171b42498b?q=80&w=800&auto=format&fit=crop"
        ],
        specifications: {
            "Material": "Stainless Steel",
            "Length": "4ft to 8ft adjustable",
            "Finish": "Brushed nickel, Bronze, Gold",
            "Weight Capacity": "Up to 20kg"
        },
        stock: 50,
        rating: 4.6,
        reviewCount: 45
    },
    {
        name: "Thermal Insulated Curtains",
        rate: 3999,
        description: "Energy-saving thermal curtains that keep rooms cool in summer and warm in winter. Noise reducing.",
        category: "Curtains",
        tag: "Energy Saver",
        images: [
            "https://images.unsplash.com/photo-1600210491892-03d54c0aaf87?q=80&w=800&auto=format&fit=crop"
        ],
        specifications: {
            "Material": "Triple-weave fabric",
            "Insulation": "Thermal backing",
            "Dimensions": "8ft x 4.5ft",
            "Noise Reduction": "Up to 40%"
        },
        stock: 18,
        rating: 4.7,
        reviewCount: 27
    }
];

async function seedShopProducts() {
    console.log('Starting to seed shop products...');

    for (const product of demoProducts) {
        try {
            await prisma.shopProduct.create({
                data: product
            });
            console.log(`✓ Created: ${product.name}`);
        } catch (error) {
            console.error(`✗ Failed to create ${product.name}:`, error.message);
        }
    }

    console.log('\nSeeding completed!');
    await prisma.$disconnect();
}

seedShopProducts()
    .catch((error) => {
        console.error('Seeding failed:', error);
        process.exit(1);
    });
