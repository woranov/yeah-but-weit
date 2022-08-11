import { BaseChannelEmote, BaseEmoteList, BaseGlobalEmote } from "./base";
import { CACHE_TTL, SHORTER_CACHE_TTL } from "../config";
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


class SpecialGlobalEmote extends GlobalEmote {
  get description(): string {
    return "Special Twitch Emote";
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
  readonly tier: TwitchChannelEmoteTier | null;

  constructor(
    { tier, ...rest }: {
      id: string,
      code: string,
      creator: ChannelWithId,
      tier: TwitchChannelEmoteTier | null,
    },
  ) {
    super(rest);
    this.tier = tier;
  }

  get description(): string {
    if (this.tier === "special") {
      return `Special @${this.creator.name} Emote`
    } else if (this.tier === null) {
      return `@${this.creator.name} Emote`;
    } else {
      return `Tier ${this.tier || '?'} @${this.creator.name} Emote`;
    }
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
    { expirationTtl: SHORTER_CACHE_TTL },
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
              emoteData.tier === ""
                ? "special" : emoteData.tier === "1000"
                ? 1 : emoteData.tier === "2000"
                ? 2 : emoteData.tier === "3000"
                ? 3 : null,
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
  channelID: null,
  channelName: null,
  channelLogin: null,
  emoteID: DOES_NOT_EXIST_SENTINEL_EMOTE_ID,
  emoteCode: "",
  emoteTier: "",
};


async function findCode(code: string): Promise<Emote | null> {
  const data = await cached<TwitchEmoteLookupResult | null>(
    EMOTES, `ttv:${code}`,
    async () => {
      const response = await fetch(
        `https://api.ivr.fi/v2/twitch/emotes/${code}`,
      );

      return response.ok
        ? await response.json()
        : null;
    },
    { expirationTtl: CACHE_TTL },
  );

  if (data) {
    if (data.emoteID === DOES_NOT_EXIST_SENTINEL_EMOTE_ID) {
      return null;
    } else if (data.channelLogin === null) {
      return new GlobalEmote({ id: data.emoteID, code: data.emoteCode });
    } else if (data.emoteTier === null) {
      return new SpecialGlobalEmote({ id: data.emoteID, code: data.emoteCode });
    } else {
      return new SubEmote({
        id: data.emoteID,
        code: data.emoteCode,
        creator: {
          id: parseInt(data.channelID!),
          name: data.channelLogin!,
          displayName: data.channelName!,
        },
        tier: <TwitchChannelEmoteTier>parseInt(data.emoteTier),
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
