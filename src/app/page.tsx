import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { auth, signOut } from "@/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
// @ts-ignore
import { ArrowRight, Star, Ruler, Truck, ShieldCheck, Smartphone, Sparkles, MapPin, Instagram, MessageCircle, Facebook, Phone } from "lucide-react";
import { PublicHeader } from "@/components/layout/PublicHeader";

export default async function LandingPage() {
  const session = await auth();
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />

      <main className="flex-1">
        {/* Luxury Hero Section */}
        <section className="relative w-full py-20 lg:py-32 flex items-center justify-center overflow-x-hidden bg-slate-50">
          <div className="container px-4 md:px-6 relative z-10">
            <div className="flex flex-col items-center text-center space-y-10">
              <div className="space-y-6 max-w-4xl">
                <div className="inline-flex items-center rounded-full border border-indigo-100 px-4 py-1 text-sm font-medium text-indigo-600 bg-indigo-50/50 mb-2">
                  <Star className="h-4 w-4 mr-2 fill-indigo-600" /> Defining Luxury Windows Since 1995
                </div>
                <h1 className="text-5xl font-black tracking-tight sm:text-6xl lg:text-8xl leading-[0.9]">
                  Elegance for <br className="hidden md:inline" />
                  <span className="italic font-serif text-slate-400">every</span> Window.
                </h1>
                <p className="mx-auto max-w-[800px] text-lg text-slate-600 md:text-2xl leading-relaxed font-light">
                  Chawla Parde Wala brings premium fabrics, master tailoring, and
                  expert installation to your home. From motorized blinds to designer drapes.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 min-w-[260px]">
                <Button asChild size="lg" className="rounded-full h-14 px-10 text-lg font-bold shadow-2xl shadow-indigo-200 bg-slate-900 group">
                  <Link href="#collections" className="flex items-center">
                    Explore Collection <ArrowRight className="flex ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="rounded-full h-14 px-10 text-lg font-bold border-2 bg-white hover:bg-slate-50 transition-colors">
                  <a href="https://wa.me/917404618501?text=Hi, I would like to book a Free Site Measurement for curtains/blinds." target="_blank" rel="noopener noreferrer">
                    Free Site Measurement
                  </a>
                </Button>
              </div>
            </div>
          </div>

          {/* Decorative Elements */}
          <div className="absolute top-1/2 left-0 -translate-y-1/2 w-64 h-64 bg-indigo-100 rounded-full blur-[120px] opacity-50" />
          <div className="absolute top-1/2 right-0 -translate-y-1/2 w-96 h-96 bg-purple-100 rounded-full blur-[150px] opacity-40" />
        </section>

        {/* Collections Section */}
        <section id="collections" className="w-full py-24 bg-white">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-4">
              <div className="space-y-2">
                <h2 className="text-sm font-bold tracking-[0.3em] uppercase text-indigo-500">Our Signature Range</h2>
                <h3 className="text-4xl font-bold tracking-tight sm:text-5xl">Curated Collections</h3>
              </div>
              <p className="text-slate-500 max-w-md font-medium">Discover our wide variety of premium fabrics and modern window solutions tailored for your space.</p>
            </div>

            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { title: "Premium Curtains", type: "Velvet, Silk, Cotton", img: "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?q=80&w=800&auto=format&fit=crop" },
                { title: "Zebra Blinds", type: "Dual Shade, Motorized", img: "https://images.unsplash.com/photo-1505691938895-1758d7eaa511?q=80&w=800&auto=format&fit=crop" },
                { title: "Roller Blinds", type: "Blackout, Translucent", img: "https://images.unsplash.com/photo-1615873968403-89e068628265?q=80&w=800&auto=format&fit=crop" }
              ].map((item, i) => (
                <div key={i} className="group relative aspect-[3/4] overflow-hidden rounded-2xl bg-slate-100 shadow-xl transition-transform hover:-translate-y-2">
                  <img src={item.img} alt={item.title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-8 flex flex-col justify-end">
                    <h4 className="text-2xl font-bold text-white">{item.title}</h4>
                    <p className="text-slate-300 font-medium">{item.type}</p>
                    <Button variant="link" className="text-white p-0 h-auto mt-4 w-fit group/btn">
                      View Range <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Value Proposition */}
        <section id="services" className="relative w-full py-24 bg-slate-900 text-white overflow-hidden">
          <div className="container px-4 md:px-6 relative z-10">
            <div className="grid gap-12 lg:grid-cols-2 items-center">
              <div className="space-y-8">
                <div className="space-y-4">
                  <h2 className="text-sm font-bold tracking-[0.3em] uppercase text-indigo-400">Why Chawla Parde Wala?</h2>
                  <h3 className="text-4xl font-bold tracking-tight sm:text-6xl leading-tight">Mastering the Art <br />of Drape since 1995.</h3>
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                  {[
                    { icon: Ruler, title: "Custom Fit", desc: "Each curtain is laser-measured and hand-stitched for perfection." },
                    { icon: ShieldCheck, title: "Elite Fabrics", desc: "We source globally, ensuring durability and timeless elegance." },
                    { icon: Truck, title: "Swift Install", desc: "Expert placement by our trained fitting specialists in 48 hours." },
                    { icon: Sparkles, title: "Modern Designs", desc: "Latest motorized systems and trending designer patterns." }
                  ].map((item, i) => (
                    <div key={i} className="space-y-2 group">
                      <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-white/10 group-hover:bg-indigo-500 transition-colors">
                        <item.icon className="h-5 w-5 text-indigo-400 group-hover:text-white" />
                      </div>
                      <h4 className="font-bold text-lg">{item.title}</h4>
                      <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="relative">
                <div className="aspect-square rounded-full border-[20px] border-white/5 absolute -right-20 -top-20 w-[600px] h-[600px] -z-10 animate-spin-slow" />
                <img
                  src="https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?q=80&w=800&auto=format&fit=crop"
                  className="rounded-3xl shadow-2xl relative z-10 border-4 border-white/10"
                  alt="Interior"
                />
                <div className="absolute -bottom-6 -left-6 bg-indigo-600 p-8 rounded-2xl shadow-xl z-20 hidden md:block border-4 border-slate-900">
                  <div className="text-5xl font-black italic mb-1">29+</div>
                  <div className="text-xs font-bold uppercase tracking-widest text-indigo-100">Years of Craftsmanship</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* AR Section */}
      </main>

      {/* Footer */}
      <footer id="contact" className="w-full py-12 md:py-20 bg-white border-t border-slate-100">
        <div className="container px-4 md:px-6">
          <div className="grid gap-12 md:grid-cols-4">
            <div className="col-span-1 md:col-span-2 space-y-6">
              <Link className="flex items-center gap-3" href="/">
                <img src="/logo.png" alt="Logo" className="h-10 w-auto" />
                <div className="flex flex-col">
                  <span className="font-bold text-lg leading-none tracking-tight">CHAWLA</span>
                  <span className="text-xs font-medium text-slate-500 tracking-[0.2em]">PARDE WALA</span>
                </div>
              </Link>
              <p className="text-slate-600 max-w-md">
                Transforming spaces with premium curtains and blinds since 1990. Your trusted partner for elegant window solutions.
              </p>
              <div className="flex items-center gap-4">
                <a href="https://www.instagram.com/chawlapardewala/" target="_blank" rel="noopener noreferrer" className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-900 hover:text-white transition-colors" suppressHydrationWarning>
                  <Instagram className="h-5 w-5" />
                </a>
                <a href="https://www.facebook.com/chawlapardewala" target="_blank" rel="noopener noreferrer" className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-900 hover:text-white transition-colors" suppressHydrationWarning>
                  <Facebook className="h-5 w-5" />
                </a>
                <a href="tel:+919876543210" className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-900 hover:text-white transition-colors" suppressHydrationWarning>
                  <Phone className="h-5 w-5" />
                </a>
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
              <Link className="text-xs font-bold text-slate-400 hover:text-slate-900 uppercase tracking-widest transition-colors" href="/terms">Terms</Link>
              <Link className="text-xs font-bold text-slate-400 hover:text-slate-900 uppercase tracking-widest transition-colors" href="/privacy">Privacy</Link>
            </div>
          </div>
        </div>
      </footer>
    </div >
  );
}
