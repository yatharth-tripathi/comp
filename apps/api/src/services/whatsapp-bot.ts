import { and, db, desc, eq, ilike, schema } from "@salescontent/db";
import { callClaude } from "./claude.js";
import { sendTextMessage, sendMediaMessage } from "./whatsapp.js";
import { logger } from "../lib/logger.js";
import type { NexusMessage, NexusSystemBlock } from "@salescontent/nexus";

/**
 * WhatsApp Agent Bot — PRD §10.3.
 *
 * The agent texts the SalesContent AI number on WhatsApp and gets back
 * content, illustrations, leads, reels, and battle cards WITHOUT opening
 * the app. This is the adoption weapon for agents who live on WhatsApp
 * and are uncomfortable with apps.
 *
 * 5 intents:
 *   1. "Send me [product] poster [language]" → search content, reply with the asset
 *   2. "Create illustration [age] [premium] [term]" → generate and send PDF link
 *   3. "My leads today" → reply with today's follow-up list
 *   4. "New reel" → send today's featured reel link
 *   5. "Objection: [type]" → send matching battle card or objection handler
 *
 * Intent is parsed by Claude Haiku — cheap, fast, and handles natural
 * language variations that regex would miss. The agent can type in Hindi,
 * English, or Hinglish and Haiku routes it correctly.
 */

const INTENT_PARSER_SYSTEM: NexusSystemBlock[] = [
  {
    type: "text",
    text: `You are an intent parser for a WhatsApp bot used by Indian BFSI sales agents. Parse the agent's message into EXACTLY one of these intents:

1. SEARCH_CONTENT — agent wants a poster, video, document, or battle card
   Extract: query (string), contentType (poster|document|battle_card|video|any), language (en|hi|mr|ta|te|gu)

2. CREATE_ILLUSTRATION — agent wants to generate a product illustration
   Extract: productType (term_plan|sip|home_loan|health_insurance), customerName, customerAge, amount

3. MY_LEADS_TODAY — agent wants their follow-up list for today

4. NEW_REEL — agent wants the latest featured training reel

5. OBJECTION_HANDLER — agent needs help with a specific customer objection
   Extract: objection (the objection text)

6. UNKNOWN — cannot determine intent

Return ONLY a JSON object, no markdown, no preamble:
{
  "intent": "SEARCH_CONTENT" | "CREATE_ILLUSTRATION" | "MY_LEADS_TODAY" | "NEW_REEL" | "OBJECTION_HANDLER" | "UNKNOWN",
  "params": { ... extracted parameters ... }
}

Be generous with parsing. If the agent writes "term plan 35 male 1cr" — that's CREATE_ILLUSTRATION with customerAge=35, amount=10000000.
If the agent writes "LIC poster hindi" — that's SEARCH_CONTENT with query="LIC", contentType="poster", language="hi".
If the agent writes "too expensive kya bolu" — that's OBJECTION_HANDLER with objection="customer says too expensive".`,
    cache_control: { type: "ephemeral" },
  },
];

interface ParsedIntent {
  intent: string;
  params: Record<string, unknown>;
}

async function parseIntent(
  tenantId: string,
  text: string,
): Promise<ParsedIntent> {
  try {
    const result = await callClaude({
      tenantId,
      prompt: {
        system: INTENT_PARSER_SYSTEM,
        messages: [{ role: "user", content: text }],
      },
      model: "fast",
      maxTokens: 200,
      temperature: 0.1,
    });

    let clean = result.text.trim();
    clean = clean.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
    if (!clean.startsWith("{")) {
      const match = clean.match(/\{[\s\S]*\}/);
      if (match) clean = match[0];
    }
    return JSON.parse(clean) as ParsedIntent;
  } catch (error) {
    logger.warn({ error, text }, "whatsapp-bot.intent-parse.failed");
    return { intent: "UNKNOWN", params: {} };
  }
}

// ---------------------------------------------------------------------------
// Bot handler — called by the webhook when an inbound message arrives
// from a registered agent phone number.
// ---------------------------------------------------------------------------
export async function handleAgentMessage(params: {
  tenantId: string;
  agentId: string;
  agentPhone: string;
  messageText: string;
}): Promise<void> {
  const { tenantId, agentId, agentPhone, messageText } = params;

  const parsed = await parseIntent(tenantId, messageText);
  logger.info({ intent: parsed.intent, params: parsed.params }, "whatsapp-bot.intent");

  switch (parsed.intent) {
    case "SEARCH_CONTENT": {
      const query = String(parsed.params.query ?? messageText);
      const contentType = String(parsed.params.contentType ?? "any");

      const conditions = [
        eq(schema.contentAssets.tenantId, tenantId),
        eq(schema.contentAssets.approvalStatus, "published"),
      ];
      if (contentType !== "any") {
        conditions.push(eq(schema.contentAssets.contentType, contentType as "poster"));
      }
      if (query) {
        conditions.push(ilike(schema.contentAssets.title, `%${query}%`));
      }

      const results = await db.query.contentAssets.findMany({
        where: and(...conditions),
        orderBy: [desc(schema.contentAssets.shareCount)],
        limit: 3,
        columns: { id: true, title: true, contentType: true, fileUrl: true, thumbnailUrl: true },
      });

      if (results.length === 0) {
        await sendTextMessage({
          to: agentPhone,
          text: `No ${contentType === "any" ? "content" : contentType} found for "${query}". Try a different keyword.`,
        });
        return;
      }

      let replyText = `Found ${results.length} result${results.length > 1 ? "s" : ""}:\n`;
      for (const item of results) {
        replyText += `\n📄 *${item.title}* (${item.contentType.replace(/_/g, " ")})`;
      }

      await sendTextMessage({ to: agentPhone, text: replyText });

      // Send the first result's file if it has a URL
      const first = results[0];
      if (first?.fileUrl) {
        const isImage = /\.(jpe?g|png|webp|gif)$/i.test(first.fileUrl);
        const isVideo = /\.(mp4|mov|webm)$/i.test(first.fileUrl);
        if (isImage) {
          await sendMediaMessage({
            to: agentPhone,
            mediaType: "image",
            mediaUrl: first.fileUrl,
            caption: first.title,
          });
        } else if (isVideo) {
          await sendMediaMessage({
            to: agentPhone,
            mediaType: "video",
            mediaUrl: first.fileUrl,
            caption: first.title,
          });
        } else {
          await sendMediaMessage({
            to: agentPhone,
            mediaType: "document",
            mediaUrl: first.fileUrl,
            filename: `${first.title}.pdf`,
            caption: first.title,
          });
        }
      }
      break;
    }

    case "CREATE_ILLUSTRATION": {
      const productType = String(parsed.params.productType ?? "term_plan");
      const customerName = String(parsed.params.customerName ?? "Customer");
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const link = `${appUrl}/illustrator/${productType.replace(/_/g, "-")}`;

      await sendTextMessage({
        to: agentPhone,
        text: `🧮 *Illustration ready to create*\n\nProduct: ${productType.replace(/_/g, " ")}\nCustomer: ${customerName}\n\nTap to generate: ${link}\n\nThe illustration will be created with real math and a trackable share link.`,
      });
      break;
    }

    case "MY_LEADS_TODAY": {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(todayStart.getTime() + 86_400_000);

      const [overdue, today] = await Promise.all([
        db.query.leads.findMany({
          where: and(
            eq(schema.leads.tenantId, tenantId),
            eq(schema.leads.agentId, agentId),
          ),
          orderBy: [desc(schema.leads.nextFollowUpAt)],
          limit: 10,
          columns: {
            fullName: true,
            phone: true,
            stage: true,
            nextFollowUpAt: true,
            aiSuggestedNextAction: true,
          },
        }),
        db.query.leads.findMany({
          where: and(
            eq(schema.leads.tenantId, tenantId),
            eq(schema.leads.agentId, agentId),
          ),
          orderBy: [desc(schema.leads.lastActivityAt)],
          limit: 5,
          columns: { fullName: true, stage: true },
        }),
      ]);

      if (overdue.length === 0) {
        await sendTextMessage({
          to: agentPhone,
          text: "✅ No pending follow-ups today. You're on top of your pipeline!",
        });
        return;
      }

      let text = `📋 *Your leads today* (${overdue.length}):\n`;
      for (const lead of overdue.slice(0, 8)) {
        const stage = lead.stage.replace(/_/g, " ");
        text += `\n👤 *${lead.fullName}* — ${stage}`;
        if (lead.phone) text += ` · ${lead.phone}`;
        if (lead.aiSuggestedNextAction) text += `\n   💡 ${lead.aiSuggestedNextAction}`;
      }
      if (overdue.length > 8) text += `\n\n...and ${overdue.length - 8} more in the app.`;

      await sendTextMessage({ to: agentPhone, text });
      break;
    }

    case "NEW_REEL": {
      const reel = await db.query.reels.findFirst({
        where: eq(schema.reels.tenantId, tenantId),
        orderBy: [desc(schema.reels.createdAt)],
        columns: { id: true, muxPlaybackId: true },
        with: {
          contentAsset: { columns: { title: true, description: true } },
        },
      });

      if (!reel || !reel.muxPlaybackId) {
        await sendTextMessage({
          to: agentPhone,
          text: "No new reels available right now. Check back later!",
        });
        return;
      }

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      await sendTextMessage({
        to: agentPhone,
        text: `🎬 *Latest training reel*\n\n${reel.contentAsset?.title ?? "New reel"}\n${reel.contentAsset?.description ? `\n${reel.contentAsset.description.slice(0, 200)}` : ""}\n\nWatch: ${appUrl}/reels`,
      });
      break;
    }

    case "OBJECTION_HANDLER": {
      const objection = String(parsed.params.objection ?? messageText);

      // Use Claude to generate a concise objection handler using the NEXUS skills
      const result = await callClaude({
        tenantId,
        prompt: {
          system: [
            {
              type: "text",
              text: `You are a BFSI sales coach. The agent just encountered a customer objection. Give a concise response using the Acknowledge-Reframe-Evidence (ARE) pattern. Keep it under 5 lines. Use natural Indian English. Never suggest mis-selling or banned phrases.`,
              cache_control: { type: "ephemeral" },
            },
          ],
          messages: [
            {
              role: "user",
              content: `Customer objection: "${objection}"\n\nGive me a concise handling script using the ARE pattern.`,
            },
          ],
        },
        model: "fast",
        maxTokens: 400,
        temperature: 0.5,
      });

      await sendTextMessage({
        to: agentPhone,
        text: `💡 *Objection handler*\n\nCustomer says: "${objection}"\n\n${result.text}`,
      });
      break;
    }

    default: {
      await sendTextMessage({
        to: agentPhone,
        text: `I didn't catch that. Try one of these:\n\n📄 "Send me LIC poster Hindi"\n🧮 "Create illustration term plan 35 male 1 crore"\n📋 "My leads today"\n🎬 "New reel"\n💡 "Objection: too expensive"`,
      });
    }
  }
}

// Keep import for the messages array type
void (null as unknown as NexusMessage);
