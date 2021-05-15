import { BaseChannelEmote, BaseEmoteList, BaseGlobalEmote } from "./base";
import { CACHE_TTL } from "../config";
import { checkEmoteCode } from "../twitch";
import { preferCaseSensitiveFind } from "./common";
import cached from "../caching";


class GlobalEmote extends BaseGlobalEmote {
  constructor({ ...args }: {
    id: number | string,
    code: string,
  }) {
    super({ ...args, availableScales: [1, 2, 3] });
  }

  get description(): string {
    return "Global Twitch Emote";
  }

  get infoUrl(): string {
    return `https://twitchemotes.com/emotes/${this.id}`;
  }

  imageUrl(preferScale: ImageScale = 3): string {
    return `https://static-cdn.jtvnw.net/emoticons/v1/${this.id}/${preferScale}.0`;
  }
}


class ChannelEmote extends BaseChannelEmote {
  readonly tier: TwitchChannelEmoteTier;

  constructor(
    { tier, ...rest }: {
      id: number,
      code: string,
      creator: ChannelWithId,
      tier: TwitchChannelEmoteTier,
    },
  ) {
    super({ availableScales: [1, 2, 3], ...rest });
    this.tier = tier;
  }

  get description(): string {
    return `Tier ${this.tier} @${this.creator.name} Emote`;
  }

  get infoUrl(): string {
    return `https://twitchemotes.com/emotes/${this.id}`;
  }

  imageUrl(preferScale: ImageScale = 3): string {
    return `https://static-cdn.jtvnw.net/emoticons/v1/${this.id}/${preferScale}.0`;
  }
}


type Emote = GlobalEmote | ChannelEmote;


class EmoteList extends BaseEmoteList<Emote> {
  constructor({ channel, emotes }: { channel: ChannelWithId, emotes: Emote[] | null }) {
    super({
      provider: "ttv",
      overviewUrl: `https://twitchemotes.com/channels/${channel.id}`,
      emotes,
    });
  }
}


class TwitchEmotesApiSentIncorrect404 extends Error {
}


const TWITCHEMOTES_API_PLAN_ALIASES: { [key: string]: TwitchChannelEmoteTier } = {
  "$4.99": 1,
  "$9.99": 2,
  "$24.99": 3,
};

async function listChannel(channel: ChannelWithId): Promise<EmoteList> {
  const data = await cached<TwitchEmoteListResult | null>(
    EMOTES, `list:ttv:${channel.id}`,
    async () => {
      const response = await fetch(
        `https://api.twitchemotes.com/api/v4/channels/${channel.id}`,
      );

      if (response.ok) {
        return await response.json();
      } else {
        if (
          response.status == 404
          && (await response.json()).error.toLowerCase().includes("channel not found")
        ) {
          throw new TwitchEmotesApiSentIncorrect404();
        }
      }
      return null;
    },
    { expirationTtl: CACHE_TTL },
  );

  if (data) {
    if (channel.id === 0) {
      return new EmoteList({
          channel, emotes: data.emotes
            .filter(({ id }: TwitchEmoteEntry) => {
              // ignore regex emotes like :), :D, ... for now
              return id >= 15;
            })
            .map(({ id, code }: TwitchEmoteEntry) => {
              return new GlobalEmote({ id, code });
            }),
        },
      );
    } else {
      const reversePlanLookup = Object.fromEntries(
        Object.entries(data.plans).map(([k, v]) => [v, k]),
      );
      return new EmoteList({
        channel,
        emotes: data.emotes.map(({ id, code, emoticon_set }: TwitchEmoteEntry) => {
          return new ChannelEmote({
              id,
              code,
              creator: channel,
              tier: TWITCHEMOTES_API_PLAN_ALIASES[reversePlanLookup[emoticon_set.toString()]],
            },
          );
        }),
      });
    }
  } else {
    return new EmoteList({ channel, emotes: null });
  }
}


const DOES_NOT_EXIST_SENTINEL_EMOTE_ID = "-1";
const DOES_NOT_EXIST_SENTINEL: TwitchEmoteLookupResult = {
  channelid: null,
  channel: null,
  channellogin: null,
  emoteid: DOES_NOT_EXIST_SENTINEL_EMOTE_ID,
  emotecode: "",
  tier: "",
};


async function findCode(code: string): Promise<Emote | null> {
  const data = await cached<TwitchEmoteLookupResult | null>(
    EMOTES, `ttv:${code}`,
    async () => {
      const response = await fetch(
        `https://api.ivr.fi/twitch/emotes/${code}`,
      );

      return response.ok
        ? await response.json()
        : DOES_NOT_EXIST_SENTINEL;
    },
    { expirationTtl: CACHE_TTL },
  );

  if (data) {
    if (data.emoteid === DOES_NOT_EXIST_SENTINEL_EMOTE_ID) {
      return null;
    } else if (data.channellogin === null) {
      return new GlobalEmote({ id: data.emoteid, code: data.emotecode });
    } else {
      return new ChannelEmote({
        id: parseInt(data.emoteid),
        code: data.emotecode,
        creator: {
          id: parseInt(data.channelid!),
          name: data.channellogin!,
          displayName: data.channel!,
        },
        tier: <TwitchChannelEmoteTier>parseInt(data.tier),
      });
    }
  } else {
    return null;
  }
}


async function find(
  { code, channel = null }: { code: string, channel: ChannelWithId | null },
): Promise<Emote | null> {
  if (!checkEmoteCode({ emoteCode: code, caseSensitive: false })) {
    return null;
  }

  try {
    if (channel) {
      // check channel emote list
      const channelEmotes = await listChannel(channel);
      const emote = (
        channelEmotes.emotes && preferCaseSensitiveFind(channelEmotes.emotes, code)
      ) ?? null;

      if (emote) {
        return emote;
      } else if (checkEmoteCode({ emoteCode: code, caseSensitive: true })) {
        // not found in channel emote list, so it must be a global emote
        const emote = await findCode(code);
        if (emote && emote instanceof GlobalEmote) {
          return emote;
        }
      }
    } else if (checkEmoteCode({ emoteCode: code, caseSensitive: true })) {
      return await findCode(code);
    }
  } catch (e) {
    if (!(e instanceof TwitchEmotesApiSentIncorrect404)) {
      throw e;
    } else if (
      checkEmoteCode({ emoteCode: code, caseSensitive: true })
    ) {
      let emote = await findCode(code);
      if (emote && channel) {
        // must match channel
        if (
          emote instanceof ChannelEmote
          && emote.creator.name === channel.name
        ) {
          return emote;
        }
      }
    }
  }
  return null;
}


export { ChannelEmote, GlobalEmote, EmoteList, TwitchEmotesApiSentIncorrect404, find, listChannel };
