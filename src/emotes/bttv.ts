import { BaseChannelEmote } from "./base";
import { formatNumber } from "../formatting";
import { CACHE_TTL, LONG_CACHE_TTL } from "../config";


class Emote extends BaseChannelEmote {
  readonly usageCount: number | null;
  readonly #isShared: boolean | null;

  constructor(
    { usageCount = null, isShared = null, ...rest }: {
      id: string,
      code: string,
      creatorDisplayName: string,
      usageCount?: number | null,
      isShared?: boolean | null,
    },
  ) {
    super(rest);
    this.usageCount = usageCount;
    this.#isShared = isShared;
  }

  get description(): string {
    let description = "BTTV Emote";
    if (this.#isShared !== null) {
      description = `${this.#isShared ? "Shared" : "Channel"} ${description}`;
    }
    description += `, by ${this.creatorDisplayName}`;
    if (this.usageCount !== null) {
      description += `, available in ${formatNumber(this.usageCount)} channels`;
    }
    return description;
  }

  get imageUrl(): string {
    return `https://cdn.betterttv.net/emote/${this.id}/3x`;
  }

  get infoUrl(): string {
    return `https://betterttv.com/emotes/${this.id}`;
  }
}


async function list(channel: Channel): Promise<Emote[] | null> {
  const key = `list:bttv:${channel.id}`;

  let data = <BttvEmoteListResult | null>await EMOTES.get(key, "json");

  if (!data) {
    const response = await fetch(
      `https://api.betterttv.net/3/cached/users/twitch/${channel.id}`,
    );

    if (response.ok) {
      data = <BttvEmoteListResult>await response.json();
      await EMOTES.put(key, JSON.stringify(data), { expirationTtl: CACHE_TTL });
    }
  }

  if (data) {
    return [
      ...data.sharedEmotes.map((
        { id, code, user: { displayName: creatorDisplayName } }: BttvSharedEmoteEntry,
      ) => {
        return new Emote({ id, code, creatorDisplayName, isShared: true });
      }),
      ...data.channelEmotes.map(({ id, code }: BttvChannelEmoteEntry) => {
        return new Emote({ id, code, creatorDisplayName: channel.name, isShared: false });
      }),
    ];
  } else {
    return null;
  }
}


async function listTop(count: number = 4_500): Promise<Emote[]> {
  const key = "list:bttv:top";
  const perPage = 100;
  let emoteData: BttvTrendingEmoteListEntry[] | null = <BttvTrendingEmoteListEntry[] | null>await EMOTES.get(key, "json");

  if (!emoteData) {
    emoteData = [];
    let offset = 0;
    let error = false;

    while (count > 0) {
      const response = await fetch(
        `https://api.betterttv.net/3/emotes/shared/top?offset=${offset}&limit=${perPage}`,
      );
      if (!response.ok) {
        error = true;
        break;
      } else {
        const page = await response.json();
        offset += perPage;
        count -= page.length;
        emoteData.push(...page);
      }
    }
    if (!error)
      await EMOTES.put(
        key, JSON.stringify(emoteData), { expirationTtl: LONG_CACHE_TTL },
      );
  }

  return emoteData.map(e => new Emote({
    id: e.emote.id, code: e.emote.code, creatorDisplayName: e.emote.user.displayName, usageCount: e.total,
  }));
}


async function findCode(code: string, considerOldestN: number = 5): Promise<Emote | null> {
  const key = `search:bttv:${code}`;
  const perPage = 100;
  let emoteData: BttvEmoteSearchResultEntry[] | null = <BttvEmoteSearchResultEntry[] | null>await EMOTES.get(key, "json");

  if (!emoteData) {
    emoteData = [];
    let offset = 0;
    let error = false;

    while (true) {
      const response = await fetch(
        `https://api.betterttv.net/3/emotes/shared/search?query=${code}&offset=${offset}&limit=${perPage}`,
      );
      if (!response.ok) {
        error = true;
        break;
      } else {
        const page = <BttvEmoteSearchResultEntry[]>await response.json();
        emoteData = [
          ...emoteData,
          ...page.filter(
            entry => entry.code.toLowerCase() === code.toLowerCase(),
          ),
        ];
        if (page.length < perPage) {
          break;
        }
        offset += perPage;
      }
    }
    if (!error)
      await EMOTES.put(
        key, JSON.stringify(emoteData), { expirationTtl: CACHE_TTL },
      );
  }
  if (emoteData.length > 0) {
    let currBestEmote: BttvEmoteSearchResultEntry | null = null;
    let currMaxCount = -1;
    for (const emoteEntry of <BttvEmoteSearchResultEntry[]>emoteData.slice(-considerOldestN).reverse()) {
      const response = await fetch(
        `https://api.betterttv.net/3/emotes/${emoteEntry.id}/shared`,
      );
      const count = parseInt(response.headers.get("x-total")!);
      if (count > currMaxCount) {
        currBestEmote = emoteEntry;
        currMaxCount = count;
      }
    }
    return new Emote({
      id: currBestEmote!.id,
      code: currBestEmote!.code,
      creatorDisplayName: currBestEmote!.user.displayName,
      usageCount: currMaxCount,
    });
  }

  return null;
}

// noinspection JSUnusedGlobalSymbols
async function find(
  { code, channel = null }: { code: string, channel: Channel | null },
): Promise<Emote | null> {
  if (channel === null) {
    const trendingEmotes = await listTop();
    let emote = trendingEmotes.find(e => e.code.toLowerCase() == code.toLowerCase()) ?? null;
    if (!emote) {
      emote = await findCode(code);
    }
    if (emote) {
      return emote;
    }
  } else {
    const channelEmotes = await list(channel);
    if (channelEmotes) {
      return channelEmotes.find(e => e.code.toLowerCase() == code.toLowerCase()) ?? null;
    }
  }
  return null;
}

export { Emote, find };
