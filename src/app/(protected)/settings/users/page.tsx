import { getUsers } from "@/lib/actions/auth-actions";
import { UserRegistrationForm } from "@/components/admin/UserRegistrationForm";
import { UserList } from "@/components/admin/UserList";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
// @ts-ignore
import { Shield, User, Users } from "lucide-react";

export default async function UsersPage() {
    const allUsers = await getUsers();

    // Sort users into categories
    const teamMembers = allUsers.filter(u => u.role === 'admin' || u.role === 'user');
    const customers = allUsers.filter(u => u.role === 'customer');

    return (
        <div className="flex flex-col gap-8 p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Team Management</h1>
                    <p className="text-muted-foreground">Add new team members and manage access.</p>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Registration Form */}
                <UserRegistrationForm />

                {/* Role Information */}
                <Card>
                    <CardHeader>
                        <CardTitle>Role Permissions</CardTitle>
                        <CardDescription>
                            Understanding access levels.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex gap-4">
                            <div className="h-10 w-10 shrink-0 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                                <Shield className="h-5 w-5" />
                            </div>
                            <div>
                                <h4 className="font-semibold">Administrator</h4>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Full access to all modules including Sales, Team Management, and System Settings. Can manage other users.
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="h-10 w-10 shrink-0 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                                <User className="h-5 w-5" />
                            </div>
                            <div>
                                <h4 className="font-semibold">Staff User</h4>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Access to operational modules: Leads, Quotations, Reminders, and Products. Cannot view sensitive sales data or manage other users.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <UserList
                users={teamMembers}
                title="Team Members"
                icon={<Shield className="h-5 w-5 text-indigo-600" />}
                description="Administrators and Staff Users."
                emptyMessage="No team members found."
            />

            <div className="pt-6 border-t">
                <UserList
                    users={customers}
                    title="Customers"
                    icon={<Users className="h-5 w-5 text-emerald-600" />}
                    description="Registered customers via the shop."
                    emptyMessage="No customers registered yet."
                />
            </div>
        </div>
    );
}
