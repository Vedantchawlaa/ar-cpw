"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/Card";
import { registerTeamMember } from "@/lib/actions/auth-actions";
// @ts-ignore
import { UserPlus, Shield, User } from "lucide-react";

export function UserRegistrationForm() {
    const [errorMessage, dispatch] = useActionState(registerTeamMember, undefined);
    const [selectedRole, setSelectedRole] = useState("user");

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <UserPlus className="h-5 w-5" />
                    Register New Member
                </CardTitle>
                <CardDescription>
                    Create a new account for a staff member.
                </CardDescription>
            </CardHeader>
            <form action={dispatch}>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <label htmlFor="name" className="text-sm font-medium">Full Name</label>
                        <Input id="name" name="name" placeholder="Jane Doe" required />
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="email" className="text-sm font-medium">Email</label>
                        <Input id="email" name="email" type="email" placeholder="jane@example.com" required />
                    </div>
                    <div className="space-y-2">
                        <label htmlFor="password" className="text-sm font-medium">Password</label>
                        <Input id="password" name="password" type="password" minLength={6} required />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Role</label>
                        <div className="grid grid-cols-2 gap-4">
                            <div
                                className={`flex flex-col items-center justify-center gap-2 rounded-lg border p-4 cursor-pointer transition-all ${selectedRole === 'user' ? 'bg-primary/5 border-primary ring-1 ring-primary' : 'hover:bg-muted'}`}
                                onClick={() => setSelectedRole('user')}
                            >
                                <User className={`h-6 w-6 ${selectedRole === 'user' ? 'text-primary' : 'text-muted-foreground'}`} />
                                <span className={`text-sm font-medium ${selectedRole === 'user' ? 'text-primary' : ''}`}>Staff User</span>
                                <input type="radio" name="role" value="user" checked={selectedRole === 'user'} onChange={() => setSelectedRole('user')} className="sr-only" />
                            </div>
                            <div
                                className={`flex flex-col items-center justify-center gap-2 rounded-lg border p-4 cursor-pointer transition-all ${selectedRole === 'admin' ? 'bg-primary/5 border-primary ring-1 ring-primary' : 'hover:bg-muted'}`}
                                onClick={() => setSelectedRole('admin')}
                            >
                                <Shield className={`h-6 w-6 ${selectedRole === 'admin' ? 'text-primary' : 'text-muted-foreground'}`} />
                                <span className={`text-sm font-medium ${selectedRole === 'admin' ? 'text-primary' : ''}`}>Administrator</span>
                                <input type="radio" name="role" value="admin" checked={selectedRole === 'admin'} onChange={() => setSelectedRole('admin')} className="sr-only" />
                            </div>
                        </div>
                    </div>

                    {errorMessage && (
                        <div className={`p-3 rounded-md text-sm ${errorMessage === "success" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"}`}>
                            {errorMessage === "success"
                                ? "Team member registered successfully!"
                                : errorMessage}
                        </div>
                    )}
                </CardContent>
                <CardFooter>
                    <Button className="w-full">Register Member</Button>
                </CardFooter>
            </form>
        </Card>
    );
}
