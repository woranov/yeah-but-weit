import { BaseChannelEmote, BaseEmoteList, BaseGlobalEmote } from "./base";
import { CACHE_TTL } from "../config";
import { checkEmoteCode, helix } from "../twitch";
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
    return `https://static-cdn.jtvnw.net/emoticons/v2/${this.id}/default/dark/${preferScale}.0`;
  }
}


abstract class BaseTwitchChannelEmote extends BaseChannelEmote {
  protected constructor(
    args: {
      id: string,
      code: string,
      creator: ChannelWithId,
    },
  ) {
    super({ availableScales: [1, 2, 3], ...args });
  }

  get infoUrl(): string {
    return `https://twitchemotes.com/emotes/${this.id}`;
  }

  imageUrl(preferScale: ImageScale = 3): string {
    return `https://static-cdn.jtvnw.net/emoticons/v2/${this.id}/default/dark/${preferScale}.0`;
  }
}


class SubEmote extends BaseTwitchChannelEmote {
  readonly tier: TwitchChannelEmoteTier;

  constructor(
    { tier, ...rest }: {
      id: string,
      code: string,
      creator: ChannelWithId,
      tier: TwitchChannelEmoteTier,
    },
  ) {
    super(rest);
    this.tier = tier;
  }

  get description(): string {
    return `Tier ${this.tier} @${this.creator.name} Emote`;
  }
}


class BitEmote extends BaseTwitchChannelEmote {
  constructor(
    args: {
      id: string,
      code: string,
      creator: ChannelWithId,
    },
  ) {
    super(args);
  }

  get description(): string {
    return `@${this.creator.name} Bits Emote`;
  }
}


class FollowerEmote extends BaseTwitchChannelEmote {
  constructor(
    args: {
      id: string,
      code: string,
      creator: ChannelWithId,
    },
  ) {
    super(args);
  }

  get description(): string {
    return `@${this.creator.name} Follower Emote`;
  }
}


type Emote = GlobalEmote | SubEmote | BitEmote | FollowerEmote;


class EmoteList extends BaseEmoteList<Emote> {
  constructor({ channel, emotes }: { channel: ChannelWithId, emotes: Emote[] | null }) {
    super({
      provider: "ttv",
      overviewUrl: `https://twitchemotes.com/channels/${channel.id}`,
      emotes,
    });
  }
}


async function listChannel(channel: ChannelWithId): Promise<EmoteList> {
  const data = await cached<TwitchEmoteEntry[] | null>(
    EMOTES, `list:ttv:${channel.id}`,
    async () => {
      const response = await helix(`chat/emotes?broadcaster_id=${channel.id}`);

      if (response.ok) {
        const json = await response.json();
        return json.data;
      } else {
        return null;
      }
    },
    { expirationTtl: CACHE_TTL },
  );

  if (data) {
    const emotes = [];
    for (const emoteData of data) {
      switch (emoteData.emote_type) {
        case "subscriptions":
          emotes.push(new SubEmote({
            id: emoteData.id,
            code: emoteData.name,
            creator: channel,
            tier:
              emoteData.tier === "1000"
                ? 1 : emoteData.tier === "2000"
                ? 2 : 3,
          }));
          break;
        case "bitstier":
          emotes.push(new BitEmote({
            id: emoteData.id,
            code: emoteData.name,
            creator: channel,
          }));
          break;
        case "follower":
          emotes.push(new FollowerEmote({
            id: emoteData.id,
            code: emoteData.name,
            creator: channel,
          }));
          break;
      }
    }
    return new EmoteList({
      channel,
      emotes: emotes,
    });
  } else {
    return new EmoteList({ channel, emotes: null });
  }
}


const DOES_NOT_EXIST_SENTINEL_EMOTE_ID = "-1";
// noinspection JSUnusedLocalSymbols
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
        : null;
    },
    { expirationTtl: CACHE_TTL },
  );

  if (data) {
    if (data.emoteid === DOES_NOT_EXIST_SENTINEL_EMOTE_ID) {
      return null;
    } else if (data.channellogin === null) {
      return new GlobalEmote({ id: data.emoteid, code: data.emotecode });
    } else {
      return new SubEmote({
        id: data.emoteid,
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
  if (
    checkEmoteCode({ emoteCode: code, caseSensitive: true })
  ) {
    let emote = await findCode(code);
    if (emote && channel) {
      // must match channel
      if (
        emote instanceof BaseTwitchChannelEmote
        && emote.creator.name === channel.name
      ) {
        return emote;
      }
    }
  }
  return null;
}


export {
  BaseTwitchChannelEmote,
  SubEmote,
  FollowerEmote,
  BitEmote,
  GlobalEmote,
  EmoteList,
  find,
  listChannel,
};
