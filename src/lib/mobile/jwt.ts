import { SignJWT, jwtVerify } from "jose";

// Two tokens, both HS256:
//  - session token: long-lived, signed with AUTH_SECRET, only this server reads it.
//  - PowerSync token: short-lived, signed with the secret shared with the
//    PowerSync instance. It is separate so AUTH_SECRET never leaves this app,
//    and short because PowerSync rejects tokens valid for more than 24 hours.
const SESSION_AUDIENCE = "cpw-mobile";
const SESSION_TTL = "30d";
const POWERSYNC_TTL = "30m";

function sessionKey() {
    const secret = process.env.AUTH_SECRET;
    if (!secret) throw new Error("AUTH_SECRET is not set");
    return new TextEncoder().encode(secret);
}

export interface MobileTokenClaims {
    sub: string;
    role: string;
}

export async function signSessionToken(claims: MobileTokenClaims) {
    return new SignJWT({ role: claims.role })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(claims.sub)
        .setAudience(SESSION_AUDIENCE)
        .setIssuedAt()
        .setExpirationTime(SESSION_TTL)
        .sign(sessionKey());
}

export async function verifySessionToken(token: string): Promise<MobileTokenClaims | null> {
    try {
        const { payload } = await jwtVerify(token, sessionKey(), {
            audience: SESSION_AUDIENCE,
            algorithms: ["HS256"],
        });
        if (!payload.sub) return null;
        return { sub: payload.sub, role: String(payload.role ?? "") };
    } catch {
        return null;
    }
}

export function powerSyncConfig() {
    const url = process.env.POWERSYNC_URL;
    const secret = process.env.POWERSYNC_JWT_SECRET; // base64url, same value as in the PowerSync dashboard
    const kid = process.env.POWERSYNC_JWT_KID;
    if (!url || !secret || !kid) return null;
    return { url, secret, kid };
}

export async function signPowerSyncToken(claims: MobileTokenClaims) {
    const config = powerSyncConfig();
    if (!config) return null;

    const token = await new SignJWT({ role: claims.role })
        .setProtectedHeader({ alg: "HS256", kid: config.kid })
        .setSubject(claims.sub)
        .setAudience(config.url)
        .setIssuedAt()
        .setExpirationTime(POWERSYNC_TTL)
        .sign(Buffer.from(config.secret, "base64url"));

    return { token, url: config.url };
}
