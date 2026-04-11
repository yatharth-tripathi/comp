import { customAlphabet } from "nanoid";
import { and, db, eq, schema } from "@salescontent/db";

/**
 * Short-code generator for trackable share links.
 *
 * Alphabet excludes `0`, `O`, `I`, `l`, `1` to reduce OCR/voice confusion —
 * these codes show up in WhatsApp messages and occasionally need to be
 * reread by humans.
 *
 * 10 chars × 56-char alphabet ≈ 1.7 × 10^17 combinations → zero realistic
 * collision risk for years.
 */
const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const nanoid = customAlphabet(alphabet, 10);

export function generateShortCode(): string {
  return nanoid();
}

/**
 * Generate a short code that is guaranteed unique against both
 * `content_share_events.shortCode` and `illustrations.shortCode`.
 * Retries up to 5 times on the astronomically-rare collision.
 */
export async function generateUniqueShortCode(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateShortCode();
    const shareCollision = await db.query.contentShareEvents.findFirst({
      where: eq(schema.contentShareEvents.shortCode, code),
      columns: { id: true },
    });
    if (shareCollision) continue;
    const illustrationCollision = await db.query.illustrations.findFirst({
      where: eq(schema.illustrations.shortCode, code),
      columns: { id: true },
    });
    if (illustrationCollision) continue;
    return code;
  }
  throw new Error("Failed to generate a unique short code after 5 attempts");
}

/**
 * Resolve a short code back to its underlying resource. Used by the public
 * /s/:shortCode redirect route. Returns null if not found.
 */
export async function resolveShortCode(shortCode: string): Promise<
  | {
      kind: "content_share";
      shareEventId: string;
      tenantId: string;
      resourceKind: string;
      resourceId: string;
      resourceTitle: string;
      contentAssetId: string | null;
    }
  | {
      kind: "illustration";
      illustrationId: string;
      tenantId: string;
      agentId: string;
      productType: string;
      renderedUrl: string | null;
    }
  | null
> {
  // Content share — primary path
  const share = await db.query.contentShareEvents.findFirst({
    where: eq(schema.contentShareEvents.shortCode, shortCode),
    columns: {
      id: true,
      tenantId: true,
      resourceKind: true,
      resourceId: true,
      resourceTitle: true,
      contentAssetId: true,
    },
  });
  if (share) {
    return {
      kind: "content_share",
      shareEventId: share.id,
      tenantId: share.tenantId,
      resourceKind: share.resourceKind,
      resourceId: share.resourceId,
      resourceTitle: share.resourceTitle,
      contentAssetId: share.contentAssetId,
    };
  }

  // Illustration share — secondary path
  const illustration = await db.query.illustrations.findFirst({
    where: eq(schema.illustrations.shortCode, shortCode),
    columns: {
      id: true,
      tenantId: true,
      agentId: true,
      productType: true,
      renderedUrl: true,
    },
  });
  if (illustration) {
    return {
      kind: "illustration",
      illustrationId: illustration.id,
      tenantId: illustration.tenantId,
      agentId: illustration.agentId,
      productType: illustration.productType,
      renderedUrl: illustration.renderedUrl,
    };
  }

  return null;
}

// Keep `and` imported for use when we extend this with tenant-scoped lookups
void and;
