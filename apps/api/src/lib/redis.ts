import { Redis } from "@upstash/redis";
import { env } from "./env.js";

const config = env();

export const redis = new Redis({
  url: config.UPSTASH_REDIS_REST_URL,
  token: config.UPSTASH_REDIS_REST_TOKEN,
});
