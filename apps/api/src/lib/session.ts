import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { env } from "./env.js";

export interface SessionPayload {
  userId: string;
  tenantId: string;
  role: string;
}

function secretKey(): Uint8Array {
  return new TextEncoder().encode(env().JWT_SECRET);
}

export async function issueSessionToken(payload: SessionPayload): Promise<string> {
  const config = env();
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + config.JWT_EXPIRES_IN_SECONDS)
    .setSubject(payload.userId)
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload> {
  const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
  const { userId, tenantId, role } = payload as Record<string, unknown>;
  if (typeof userId !== "string" || typeof tenantId !== "string" || typeof role !== "string") {
    throw new Error("Session token payload is malformed");
  }
  return { userId, tenantId, role };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, env().BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
