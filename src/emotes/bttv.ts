import { BaseChannelEmote, BaseGlobalEmote } from "./base";
import { formatNumber, pluralize } from "../formatting";
import { CACHE_TTL, LONG_CACHE_TTL } from "../config";
import { preferCaseSensitiveFind } from "./common";


const EMOTE_CODE_REGEX = /^(\w{3,}|:\w+:)$/;


class GlobalEmote extends BaseGlobalEmote {
  get description(): string {
    return "Global BTTV Emote";
  }

  get imageUrl(): string {
    return `https://cdn.betterttv.net/emote/${this.id}/3x`;
  }

  get infoUrl(): string {
    return `https://betterttv.com/emotes/${this.id}`;
  }
}


class ChannelEmote extends BaseChannelEmote {
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
      description += `, available in ${formatNumber(this.usageCount)} ${pluralize("channel", this.usageCount)}`;
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


type Emote = GlobalEmote | ChannelEmote;


async function fetchUsageCount(emoteId: string): Promise<number> {
  const response = await fetch(
    `https://api.betterttv.net/3/emotes/${emoteId}/shared`,
  );
  return parseInt(response.headers.get("x-total")!);
}


async function listGlobal(): Promise<GlobalEmote[] | null> {
  const key = `list:bttv:global`;

  let data = <BttvEmoteEntry[] | null>await EMOTES.get(key, "json");

  if (!data) {
    const response = await fetch(
      "https://api.betterttv.net/3/cached/emotes/global",
    );

    if (response.ok) {
      data = <BttvEmoteEntry[]>await response.json();
      await EMOTES.put(key, JSON.stringify(data), { expirationTtl: CACHE_TTL });
    }
  }

  if (data) {
    return data.map(e => new GlobalEmote({ id: e.id, code: e.code }));
  } else {
    return null;
  }
}


async function listChannel(channel: Channel): Promise<ChannelEmote[] | null> {
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
        return new ChannelEmote({ id, code, creatorDisplayName, isShared: true });
      }),
      ...data.channelEmotes.map(({ id, code }: BttvChannelEmoteEntry) => {
        return new ChannelEmote({ id, code, creatorDisplayName: channel.name, isShared: false });
      }),
    ];
  } else {
    return null;
  }
}


async function listTop({ count = 4_500, force = false }: {
  count?: number, force?: boolean
}): Promise<ChannelEmote[]> {
  const key = "list:bttv:top";
  const perPage = 100;
  let emoteData = force
    ? null
    : <BttvTrendingEmoteListEntry[] | null>await EMOTES.get(key, "json");

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

  return emoteData.map(e => new ChannelEmote({
    id: e.emote.id, code: e.emote.code, creatorDisplayName: e.emote.user.displayName, usageCount: e.total + 1,
  }));
}


async function findCode(code: string, considerOldestN: number = 5): Promise<ChannelEmote | null> {
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
    const entriesWithUsageCount = await Promise.all(
      (<BttvEmoteSearchResultEntry[]>emoteData
        .slice(-considerOldestN))
        .map(async entry => {
          return { entry, code: entry.code, usageCount: await fetchUsageCount(entry.id) };
        }),
    );
    const sortedByUsage = entriesWithUsageCount
      .sort((a, b) => b.usageCount - a.usageCount);

    const bestResult = preferCaseSensitiveFind(sortedByUsage, code);

    if (bestResult) {
      const { entry, usageCount } = bestResult;
      return new ChannelEmote({
        id: entry.id,
        code: entry.code,
        creatorDisplayName: entry.user.displayName,
        usageCount: usageCount + 1,
      });
    }
  }

  return null;
}

// noinspection JSUnusedGlobalSymbols, DuplicatedCode
async function find(
  { code, channel = null }: { code: string, channel: Channel | null },
): Promise<Emote | null> {
  if (!EMOTE_CODE_REGEX.test(code)) {
    return null;
  }

  let emote = null;
  {
    const globalEmotes = await listGlobal();
    if (globalEmotes) {
      emote = preferCaseSensitiveFind(globalEmotes, code);
    }
  }
  if (!emote && channel) {
    const channelEmotes = await listChannel(channel);
    if (channelEmotes) {
      emote = preferCaseSensitiveFind(channelEmotes, code);
    }
  }
  if (!emote) {
    const trendingEmotes = await listTop({});
    emote = preferCaseSensitiveFind(trendingEmotes, code);
    if (!emote) {
      emote = await findCode(code);
    }
  }
  return emote;
}

export { ChannelEmote, GlobalEmote, find, listTop };
