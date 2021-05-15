import { BaseChannelEmote, BaseEmoteList, BaseGlobalEmote } from "./base";
import { formatNumber, pluralize } from "../formatting";
import { CACHE_TTL, LONG_CACHE_TTL, MEDIUM_CACHE_TTL } from "../config";
import { preferCaseSensitiveFind } from "./common";
import cached from "../caching";


const EMOTE_CODE_REGEX = /^(\w{3,}|:\w+:)$/;


class GlobalEmote extends BaseGlobalEmote {
  constructor({ ...args }: {
    id: number | string,  // TODO: why is this `number | string`?
    code: string,
  }) {
    super({ ...args, availableScales: [1, 2, 3] });
  }

  get description(): string {
    return "Global BTTV Emote";
  }

  get infoUrl(): string {
    return `https://betterttv.com/emotes/${this.id}`;
  }

  imageUrl(preferScale: ImageScale = 3): string {
    return `https://cdn.betterttv.net/emote/${this.id}/${preferScale}x`;
  }
}


class ChannelEmote extends BaseChannelEmote {
  usageCount: number | null;
  readonly isShared: boolean | null;

  constructor(
    { usageCount = null, isShared = null, ...rest }: {
      id: string,
      code: string,
      creator: ChannelWithId,
      usageCount?: number | null,
      isShared?: boolean | null,
    },
  ) {
    super({ availableScales: [1, 2, 3], ...rest });
    this.usageCount = usageCount;
    this.isShared = isShared;
  }

  get description(): string {
    let description = "BTTV Emote";
    if (this.isShared !== null) {
      description = `${this.isShared ? "Shared" : "Channel"} ${description}`;
    }
    description += `, by @${this.creator.name}`;
    if (this.usageCount !== null) {
      description += `, available in ${formatNumber(this.usageCount)} ${pluralize("channel", this.usageCount)}`;
    }
    return description;
  }

  get infoUrl(): string {
    return `https://betterttv.com/emotes/${this.id}`;
  }

  imageUrl(preferScale: ImageScale = 3): string {
    return `https://cdn.betterttv.net/emote/${this.id}/${preferScale}x`;
  }
}


type Emote = GlobalEmote | ChannelEmote;


class EmoteList extends BaseEmoteList<Emote> {
  constructor({ bttvChannelId, emotes }: { bttvChannelId: string, emotes: Emote[] | null }) {
    super({
      provider: "bttv",
      overviewUrl: `https://betterttv.com/users/${bttvChannelId}`,
      emotes,
    });
  }
}


async function fetchUsageCount(emoteId: string): Promise<number> {
  const data = await cached<string>(
    EMOTES, `count:bttv:${emoteId}`,
    async () => {
      const response = await fetch(
        `https://api.betterttv.net/3/emotes/${emoteId}/shared`,
      );
      return response.headers.get("x-total")!;
    },
    { type: "text", expirationTtl: MEDIUM_CACHE_TTL },
  );

  return parseInt(data) + 1;
}


async function listGlobal(): Promise<GlobalEmote[] | null> {
  const data = await cached<BttvEmoteEntry[] | null>(
    EMOTES, `list:bttv:global`,
    async () => {
      const response = await fetch(
        "https://api.betterttv.net/3/cached/emotes/global",
      );

      return response.ok
        ? <BttvEmoteEntry[]>await response.json()
        : null;
    },
    { expirationTtl: CACHE_TTL },
  );

  if (data) {
    return data.map(e => new GlobalEmote({ id: e.id, code: e.code }));
  } else {
    return null;
  }
}


async function listChannel(channel: ChannelWithId): Promise<EmoteList> {
  const data = await cached<BttvEmoteListResult | null>(
    EMOTES, `list:bttv:${channel.id}`,
    async () => {
      const response = await fetch(
        `https://api.betterttv.net/3/cached/users/twitch/${channel.id}`,
      );

      return response.ok
        ? <BttvEmoteListResult>await response.json()
        : null;
    },
    { expirationTtl: CACHE_TTL },
  );

  if (data) {
    return new EmoteList({
      bttvChannelId: data.id, emotes: [
        ...data.sharedEmotes.map((
          {
            id,
            code,
            user: { providerId: creatorId, name: creatorName, displayName: creatorDisplayName },
          }: BttvSharedEmoteEntry,
        ) => {
          return new ChannelEmote({
            id,
            code,
            creator: { id: parseInt(creatorId), name: creatorName, displayName: creatorDisplayName },
            isShared: true,
          });
        }),
        ...data.channelEmotes.map(({ id, code }: BttvChannelEmoteEntry) => {
          return new ChannelEmote({
            id, code, creator: channel, isShared: false,
          });
        }),
      ],
    });
  } else {
    return new EmoteList({ bttvChannelId: "dank", emotes: null });
  }
}


async function listTop({ count = 4_500, force = false }: {
  count?: number, force?: boolean
}): Promise<ChannelEmote[]> {
  const data = await cached<BttvTrendingEmoteListEntry[] | null>(
    EMOTES, "list:bttv:top",
    async () => {
      const perPage = 100;
      const emoteData: BttvTrendingEmoteListEntry[] = [];
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
      return error
        ? null
        : emoteData;
    },
    { forceRefresh: force, expirationTtl: LONG_CACHE_TTL },
  ) ?? [];

  return data.map(e => new ChannelEmote({
    id: e.emote.id,
    code: e.emote.code,
    creator: {
      id: parseInt(e.emote.user.providerId),
      name: e.emote.user.name,
      displayName: e.emote.user.displayName,
    },
    usageCount: e.total,
  }));
}


async function findCode(code: string, considerOldestN: number = 5): Promise<ChannelEmote | null> {
  const data = await cached<BttvEmoteSearchResultEntry[] | null>(
    EMOTES, `search:bttv:${code}`,
    async () => {
      const perPage = 100;
      let emoteData: BttvEmoteSearchResultEntry[] = [];
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
      return error
        ? null
        : emoteData;
    },
    { expirationTtl: CACHE_TTL },
  ) ?? [];

  if (data.length > 0) {
    const entriesWithUsageCount = await Promise.all(
      (<BttvEmoteSearchResultEntry[]>data
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
        creator: {
          id: parseInt(entry.user.providerId),
          name: entry.user.name,
          displayName: entry.user.displayName,
        },
        usageCount: usageCount,
      });
    }
  }

  return null;
}

// noinspection JSUnusedGlobalSymbols, DuplicatedCode
async function find(
  { code, channel = null }: { code: string, channel: ChannelWithId | null },
): Promise<Emote | null> {
  if (!EMOTE_CODE_REGEX.test(code)) {
    return null;
  }

  let emote: Emote | null = null;
  {
    const globalEmotes = await listGlobal();
    if (globalEmotes) {
      emote = preferCaseSensitiveFind(globalEmotes, code);
    }
  }
  if (!emote && channel) {
    const channelEmotes = await listChannel(channel);
    if (channelEmotes.emotes) {
      emote = preferCaseSensitiveFind(channelEmotes.emotes, code);
    }
  }
  if (!emote && !channel) {
    const trendingEmotes = await listTop({});
    emote = preferCaseSensitiveFind(trendingEmotes, code);
    if (!emote) {
      emote = await findCode(code);
    }
  }
  if (emote instanceof ChannelEmote && emote.usageCount === null) {
    emote.usageCount = await fetchUsageCount(emote.id.toString());
  }

  return emote;
}

export { ChannelEmote, GlobalEmote, find, listTop, listChannel };
