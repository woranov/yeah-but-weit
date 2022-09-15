import { BaseChannelEmote, BaseEmoteList, BaseGlobalEmote } from "./base";
import { formatNumber, pluralize } from "../formatting";
import cached from "../caching";
import { CACHE_TTL } from "../config";
import { preferCaseSensitiveFind } from "./common";


const GQL_ENDPOINT = "https://api.7tv.app/v2/gql";
// https://github.com/SevenTV/ServerGo/blob/255eff66afeec6159331d67e25b723f29b0e69dd/src/validation/validation.go#L6
const EMOTE_CODE_REGEX = /^[-_A-Za-z():0-9]{2,100}$/;


const VISIBILITY_BITFLAG_POSITIONS = {
  PRIVATE: 1,
  GLOBAL: 2,
  HIDDEN: 3,
  OVERRIDE_BTTV: 4,
  OVERRIDE_FFZ: 5,
  OVERRIDE_TWITCH_GLOBAL: 6,
  OVERRIDE_TWITCH_SUBSCRIBER: 7,
} as const;


function checkBitFlag(flagSum: number, bit: number): boolean {
  return (flagSum & bit) === bit;
}


class GlobalEmote extends BaseGlobalEmote {
  constructor({ ...args }: {
    id: string,
    code: string,
  }) {
    super({ ...args, availableScales: [1, 2, 3, 4] });
  }

  get description(): string {
    return "Global 7TV Emote";
  }

  get infoUrl(): string {
    return `https://7tv.app/emotes/${this.id}`;
  }

  imageUrl(preferScale: ImageScale = 4): string {
    let scale: number = this.availableScales.includes(preferScale)
      ? preferScale
      : this.availableScales.sort().reverse()[0];

    return `https://cdn.7tv.app/emote/${this.id}/${scale}x`;
  }
}


class ChannelEmote extends BaseChannelEmote {
  usageCount: number;
  readonly visibility: number;

  constructor(
    { usageCount, visibility, ...rest }: {
      id: string,
      code: string,
      creator: ChannelWithId,
      usageCount: number,
      visibility: number,
    },
  ) {
    super({ availableScales: [1, 2, 3, 4], ...rest });
    this.usageCount = usageCount;
    this.visibility = visibility;
  }

  get description(): string {
    let description = "7TV Emote";
    if (this.visibility !== 0) {
      if (checkBitFlag(this.visibility, VISIBILITY_BITFLAG_POSITIONS.PRIVATE)) {
        description = `Private ${description}`;
      }
      if (checkBitFlag(this.visibility, VISIBILITY_BITFLAG_POSITIONS.HIDDEN)) {
        description = `Hidden ${description}`;
      }
    }
    description += `, by @${this.creator.name}`;
    if (this.usageCount !== null) {
      description += `, available in ${formatNumber(this.usageCount)} ${pluralize("channel", this.usageCount)}`;
    }
    return description;
  }

  get infoUrl(): string {
    return `https://7tv.app/emotes/${this.id}`;
  }

  imageUrl(preferScale: ImageScale = 4): string {
    let scale: number = this.availableScales.includes(preferScale)
      ? preferScale
      : this.availableScales.sort().reverse()[0];

    return `https://cdn.7tv.app/emote/${this.id}/${scale}x`;
  }
}


type Emote = GlobalEmote | ChannelEmote;


class EmoteList extends BaseEmoteList<Emote> {
  constructor({ sevenTvChannelId, emotes }: { sevenTvChannelId: string, emotes: Emote[] | null }) {
    super({
      provider: "7tv",
      overviewUrl: `https://7tv.app/users/${sevenTvChannelId}`,
      emotes,
    });
  }
}


const GQL_LIST_GLOBAL_QUERY = `
query listGlobal {
  search_emotes(
    query: "",
    globalState: "only",
    limit: 150,
    pageSize: 150
  ) {
    id
    name
  }
}`;

async function listGlobal(): Promise<GlobalEmote[] | null> {
  const data = await cached<SevenTvEmoteEntry[] | null>(
    EMOTES, `list:7tv:global`,
    async () => {
      const response = await fetch(
        GQL_ENDPOINT,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify(
            {
              query: GQL_LIST_GLOBAL_QUERY,
              variables: {},
            },
          ),
        },
      );
      if (!response.ok) {
        return null;
      } else {
        return <SevenTvEmoteEntry[]>(
          (await response.json()).data?.search_emotes ?? []
        );
      }
    },
    { expirationTtl: CACHE_TTL },
  );
  if (data) {
    return data.map(({ id, name: code }) => {
      return new GlobalEmote({ id, code });
    });
  } else {
    return null;
  }
}


const GQL_LIST_CHANNEL_QUERY = `
query listChannel($channelId: String!) {
  user(id: $channelId) {
    id
    emotes {
      id
      name
      owner {
        id
        login
        display_name
        twitch_id
      }
      channel_count
      visibility
    }
  }
}`;


async function listChannel(channel: ChannelWithId): Promise<EmoteList | null> {
  const data = await cached<SevenTvChannelEmoteList | null>(
    EMOTES, `list:7tv:${channel.id}`,
    async () => {
      const response = await fetch(
        GQL_ENDPOINT,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify(
            {
              query: GQL_LIST_CHANNEL_QUERY,
              variables: {
                channelId: channel.id.toString(),
              },
            },
          ),
        },
      );
      if (!response.ok) {
        return null;
      } else {
        return <SevenTvChannelEmoteList>(
          (await response.json()).data.user
        );
      }
    },
    { expirationTtl: CACHE_TTL },
  );
  if (data) {
    return new EmoteList({
      sevenTvChannelId: data.id,
      emotes: data.emotes
        .map(({ id, name, owner, channel_count, visibility }) => new ChannelEmote({
          id, code: name, creator: {
            id: parseInt(owner.twitch_id), name: owner.login, displayName: owner.display_name,
          }, usageCount: channel_count, visibility,
        })),
    });
  } else {
    return null;
  }
}


const GQL_SEARCH_EMOTE_QUERY = `
query searchEmote($emoteCode: String!, $page: Int!) {
  search_emotes(
    query: $emoteCode,
    limit: 150,
    pageSize: 150,
    page: $page,
    sortBy: "popularity",
    sortOrder: 0,
    globalState: "hide"
  ) {
    id
    name
    owner {
      id
      login
      display_name
      twitch_id
    }
    channel_count
    visibility
  }
}`;


async function findCode(code: string): Promise<ChannelEmote[] | null> {
  const data = await cached<SevenTvEmoteEntry[] | null>(
    EMOTES, `search:7tv:${code.toLowerCase()}`,
    async () => {
      let results: SevenTvEmoteEntry[] = [];
      let currPage = 1;
      let collectionSize: number | null = null;
      let error = false;

      while (collectionSize === null || results.length < collectionSize) {
        const response = await fetch(
          GQL_ENDPOINT,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify(
              {
                query: GQL_SEARCH_EMOTE_QUERY,
                variables: {
                  emoteCode: code,
                  page: currPage,
                },
              },
            ),
          },
        );
        if (!response.ok) {
          error = true;
          break;
        } else {
          const page = <SevenTvEmoteEntry[]>(
            (await response.json()).data?.search_emotes ?? []
          );
          collectionSize = parseInt(response.headers.get("x-collection-size")!);
          results = [...results, ...page];
        }
      }
      return error
        ? null
        : results;
    },
    { expirationTtl: CACHE_TTL },
  );
  if (data) {
    const witchMatchingCode = data
      .filter(e => e.name.toLowerCase() === code.toLowerCase())
      .map(({ id, name, owner, channel_count, visibility }) => new ChannelEmote({
        id, code: name, creator: {
          id: parseInt(owner.twitch_id), name: owner.login, displayName: owner.display_name,
        }, usageCount: channel_count, visibility,
      }));
    if (witchMatchingCode.length >= 1) {
      return witchMatchingCode;
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

  let emote: Emote | null = null;
  {
    const globalEmotes = await listGlobal();
    if (globalEmotes) {
      emote = preferCaseSensitiveFind(globalEmotes, code);
    }
  }
  if (channel) {
    const channelEmotes = await listChannel(channel);
    if (channelEmotes && channelEmotes.emotes) {
      emote = channelEmotes.emotes
        .find(e => e.code.toLowerCase() == code.toLowerCase()) ?? emote;
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
