import { MEDIUM_CACHE_TTL, SHORT_CACHE_TTL, SUPIBOT_USER_AGENT } from "./config";
import { BaseEmote } from "./emotes";
import cached from "./caching";


function originUrl(id: string): string {
  return `https://supinic.com/data/origin/detail/${id}`;
}


async function listOrigins(): Promise<SupibotEmoteOriginEntry[] | null> {
  const key = "list:supibot:origins";
  const getCachedPromise = cached<SupibotEmoteOriginEntry[] | null>(
    EMOTES, key,
    async () => {
      const response = await fetch("https://supinic.com/api/data/origin/list", {
        headers: {
          "User-Agent": SUPIBOT_USER_AGENT,
        },
      });

      return response.ok
        ? (await response.json()).data
        : null;
    },
    { expirationTtl: MEDIUM_CACHE_TTL },
  );

  const data = await Promise.race([
    getCachedPromise,
    new Promise(resolve => setTimeout(resolve, 5000)),
  ]);

  if (data) {
    return <SupibotEmoteOriginEntry[]>data;
  } else {
    await EMOTES.put(key, JSON.stringify([]), { expirationTtl: SHORT_CACHE_TTL });
    return [];
  }
}


async function find(emote: BaseEmote): Promise<SupibotEmoteOriginEntry | null> {
  const originList = await listOrigins();

  if (originList) {
    return originList.find(entry => entry.emoteID === emote.id.toString()) ?? null;
  }

  return null;
}


export { originUrl, find };
