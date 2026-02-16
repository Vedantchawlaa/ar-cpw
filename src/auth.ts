import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import db from "@/lib/db";
import bcrypt from "bcrypt";

async function getUser(email: string): Promise<any> {
    try {
        const user = await db.user.findUnique({
            where: { email },
        });
        return user;
    } catch (error) {
        console.error("Failed to fetch user:", error);
        throw new Error("Failed to fetch user.");
    }
}

export const { auth, signIn, signOut, handlers } = NextAuth({
    ...authConfig,
    providers: [
        Credentials({
            async authorize(credentials) {
                const parsedCredentials = z
                    .object({ email: z.string().email(), password: z.string().min(6) })
                    .safeParse(credentials);

                if (parsedCredentials.success) {
                    const { email, password } = parsedCredentials.data;
                    console.log("Authorize: Looking for user:", email);
                    const user = await getUser(email);
                    if (!user) {
                        console.log("Authorize: User not found");
                        return null;
                    }

                    console.log("Authorize: User found, comparing passwords...");
                    const passwordsMatch = await bcrypt.compare(password, user.password);

                    if (passwordsMatch) {
                        console.log("Authorize: Login successful");
                        return user;
                    }
                    console.log("Authorize: Password mismatch");
                } else {
                    console.log("Authorize: Invalid input fields", parsedCredentials.error.format());
                }

                console.log("Invalid credentials");
                return null;
            },
        }),
    ],
});
