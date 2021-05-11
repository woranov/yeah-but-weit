import { MEDIUM_CACHE_TTL, SHORT_CACHE_TTL, SUPIBOT_USER_AGENT } from "./config";
import { BaseEmote } from "./emotes";


function originUrl(id: string): string {
  return `https://supinic.com/data/origin/detail/${id}`;
}


async function listOrigins(): Promise<SupibotEmoteOriginEntry[] | null> {
  const key = "list:supibot:origins";

  let data = <SupibotEmoteOriginEntry[] | null>await EMOTES.get(key, "json");

  if (!data) {
    const fetchPromise = fetch("https://supinic.com/api/data/origin/list", {
      headers: {
        "User-Agent": SUPIBOT_USER_AGENT,
      },
    });
    const response = await Promise.race([
      fetchPromise,
      new Promise(resolve => setTimeout(resolve, 5000)),
    ]);

    if (response && (<Response>response).ok) {
      data = (await (<Response>response).json()).data;
      await EMOTES.put(key, JSON.stringify(data), { expirationTtl: MEDIUM_CACHE_TTL });
    } else {
      await EMOTES.put(key, JSON.stringify([]), { expirationTtl: SHORT_CACHE_TTL });
    }
  }

  return data;
}


async function find(emote: BaseEmote): Promise<SupibotEmoteOriginEntry | null> {
  const originList = await listOrigins();

  if (originList) {
    return originList.find(entry => entry.emoteID === emote.id.toString()) ?? null;
  }

  return null;
}


export { originUrl, find };
