import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function TermsPage() {
    return (
        <div className="max-w-4xl mx-auto py-16 px-4 sm:px-6">
            <Link href="/" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 mb-8 transition-colors">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
            </Link>

            <h1 className="text-4xl font-bold tracking-tight text-slate-900 mb-8">Terms of Service</h1>

            <div className="prose prose-slate prose-lg max-w-none space-y-8 text-slate-600">
                <section>
                    <h2 className="text-2xl font-bold text-slate-900 mb-4">1. Acceptance of Terms</h2>
                    <p>
                        By accessing or using Chawla Parde Wala's services, including our website and showroom, you agree to be bound by these Terms of Service.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-bold text-slate-900 mb-4">2. Product Customization</h2>
                    <p>
                        Most of our products (Curtains, Blinds, etc.) are custom-tailored to your specific measurements.
                    </p>
                    <ul className="list-disc pl-6 space-y-2">
                        <li>Measurements provided by the customer or taken by our staff will be considered final once the order is placed.</li>
                        <li>Slight variations in color/texture may occur between samples and the final product due to fabric dye lots.</li>
                    </ul>
                </section>

                <section>
                    <h2 className="text-2xl font-bold text-slate-900 mb-4">3. Quotations and Payments</h2>
                    <ul className="list-disc pl-6 space-y-2">
                        <li>All quotations/estimates are valid for 7 days from the date of issue.</li>
                        <li>A 50% advance payment is required to initiate the production/stitching process.</li>
                        <li>The remaining balance must be cleared at the time of delivery or completion of installation.</li>
                    </ul>
                </section>

                <section>
                    <h2 className="text-2xl font-bold text-slate-900 mb-4">4. Delivery and Installation</h2>
                    <p>
                        We strive to complete installations within the committed timeframe. However, delays due to unforeseen circumstances or fabric availability may occur. Chawla Parde Wala is not liable for indirect losses caused by such delays.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-bold text-slate-900 mb-4">5. Returns and Refunds</h2>
                    <p>
                        Due to the custom nature of our products, we do not accept returns or offer refunds once production has started or fabric has been cut. Any defects in material or stitching will be rectified free of charge if reported within 48 hours of installation.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-bold text-slate-900 mb-4">6. Governing Law</h2>
                    <p>
                        These terms shall be governed by and construed in accordance with the laws of Haryana, India. Any disputes shall be subject to the exclusive jurisdiction of the courts in Panipat.
                    </p>
                </section>
            </div>

            <footer className="mt-20 pt-8 border-t border-slate-100 text-center text-sm text-slate-400">
                Last updated: February 16, 2026
            </footer>
        </div>
    );
}
