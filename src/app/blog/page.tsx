import Link from "next/link";
import { Button } from "@/components/ui/Button";
// @ts-ignore
import { ArrowRight, Sparkles, Clock, User, Tag, ChevronRight, Instagram, MapPin, Smartphone } from "lucide-react";

const POSTS = [
    {
        id: "1",
        title: "5 Trends for Modern Window Treatments in 2026",
        excerpt: "From motorized zebra blinds to sustainable organic linens, discover what's defining high-end homes this year.",
        date: "Feb 12, 2026",
        author: "Vikram Chawla",
        category: "Trends",
        image: "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?q=80&w=800&auto=format&fit=crop",
        readTime: "5 min read"
    },
    {
        id: "2",
        title: "The Ultimate Guide to Choosing the Right Fabric",
        excerpt: "Velvet vs. Silk? Blackout vs. Sheer? We break down the technical aspects of curtains to help you choose perfectly.",
        date: "Feb 08, 2026",
        author: "Interior Expert",
        category: "Buying Guide",
        image: "https://images.unsplash.com/photo-1548611635-b6e78bb0d502?q=80&w=800&auto=format&fit=crop",
        readTime: "8 min read"
    },
    {
        id: "3",
        title: "Why Motorized Blinds are a Game Changer",
        excerpt: "Integrating your window treatments with Alexa or Google Home isn't just a flex—it's a lifestyle upgrade.",
        date: "Jan 28, 2026",
        author: "Tech Team",
        category: "Smart Home",
        image: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=800&auto=format&fit=crop",
        readTime: "4 min read"
    },
    {
        id: "4",
        title: "Small Room? These Window Tricks Will Help",
        excerpt: "Learn how floor-to-ceiling drapes can make any compact space feel like a sprawling penthouse.",
        date: "Jan 15, 2026",
        author: "Design Studio",
        category: "Design Tips",
        image: "https://images.unsplash.com/photo-1505691938895-1758d7eaa511?q=80&w=800&auto=format&fit=crop",
        readTime: "6 min read"
    }
];

export default function BlogPage() {
    const featuredPost = POSTS[0];
    const recentPosts = POSTS.slice(1);

    return (
        <div className="min-h-screen bg-white flex flex-col font-sans">
            {/* Elegant Blog Header */}
            <header className="sticky top-0 z-50 w-full border-b border-slate-100 bg-white/80 backdrop-blur-md">
                <div className="container flex h-16 max-w-screen-2xl items-center px-4 md:px-6">
                    <Link className="flex items-center gap-3 group" href="/">
                        <img src="/logo.png" alt="Chawla Parde Wala Logo" className="h-10 w-auto transition-transform group-hover:scale-105" />
                        <div className="flex flex-col text-left">
                            <span className="font-bold text-sm tracking-tight leading-none text-slate-900 uppercase">CHAWLA</span>
                            <span className="text-[10px] font-medium text-slate-500 tracking-[0.2em] uppercase">PARDE WALA</span>
                        </div>
                    </Link>
                    <nav className="hidden md:flex ml-auto gap-8 items-center">
                        <Link className="text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors uppercase tracking-widest" href="/shop">Shop</Link>
                        <Link className="text-sm font-bold text-slate-900 transition-colors uppercase tracking-widest border-b-2 border-indigo-600" href="/blog">Blog</Link>
                        <Link className="text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors uppercase tracking-widest" href="/login">Sign In</Link>
                        <Link href="/shop">
                            <Button size="sm" className="rounded-full px-6 font-bold shadow-lg shadow-indigo-100 bg-indigo-600">Explore Collection</Button>
                        </Link>
                    </nav>
                </div>
            </header>

            <main className="flex-1">
                {/* Blog Intro */}
                <section className="py-16 md:py-24 bg-slate-50 border-b border-slate-100">
                    <div className="container px-4 md:px-6 text-center space-y-4">
                        <h1 className="text-sm font-black uppercase tracking-[0.4em] text-indigo-500">The Editorial</h1>
                        <h2 className="text-5xl md:text-7xl font-black tracking-tight text-slate-900 leading-[0.9]">Insights & <br /><span className="italic font-serif text-slate-400">Inspiration.</span></h2>
                        <p className="max-w-xl mx-auto text-slate-500 font-medium pt-4 text-lg italic">Explore the latest in window design, fabric tech, and luxury interior styling from the experts at Chawla Parde Wala.</p>
                    </div>
                </section>

                {/* Featured Post */}
                <section className="py-12 md:py-20">
                    <div className="container px-4 md:px-6">
                        <div className="group relative grid gap-8 lg:grid-cols-2 lg:items-center bg-slate-900 rounded-[40px] overflow-hidden p-4 md:p-8 text-white shadow-2xl">
                            <div className="aspect-[16/9] lg:aspect-square overflow-hidden rounded-[30px]">
                                <img
                                    src={featuredPost.image}
                                    className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                                    alt={featuredPost.title}
                                />
                            </div>
                            <div className="p-4 md:p-12 space-y-6">
                                <span className="px-4 py-1.5 bg-indigo-500 rounded-full text-[10px] font-black uppercase tracking-[0.2em]">{featuredPost.category}</span>
                                <h3 className="text-4xl md:text-5xl font-black leading-tight tracking-tight group-hover:text-indigo-400 transition-colors">{featuredPost.title}</h3>
                                <p className="text-slate-400 text-lg md:text-xl font-medium leading-relaxed">{featuredPost.excerpt}</p>
                                <div className="flex items-center gap-6 text-sm text-slate-500 font-bold uppercase tracking-widest pt-4">
                                    <span className="flex items-center gap-2"><User className="h-4 w-4" /> {featuredPost.author}</span>
                                    <span className="flex items-center gap-2"><Clock className="h-4 w-4" /> {featuredPost.readTime}</span>
                                </div>
                                <Button size="lg" className="rounded-full bg-white text-slate-900 hover:bg-slate-100 font-black h-14 px-10 group/btn">
                                    Read Article <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover/btn:translate-x-1" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Recent Posts Grid */}
                <section className="py-20 bg-white">
                    <div className="container px-4 md:px-6">
                        <div className="flex justify-between items-end mb-16 px-4">
                            <h4 className="text-3xl font-black tracking-tight text-slate-900 underline decoration-indigo-200 decoration-8 underline-offset-8">Recent Stories</h4>
                            <Link href="#" className="text-sm font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 transition-colors flex items-center gap-1">
                                View Archive <ChevronRight className="h-4 w-4" />
                            </Link>
                        </div>
                        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-3">
                            {recentPosts.map((post) => (
                                <article key={post.id} className="group space-y-6">
                                    <div className="aspect-[4/5] overflow-hidden rounded-3xl bg-slate-100 shadow-lg relative">
                                        <img
                                            src={post.image}
                                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                            alt={post.title}
                                        />
                                        <div className="absolute top-6 left-6">
                                            <span className="px-3 py-1 bg-white/90 backdrop-blur-sm rounded-full text-[10px] font-black uppercase tracking-widest text-indigo-600">
                                                {post.category}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="px-2 space-y-4">
                                        <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                                            <span>{post.date}</span>
                                            <span>·</span>
                                            <span>{post.readTime}</span>
                                        </div>
                                        <h4 className="text-2xl font-black leading-tight text-slate-900 group-hover:text-indigo-600 transition-colors tracking-tight line-clamp-2">
                                            {post.title}
                                        </h4>
                                        <p className="text-slate-500 font-medium leading-relaxed line-clamp-3">
                                            {post.excerpt}
                                        </p>
                                        <Link href="#" className="inline-flex items-center text-sm font-black text-slate-900 group-hover:text-indigo-600 transition-colors uppercase tracking-[0.1em] gap-2 pt-2">
                                            Read More <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                                        </Link>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Newsletter */}
                <section className="container px-4 md:px-6 py-20">
                    <div className="bg-slate-50 rounded-[50px] p-12 md:p-24 text-center space-y-8 border border-slate-100 relative overflow-hidden">
                        <div className="max-w-2xl mx-auto relative z-10 space-y-6">
                            <Tag className="h-10 w-10 text-indigo-500 mx-auto" />
                            <h2 className="text-4xl md:text-5xl font-black tracking-tight leading-none text-slate-900">Get design tips <br /><span className="text-indigo-600">in your inbox.</span></h2>
                            <p className="text-slate-500 text-lg font-medium">Join 5,000+ homeowners receiving our weekly guide to luxury interior styling.</p>
                            <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto pt-4 font-sans">
                                <input
                                    type="email"
                                    placeholder="Enter your email"
                                    className="h-14 flex-1 rounded-full px-8 bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                                />
                                <Button size="lg" className="h-14 rounded-full bg-slate-900 px-10 font-black">Join Us</Button>
                            </div>
                        </div>
                        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-100/30 via-transparent to-transparent opacity-50" />
                    </div>
                </section>
            </main>

            <footer id="contact" className="w-full py-12 md:py-20 bg-white border-t border-slate-100 font-sans">
                <div className="container px-4 md:px-6">
                    <div className="grid gap-12 md:grid-cols-4 text-left">
                        <div className="col-span-1 md:col-span-2 space-y-6">
                            <Link className="flex items-center gap-3" href="/">
                                <img src="/logo.png" alt="Logo" className="h-10 w-auto" />
                                <div className="flex flex-col">
                                    <span className="font-bold text-lg leading-none tracking-tight">CHAWLA</span>
                                    <span className="text-xs font-medium text-slate-500 tracking-[0.2em]">PARDE WALA</span>
                                </div>
                            </Link>
                            <p className="max-w-md text-slate-500 font-medium leading-relaxed">
                                Transforming residential and commercial spaces with premium window treatments and custom interior solutions. We combine traditional craftsmanship with modern technology.
                            </p>
                            <div className="flex items-center gap-4">
                                <Link href="https://www.instagram.com/chawlapardewala/" target="_blank" className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-900 hover:text-white transition-colors">
                                    <Instagram className="h-5 w-5" />
                                </Link>
                                <Link href="https://www.facebook.com/chawlapardewala" target="_blank" className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-900 hover:text-white transition-colors cursor-pointer">
                                    <span className="font-bold text-lg">f</span>
                                </Link>
                                <Link href="https://wa.me/917404618501" target="_blank" className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-green-500 hover:text-white transition-colors cursor-pointer">
                                    <Smartphone className="h-5 w-5" />
                                </Link>
                            </div>
                        </div>
                        <div className="space-y-6">
                            <h4 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">Contact Us</h4>
                            <ul className="space-y-4">
                                <li className="flex items-start gap-3">
                                    <MapPin className="h-5 w-5 text-indigo-500 shrink-0" />
                                    <a href="https://maps.app.goo.gl/iscHP49G5fAZ6n7UA" target="_blank" className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors">Shop 103,110 SD College Road, Panipat, Haryana 132103</a>
                                </li>
                                <li className="flex items-center gap-3">
                                    <Smartphone className="h-5 w-5 text-indigo-500 shrink-0" />
                                    <div className="flex flex-col">
                                        <a href="tel:+917404618501" className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors">+91 74046-18501</a>
                                        <a href="tel:+919812018501" className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors">+91 98120-18501</a>
                                    </div>
                                </li>
                            </ul>
                        </div>
                        <div className="space-y-6">
                            <h4 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">Internal Access</h4>
                            <ul className="space-y-4">
                                <li>
                                    <Link href="/login" className="text-sm font-bold text-indigo-600 hover:text-indigo-700 underline underline-offset-4">
                                        Staff Portal Login
                                    </Link>
                                </li>
                                <li className="text-[10px] uppercase font-bold text-slate-300 leading-tight">
                                    CRM & Inventory <br /> Management System
                                </li>
                            </ul>
                        </div>
                    </div>
                    <div className="mt-16 pt-8 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none">
                            © 2026 Chawla Parde Wala. All Rights Reserved.
                        </p>
                        <div className="flex gap-8">
                            <Link className="text-xs font-bold text-slate-400 hover:text-slate-900 uppercase tracking-widest transition-colors" href="#">Terms</Link>
                            <Link className="text-xs font-bold text-slate-400 hover:text-slate-900 uppercase tracking-widest transition-colors" href="#">Privacy</Link>
                            <Link className="text-xs font-bold text-slate-400 hover:text-slate-900 uppercase tracking-widest transition-colors" href="/contact">Contact Us</Link>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
