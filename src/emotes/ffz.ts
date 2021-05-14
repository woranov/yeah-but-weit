import { BaseChannelEmote, BaseEmoteList, BaseGlobalEmote } from "./base";
import { formatNumber, pluralize } from "../formatting";
import { CACHE_TTL } from "../config";
import { preferCaseSensitiveFind } from "./common";


const EMOTE_CODE_REGEX = /^(!|\w){3,}$/;


class GlobalEmote extends BaseGlobalEmote {
  get description(): string {
    return "Global FFZ Emote";
  }

  get infoUrl(): string {
    return `https://www.frankerfacez.com/emoticon/${this.id}`;
  }

  imageUrl(preferScale: ImageScale = 3): string {
    let scale: number = this.availableScales.includes(preferScale)
      ? preferScale
      : this.availableScales.sort().reverse()[0];

    if (scale === 3) {
      scale = 4;
    }

    return `https://cdn.frankerfacez.com/emote/${this.id}/${scale}`;
  }
}


class ChannelEmote extends BaseChannelEmote {
  readonly usageCount: number;

  constructor(
    { usageCount, ...rest }: {
      id: number,
      code: string,
      availableScales: AvailableScalesArray,
      creator: Channel,
      usageCount: number,
    },
  ) {
    super(rest);
    this.usageCount = usageCount;
  }

  get description(): string {
    return `FFZ Emote, by @${this.creator.name}, available in ${formatNumber(this.usageCount)} ${pluralize("channel", this.usageCount)}`;
  }

  get infoUrl(): string {
    return `https://www.frankerfacez.com/emoticon/${this.id}`;
  }

  imageUrl(preferScale: ImageScale = 3): string {
    let scale: number = this.availableScales.includes(preferScale)
      ? preferScale
      : this.availableScales.sort().reverse()[0];

    if (scale === 3) {
      scale = 4;
    }

    return `https://cdn.frankerfacez.com/emote/${this.id}/${scale}`;
  }
}


type Emote = GlobalEmote | ChannelEmote;


class EmoteList extends BaseEmoteList<Emote> {
  constructor({ channel, emotes }: { channel: Channel, emotes: Emote[] | null }) {
    super({
      provider: "ffz",
      overviewUrl: `https://www.frankerfacez.com/channel/${channel.name}`,
      emotes,
    });
  }
}


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
          const availableScales = <AvailableScalesArray>(
            [...Object.keys(urls)].map(scale => {
              const scaleNum = parseInt(scale);
              return scaleNum === 4 ? 3 : scaleNum;
            })
          );

          globalEmotes.push(
            new GlobalEmote({ id, code, availableScales }),
          );
        },
      );
    }
    return globalEmotes;
  } else {
    return null;
  }
}


async function listChannel(channel: ChannelWithId): Promise<EmoteList> {
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
    return new EmoteList({
      channel,
      emotes: data.sets[data.room.set.toString()].emoticons.map(
        ({ id, name: code, owner: { name, display_name }, urls, usage_count }: FfzEmoteEntry) => {
          const availableScales = <AvailableScalesArray>(
            [...Object.keys(urls)].map(scale => {
              const scaleNum = parseInt(scale);
              return scaleNum === 4 ? 3 : scaleNum;
            })
          );
          return new ChannelEmote({
            id, code, availableScales, creator: { name, displayName: display_name }, usageCount: usage_count,
          });
        },
      ),
    });
  } else {
    return new EmoteList({ channel, emotes: null });
  }
}


async function findCode(code: string): Promise<ChannelEmote[] | null> {
  const key = `search:ffz:${code.toLowerCase()}`;
  const perPage = 200;
  const maxPages = 2;

  let data = <FfzEmoteEntry[] | null>await EMOTES.get(key, "json");

  if (!data) {
    data = [];
    let error = false;

    for (let pageNum = 1; pageNum < maxPages + 1; pageNum++) {
      const response = await fetch(
        `https://api.frankerfacez.com/v1/emotes?q=${code}&per_page=${perPage}&page=${pageNum}&sensitive=false&sort=count-desc`,
      );
      if (!response.ok) {
        error = true;
        break;
      } else {
        const page = <FfzEmoteSearchResult>await response.json();
        data = [
          ...data,
          ...page.emoticons,
        ];
        if (page._pages === pageNum) {
          break;
        }
      }
    }
    if (!error)
      await EMOTES.put(
        key, JSON.stringify(data), { expirationTtl: CACHE_TTL },
      );
  }
  if (data) {
    const withMatchingCode = data
      .filter(({ name: searchEntryEmoteCode }: FfzEmoteEntry) => searchEntryEmoteCode.toLowerCase() === code.toLowerCase())
      .map(({ id, name: code, owner: { name, display_name }, urls, usage_count }: FfzEmoteEntry) => {
        const availableScales = <AvailableScalesArray>(
          [...Object.keys(urls)].map(scale => {
            const scaleNum = parseInt(scale);
            return scaleNum === 4 ? 3 : scaleNum;
          })
        );
        return new ChannelEmote({
          id, code, availableScales, creator: { name, displayName: display_name }, usageCount: usage_count,
        });
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
  { code, channel = null }: { code: string, channel: ChannelWithId | null },
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
    if (channelEmotes.emotes) {
      emote = channelEmotes.emotes.find(e => e.code.toLowerCase() == code.toLowerCase()) ?? null;
    }
  }
  if (!emote && !channel) {
    const result = await findCode(code);
    if (result && result.length >= 1) {
      emote = preferCaseSensitiveFind(result, code);
    }
  }
  return emote;
}

export { ChannelEmote, GlobalEmote, find, listChannel };
