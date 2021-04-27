import { BaseChannelEmote, BaseGlobalEmote } from "./base";
import { formatNumber } from "../formatting";
import { CACHE_TTL } from "../config";


class GlobalEmote extends BaseGlobalEmote {
  readonly #maxScale: number;

  constructor(
    { maxScale, ...rest }: {
      id: number,
      code: string,
      maxScale: number,
    },
  ) {
    super(rest);
    this.#maxScale = maxScale;
  }

  get description(): string {
    return "Global FFZ Emote";
  }

  get imageUrl(): string {
    return `https://cdn.frankerfacez.com/emote/${this.id}/${this.#maxScale}`;
  }

  get infoUrl(): string {
    return `https://www.frankerfacez.com/emoticon/${this.id}`;
  }
}


class ChannelEmote extends BaseChannelEmote {
  readonly usageCount: number;
  readonly #maxScale: number;

  constructor(
    { usageCount, maxScale, ...rest }: {
      id: number,
      code: string,
      creatorDisplayName: string,
      usageCount: number,
      maxScale: number,
    },
  ) {
    super(rest);
    this.usageCount = usageCount;
    this.#maxScale = maxScale;
  }

  get description(): string {
    return `FFZ Emote, by ${this.creatorDisplayName}, available in ${formatNumber(this.usageCount)} channels`;
  }

  get imageUrl(): string {
    return `https://cdn.frankerfacez.com/emote/${this.id}/${this.#maxScale}`;
  }

  get infoUrl(): string {
    return `https://www.frankerfacez.com/emoticon/${this.id}`;
  }
}


type Emote = GlobalEmote | ChannelEmote;

async function listGlobal(): Promise<GlobalEmote[] | null> {
  const key = `list:ffz:global`;

  let data = <FfzGlobalEmoteListResult | null>await EMOTES.get(key, "json");

  if (!data) {
    const response = await fetch(
      "https://api.frankerfacez.com/v1/set/global",
    );
    if (response.ok) {
      data = <FfzGlobalEmoteListResult>await response.json();
      await EMOTES.put(key, JSON.stringify(data), { expirationTtl: CACHE_TTL });
    }
  }
  if (data) {
    const globalEmotes: GlobalEmote[] = [];
    for (const setId of [...data.default_sets, ...Object.keys(data.users)]) {
      data.sets[setId.toString()].emoticons.map(
        ({ id, name: code, urls }: FfzEmoteEntry) => {
          const maxScale = Math.max(
            ...Object.keys(urls).map(scale => parseInt(scale)),
          );
          globalEmotes.push(
            new GlobalEmote({ id, code, maxScale }),
          );
        },
      );
    }
    return globalEmotes;
  } else {
    return null;
  }
}


async function listChannel(channel: Channel): Promise<ChannelEmote[] | null> {
  const key = `list:ffz:${channel.id}`;

  let data = <FfzEmoteListResult | null>await EMOTES.get(key, "json");

  if (!data) {
    const response = await fetch(
      `https://api.frankerfacez.com/v1/room/id/${channel.id}`,
    );
    if (response.ok) {
      data = <FfzEmoteListResult>await response.json();
      await EMOTES.put(key, JSON.stringify(data), { expirationTtl: CACHE_TTL });
    }
  }
  if (data) {
    return data.sets[data.room.set.toString()].emoticons.map(
      ({ id, name: code, owner: { display_name }, urls, usage_count }: FfzEmoteEntry) => {
        const maxScale = Math.max(
          ...Object.keys(urls).map(scale => parseInt(scale)),
        );
        return new ChannelEmote({ id, code, creatorDisplayName: display_name, maxScale, usageCount: usage_count });
      },
    );
  } else {
    return null;
  }
}


async function findCode(code: string): Promise<ChannelEmote[] | null> {
  const key = `search:ffz:${code.toLowerCase()}`;

  let data = <FfzEmoteSearchResult | null>await EMOTES.get(key, "json");

  if (!data) {
    const response = await fetch(
      `https://api.frankerfacez.com/v1/emotes?q=${code}&sensitive=false&sort=count-desc`,
    );
    if (response.ok) {
      data = await response.json();
      await EMOTES.put(key, JSON.stringify(data), { expirationTtl: CACHE_TTL });
    }
  }
  if (data) {
    const withMatchingCode = data.emoticons
      .filter(({ name: searchEntryEmoteCode }: FfzEmoteEntry) => searchEntryEmoteCode.toLowerCase() === code.toLowerCase())
      .map(({ id, name: code, owner: { display_name }, urls, usage_count }: FfzEmoteEntry) => {
        const maxScale = Math.max(
          ...Object.keys(urls).map(scale => parseInt(scale)),
        );
        return new ChannelEmote({ id, code, creatorDisplayName: display_name, maxScale, usageCount: usage_count });
      });
    if (withMatchingCode.length >= 1) {
      return withMatchingCode;
    } else {
      return null;
    }
  } else {
    return null;
  }
}


// noinspection JSUnusedGlobalSymbols, DuplicatedCode
async function find(
  { code, channel = null }: { code: string, channel: Channel | null },
): Promise<Emote | null> {
  let emote = null;
  {
    const globalEmotes = await listGlobal();
    if (globalEmotes) {
      emote = globalEmotes.find(e => e.code.toLowerCase() == code.toLowerCase()) ?? null;
    }
  }
  if (!emote && channel) {
    const channelEmotes = await listChannel(channel);
    if (channelEmotes) {
      emote = channelEmotes.find(e => e.code.toLowerCase() == code.toLowerCase()) ?? null;
    }
  }
  if (!emote) {
    const result = await findCode(code);
    if (result && result.length >= 1) {
      const candidateEmote = result[0];
      if (candidateEmote.code.toLowerCase() == code.toLowerCase()) {
        emote = candidateEmote;
      }
    }
  }
  return emote;
}

export { ChannelEmote, GlobalEmote, find };
