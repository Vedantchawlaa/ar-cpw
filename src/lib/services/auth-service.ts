import bcrypt from "bcrypt";
import db from "@/lib/db";

/** Checks an email/password pair against the User table. Returns the user without its password hash. */
export async function verifyCredentials(email: string, password: string) {
    const user = await db.user.findUnique({ where: { email } });
    if (!user) return null;

    const passwordsMatch = await bcrypt.compare(password, user.password);
    if (!passwordsMatch) return null;

    return { id: user.id, name: user.name, email: user.email, role: user.role };
}
