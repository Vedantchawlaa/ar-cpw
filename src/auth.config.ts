import type { NextAuthConfig } from "next-auth";

export const authConfig = {
    trustHost: true,
    pages: {
        signIn: "/login",
    },
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user;
            const role = (auth?.user as any)?.role;

            const isOnAdminRoute = nextUrl.pathname.startsWith("/dashboard") || nextUrl.pathname.startsWith("/sales") || nextUrl.pathname.startsWith("/staff") || nextUrl.pathname.startsWith("/attendance");
            const isOnProtectedRoute = isOnAdminRoute || nextUrl.pathname.startsWith("/leads") || nextUrl.pathname.startsWith("/quotations") || nextUrl.pathname.startsWith("/reminders") || nextUrl.pathname.startsWith("/products");

            if (isOnAdminRoute) {
                if (isLoggedIn && role === "admin") return true;
                // Redirect non-admins to a safe place
                if (isLoggedIn) return Response.redirect(new URL(role === "customer" ? "/shop" : "/leads", nextUrl));
                return false;
            }

            if (isOnProtectedRoute) {
                // If it's a protected route (leads, etc.), allow only non-customers (staff/admin)
                // Customers should not see leads/quotations/reminders
                if (isLoggedIn) {
                    if (role === "customer") return Response.redirect(new URL("/shop", nextUrl));
                    return true;
                }
                return false;
            }

            if (isLoggedIn && nextUrl.pathname === "/login") {
                const redirectPath = role === "admin" ? "/dashboard" : (role === "customer" ? "/shop" : "/leads");
                return Response.redirect(new URL(redirectPath, nextUrl));
            }
            return true;
        },
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.role = (user as any).role;
                // console.log("JWT Callback - Set ID:", token.id);
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.id = (token.id as string) || (token.sub as string);
                (session.user as any).role = token.role;
                // console.log("Session Callback - Set User ID:", session.user.id);
            }
            return session;
        },
    },
    providers: [], // Add providers with an empty array for now
} satisfies NextAuthConfig;
