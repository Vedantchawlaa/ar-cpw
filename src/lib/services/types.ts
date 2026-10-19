// The authenticated caller of a service function. Server actions build it
// from the NextAuth session, /api/mobile routes from the mobile JWT.
export interface Actor {
    id: string;
    role: string; // admin | user | customer
    email?: string | null;
}

export const isAdmin = (actor: Actor) => actor.role === "admin";
export const isStaff = (actor: Actor) => actor.role === "admin" || actor.role === "user";

/** Builds an Actor from a NextAuth session user. */
export function toActor(user: { id?: string | null; email?: string | null }): Actor {
    return { id: user.id as string, role: (user as any).role, email: user.email };
}
