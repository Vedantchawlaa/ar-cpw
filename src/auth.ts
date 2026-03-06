import "dotenv/config";
import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import db from "@/lib/db";
import bcrypt from "bcrypt";
import { appendFile } from "fs/promises";
import path from "path";

async function logAuthServer(message: string) {
    const logPath = path.join(process.cwd(), "auth_server_debug.log");
    const timestamp = new Date().toISOString();
    try {
        await appendFile(logPath, `[${timestamp}] ${message}\n`);
    } catch (e) {
        console.error("Failed to write to auth_server_debug.log", e);
    }
}

async function getUser(email: string): Promise<any> {
    try {
        await logAuthServer(`getUser called for email: ${email}`);
        const user = await db.user.findUnique({
            where: { email },
        });
        await logAuthServer(`DB query finished for ${email}. User found? ${!!user}`);
        return user;
    } catch (error: any) {
        await logAuthServer(`getUser error for ${email}: ${error.message}`);
        console.error("Failed to fetch user:", error);
        throw new Error("Failed to fetch user.");
    }
}

export const { auth, signIn, signOut, handlers } = NextAuth({
    ...authConfig,
    providers: [
        Credentials({
            async authorize(credentials) {
                await logAuthServer(`Authorize called for: ${credentials?.email}`);
                const parsedCredentials = z
                    .object({ email: z.string().email(), password: z.string().min(6) })
                    .safeParse(credentials);

                if (parsedCredentials.success) {
                    const { email, password } = parsedCredentials.data;
                    await logAuthServer(`Credentials parsed successfully for ${email}`);
                    const user = await getUser(email);
                    if (!user) {
                        await logAuthServer(`User NOT found: ${email}`);
                        return null;
                    }

                    await logAuthServer(`User found: ${email}, role: ${user.role}`);
                    const passwordsMatch = await bcrypt.compare(password, user.password);
                    await logAuthServer(`Password match result for ${email}: ${passwordsMatch}`);

                    if (passwordsMatch) {
                        await logAuthServer(`SUCCESS: Returning user object for ${email}`);
                        return user;
                    }
                }

                await logAuthServer(`FAILURE: Auth failed for ${credentials?.email}`);
                console.log("Invalid credentials");
                return null;
            },
        }),
    ],
});
