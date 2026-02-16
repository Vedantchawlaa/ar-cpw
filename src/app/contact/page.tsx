"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
// @ts-ignore
import { MapPin, Smartphone, Mail, Clock, Instagram, Facebook, MessageCircle } from "lucide-react";
import React, { useRef, useState } from 'react';
import emailjs from '@emailjs/browser';
import { HamburgerMenu } from "@/components/shop/HamburgerMenu";

export default function ContactPage() {
    const form = useRef<HTMLFormElement>(null);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

    const sendEmail = (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setStatus('idle');

        if (form.current) {
            emailjs.sendForm(
                process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID!,
                process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID!,
                form.current,
                process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY!
            )
                .then((result) => {
                    console.log(result.text);
                    setStatus('success');
                    form.current?.reset();
                }, (error) => {
                    console.log(error.text);
                    setStatus('error');
                })
                .finally(() => {
                    setLoading(false);
                });
        }
    };

    return (
        <div className="flex min-h-screen flex-col bg-white">
            <header className="sticky top-0 z-50 w-full border-b border-slate-100 bg-white/80 backdrop-blur-md">
                <div className="container flex h-16 max-w-screen-2xl items-center px-4 md:px-6">
                    <Link className="flex items-center gap-3 group" href="/">
                        <img src="/logo.png" alt="Chawla Parde Wala Logo" className="h-10 w-auto transition-transform group-hover:scale-105" />
                        <div className="flex flex-col text-left">
                            <span className="font-bold text-sm tracking-tight leading-none text-slate-900">CHAWLA</span>
                            <span className="text-[10px] font-medium text-slate-500 tracking-[0.2em]">PARDE WALA</span>
                        </div>
                    </Link>
                    <div className="ml-auto">
                        <HamburgerMenu />
                    </div>
                </div>
            </header>

            <main className="flex-1">
                <section className="w-full py-12 md:py-24 lg:py-32 bg-slate-50">
                    <div className="container px-4 md:px-6">
                        <div className="flex flex-col items-center justify-center space-y-4 text-center">
                            <div className="space-y-2">
                                <h1 className="text-3xl font-black tracking-tighter sm:text-5xl">Contact Us</h1>
                                <p className="max-w-[700px] text-slate-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed font-medium">
                                    We're here to help you transform your space. Reach out to us for enquiries, custom orders, or just to say hello.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="w-full py-12 md:py-24 lg:py-32">
                    <div className="container px-4 md:px-6">
                        <div className="grid gap-12 lg:grid-cols-2">
                            <div className="space-y-8">
                                <div className="space-y-6">
                                    <h2 className="text-2xl font-bold">Get in Touch</h2>
                                    <div className="grid gap-6">
                                        <div className="flex items-start gap-4">
                                            <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                                                <MapPin className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold">Visit Our Showroom</h3>
                                                <a href="https://maps.app.goo.gl/iscHP49G5fAZ6n7UA" target="_blank" className="text-slate-500 hover:text-indigo-600 transition-colors block mt-1">
                                                    Shop 103, 110 SD College Road,<br />
                                                    Panipat, Haryana 132103
                                                </a>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-4">
                                            <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                                                <Smartphone className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold">Call Us</h3>
                                                <div className="flex flex-col mt-1">
                                                    <a href="tel:+917404618501" className="text-slate-500 hover:text-indigo-600 transition-colors">+91 74046-18501</a>
                                                    <a href="tel:+919812018501" className="text-slate-500 hover:text-indigo-600 transition-colors">+91 98120-18501</a>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-4">
                                            <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                                                <MessageCircle className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold">WhatsApp</h3>
                                                <a href="https://wa.me/917404618501" target="_blank" className="text-slate-500 hover:text-indigo-600 transition-colors block mt-1">
                                                    Chat with us regarding your order
                                                </a>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-4">
                                            <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                                                <Clock className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold">Opening Hours</h3>
                                                <p className="text-slate-500 mt-1">
                                                    Monday - Sunday<br />
                                                    10:00 AM - 08:30 PM
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-6">
                                    <h2 className="text-2xl font-bold">Follow Us</h2>
                                    <div className="flex gap-4">
                                        <Link href="https://www.instagram.com/chawlapardewala/" target="_blank" className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-indigo-600 hover:text-white transition-colors">
                                            <Instagram className="h-6 w-6" />
                                        </Link>
                                        <Link href="https://www.facebook.com/chawlapardewala" target="_blank" className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-indigo-600 hover:text-white transition-colors">
                                            <span className="font-bold text-xl">f</span>
                                        </Link>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-6">
                                <form ref={form} onSubmit={sendEmail} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                                    <div className="space-y-2">
                                        <h2 className="text-2xl font-bold">Send us a message</h2>
                                        <p className="text-slate-500 text-sm">Fill out the form below and we'll get back to you shortly.</p>
                                    </div>
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <label htmlFor="user_name" className="text-sm font-medium">Name</label>
                                            <input name="user_name" className="flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50" id="user_name" placeholder="John Doe" required />
                                        </div>
                                        <div className="space-y-2">
                                            <label htmlFor="user_email" className="text-sm font-medium">Email</label>
                                            <input name="user_email" className="flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50" id="user_email" placeholder="john@example.com" type="email" required />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label htmlFor="subject" className="text-sm font-medium">Subject</label>
                                        <input name="subject" className="flex h-10 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50" id="subject" placeholder="Inquiry about curtains" required />
                                    </div>
                                    <div className="space-y-2">
                                        <label htmlFor="message" className="text-sm font-medium">Message</label>
                                        <textarea name="message" className="flex min-h-[120px] w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50" id="message" placeholder="Type your message here..." required />
                                    </div>
                                    <Button disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">
                                        {loading ? "Sending..." : "Send Message"}
                                    </Button>

                                    {status === 'success' && (
                                        <div className="p-3 bg-green-50 text-green-700 rounded-md text-sm border border-green-200">
                                            Message sent successfully! We'll be in touch soon.
                                        </div>
                                    )}
                                    {status === 'error' && (
                                        <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm border border-red-200">
                                            Failed to send message. Please try again later or contact us via WhatsApp.
                                        </div>
                                    )}
                                </form>
                            </div>
                        </div>
                    </div>
                </section>

                <footer className="w-full py-12 md:py-20 bg-white border-t border-slate-100 font-sans">
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
                                        <MessageCircle className="h-5 w-5" />
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
            </main>
        </div>
    );
}
