import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPage() {
    return (
        <div className="max-w-4xl mx-auto py-16 px-4 sm:px-6">
            <Link href="/" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 mb-8 transition-colors">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
            </Link>

            <h1 className="text-4xl font-bold tracking-tight text-slate-900 mb-8">Privacy Policy</h1>

            <div className="prose prose-slate prose-lg max-w-none space-y-8 text-slate-600">
                <section>
                    <h2 className="text-2xl font-bold text-slate-900 mb-4">1. Introduction</h2>
                    <p>
                        Welcome to Chawla Parde Wala. We are committed to protecting your personal information and your right to privacy. If you have any questions or concerns about our policy, or our practices with regards to your personal information, please contact us.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-bold text-slate-900 mb-4">2. Information We Collect</h2>
                    <p>
                        We collect personal information that you voluntarily provide to us when you express an interest in obtaining information about us or our products and services, when you participate in activities on our website or otherwise when you contact us.
                    </p>
                    <ul className="list-disc pl-6 space-y-2">
                        <li><strong>Contact Information:</strong> Name, phone number, email address, and physical address for site measurements and deliveries.</li>
                        <li><strong>Transaction Data:</strong> Details about products you have purchased or inquired about.</li>
                        <li><strong>Measurement Data:</strong> Window dimensions and room details collected for custom tailoring.</li>
                    </ul>
                </section>

                <section>
                    <h2 className="text-2xl font-bold text-slate-900 mb-4">3. How We Use Your Information</h2>
                    <p>We use the information we collect or receive:</p>
                    <ul className="list-disc pl-6 space-y-2">
                        <li>To facilitate site measurements and expert consultations.</li>
                        <li>To process your orders and manage installations.</li>
                        <li>To send you quotations, reminders, and updates via WhatsApp or SMS.</li>
                        <li>To improve our services and product offerings.</li>
                    </ul>
                </section>

                <section>
                    <h2 className="text-2xl font-bold text-slate-900 mb-4">4. Sharing Your Information</h2>
                    <p>
                        We do not sell, rent, or trade your personal information with third parties. We only share information with your consent, to comply with laws, to provide you with services, to protect your rights, or to fulfill business obligations.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-bold text-slate-900 mb-4">5. Contact Us</h2>
                    <p>
                        If you have questions or comments about this policy, you may contact us at:
                    </p>
                    <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 mt-4">
                        <p className="font-bold text-slate-900">Chawla Parde Wala</p>
                        <p>Shop 103, 110 SD College Road, Panipat, Haryana 132103</p>
                        <p>Phone: +91 74046-18501, +91 98120-18501</p>
                    </div>
                </section>
            </div>

            <footer className="mt-20 pt-8 border-t border-slate-100 text-center text-sm text-slate-400">
                Last updated: February 16, 2026
            </footer>
        </div>
    );
}
