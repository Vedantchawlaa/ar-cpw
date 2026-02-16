"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/Card";
import { registerCustomer } from "@/lib/actions/auth-actions";

export default function SignupPage() {
    const [errorMessage, dispatch] = useActionState(registerCustomer, undefined);

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
            <Card className="w-full max-w-sm">
                <CardHeader>
                    <CardTitle className="text-2xl">Create an Account</CardTitle>
                    <CardDescription>
                        Enter your details below to create your customer account.
                    </CardDescription>
                </CardHeader>
                <form action={dispatch}>
                    <CardContent className="grid gap-4">
                        <div className="grid gap-2">
                            <label htmlFor="name">Full Name</label>
                            <Input id="name" name="name" type="text" placeholder="John Doe" required />
                        </div>
                        <div className="grid gap-2">
                            <label htmlFor="email">Email</label>
                            <Input id="email" name="email" type="email" placeholder="customer@example.com" required />
                        </div>
                        <div className="grid gap-2">
                            <label htmlFor="password">Password</label>
                            <Input id="password" name="password" type="password" minLength={6} required />
                        </div>
                        {errorMessage && (
                            <div className={`text-sm ${errorMessage === "success" ? "text-green-600" : "text-red-500"}`}>
                                {errorMessage === "success"
                                    ? "Account created! You can now login."
                                    : errorMessage}
                            </div>
                        )}
                    </CardContent>
                    <CardFooter className="flex flex-col gap-2">
                        {errorMessage === "success" ? (
                            <Link href="/login" className="w-full">
                                <Button className="w-full" type="button">Go to Login</Button>
                            </Link>
                        ) : (
                            <Button className="w-full">Sign Up</Button>
                        )}
                        <div className="text-center text-sm text-gray-500">
                            Already have an account?{" "}
                            <Link href="/login" className="underline">
                                Sign in
                            </Link>
                        </div>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
