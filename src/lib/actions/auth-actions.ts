"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import db from "@/lib/db";
import bcrypt from "bcrypt";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const RegisterSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
});

export async function authenticate(
    prevState: string | undefined,
    formData: FormData,
) {
    try {
        await signIn("credentials", formData);
    } catch (error) {
        console.error("Authenticate action error:", error);
        if (error instanceof AuthError) {
            console.error("AuthError Type:", error.type);
            switch (error.type) {
                case "CredentialsSignin":
                    return "Invalid credentials.";
                default:
                    return `Auth Error: ${error.type}`;
            }
        }
        return `Unexpected Error: ${(error as any).message || "Unknown error"}`;
        throw error;
    }
}

export async function registerCustomer(prevState: string | undefined, formData: FormData) {
    const validatedFields = RegisterSchema.safeParse({
        name: formData.get("name"),
        email: formData.get("email"),
        password: formData.get("password"),
    });

    if (!validatedFields.success) {
        return "Invalid input. Please check your details.";
    }

    const { name, email, password } = validatedFields.data;

    try {
        const existingUser = await db.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            return "Email already in use. Please login instead.";
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await db.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                role: "customer",
            },
        });

        // Attempt sign in after registration (optional, or redirect to login)
        // For simplicity, we'll return success and let UI redirect to login
        return "success";
    } catch (error) {
        console.error("Registration error:", error);
        return `Failed to register: ${(error as Error).message}`;
    }
}

export async function registerTeamMember(prevState: string | undefined, formData: FormData) {
    const validatedFields = RegisterSchema.safeParse({
        name: formData.get("name"),
        email: formData.get("email"),
        password: formData.get("password"),
    });

    if (!validatedFields.success) {
        return "Invalid input. Please check your details.";
    }

    const { name, email, password } = validatedFields.data;
    const role = formData.get("role") as string; // 'admin' or 'user'

    if (role !== "admin" && role !== "user") {
        return "Invalid role selected.";
    }

    try {
        const existingUser = await db.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            return "Email already in use.";
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await db.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                role: role,
            },
        });

        revalidatePath('/settings/users');
        return "success";
    } catch (error) {
        console.error("Registration error:", error);
        return "Failed to register team member.";
    }
}

export async function getUsers() {
    try {
        const users = await db.user.findMany({
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                createdAt: true,
            }
        });
        return users;
    } catch (error) {
        console.error("Failed to fetch users:", error);
        return [];
    }
}
