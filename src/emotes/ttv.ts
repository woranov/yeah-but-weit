import { BaseChannelEmote, BaseGlobalEmote } from "./base";
import { CACHE_TTL } from "../config";
import { checkEmoteCode } from "../twitch";


class GlobalEmote extends BaseGlobalEmote {
  get description(): string {
    return "Global Twitch Emote";
  }

  get imageUrl(): string {
    return `https://static-cdn.jtvnw.net/emoticons/v1/${this.id}/3.0`;
  }

  get infoUrl(): string {
    return `https://twitchemotes.com/emotes/${this.id}`;
  }
}


class ChannelEmote extends BaseChannelEmote {
  readonly tier: TwitchChannelEmoteTier;

  constructor(
    { tier, ...rest }: {
      id: number,
      code: string,
      creatorDisplayName: string,
      tier: TwitchChannelEmoteTier,
    },
  ) {
    super(rest);
    this.tier = tier;
  }

  get description(): string {
    return `Tier ${this.tier} ${this.creatorDisplayName} Emote`;
  }

  get imageUrl(): string {
    return `https://static-cdn.jtvnw.net/emoticons/v1/${this.id}/3.0`;
  }

  get infoUrl(): string {
    return `https://twitchemotes.com/emotes/${this.id}`;
  }
}


type Emote = GlobalEmote | ChannelEmote;


class TwitchEmotesApiSentIncorrect404 extends Error {
}


const TWITCHEMOTES_API_PLAN_ALIASES: { [key: string]: TwitchChannelEmoteTier } = {
  "$4.99": 1,
  "$9.99": 2,
  "$24.99": 3,
};

async function list(channel: Channel): Promise<Emote[] | null> {
  const key = `list:ttv:${channel.id}`;

  let data = <TwitchEmoteListResult | null>await EMOTES.get(key, "json");

  if (!data) {
    const response = await fetch(
      `https://api.twitchemotes.com/api/v4/channels/${channel.id}`,
    );

    if (response.ok) {
      data = <TwitchEmoteListResult>await response.json();
      await EMOTES.put(key, JSON.stringify(data), { expirationTtl: CACHE_TTL });
    } else {
      if (
        response.status == 404
        && (await response.json()).error.toLowerCase().includes("channel not found")
      ) {
        throw new TwitchEmotesApiSentIncorrect404();
      }
    }
  }

  if (data) {
    if (channel.id === 0) {
      return data.emotes
        .filter(({ id }: TwitchEmoteEntry) => {
          // ignore regex emotes like :), :D, ... for now
          return id >= 15;
        })
        .map(({ id, code }: TwitchEmoteEntry) => {
          return new GlobalEmote({ id, code });
        });
    } else {
      const reversePlanLookup = Object.fromEntries(
        Object.entries(data.plans).map(([k, v]) => [v, k]),
      );
      return data.emotes.map(({ id, code, emoticon_set }: TwitchEmoteEntry) => {
        return new ChannelEmote({
            id,
            code,
            creatorDisplayName: channel.name,
            tier: TWITCHEMOTES_API_PLAN_ALIASES[reversePlanLookup[emoticon_set.toString()]],
          },
        );
      });
    }
  } else {
    return null;
  }
}


const DOES_NOT_EXIST_SENTINEL_EMOTE_ID = "-1";
const DOES_NOT_EXIST_SENTINEL: TwitchEmoteLookupResult = {
  channel: null,
  channellogin: null,
  emoteid: DOES_NOT_EXIST_SENTINEL_EMOTE_ID,
  emotecode: "",
  tier: "",
};


async function findCode(code: string): Promise<Emote | null> {
  const key = `ttv:${code}`;

  let data = <TwitchEmoteLookupResult | null>await EMOTES.get(key, "json");

  if (!data) {
    const response = await fetch(
      `https://api.ivr.fi/twitch/emotes/${code}`,
    );

    if (response.ok) {
      data = await response.json();
    } else {
      data = DOES_NOT_EXIST_SENTINEL;
    }
    await EMOTES.put(key, JSON.stringify(data), { expirationTtl: CACHE_TTL });
  }

  if (data) {
    if (data.emoteid === DOES_NOT_EXIST_SENTINEL_EMOTE_ID) {
      return null;
    } else if (data.channellogin === null) {
      return new GlobalEmote({ id: data.emoteid, code: data.emotecode });
    } else {
      return new ChannelEmote({
        id: parseInt(data.emoteid),
        code: data.emotecode,
        creatorDisplayName: data.channel!,
        tier: <TwitchChannelEmoteTier>parseInt(data.tier),
      });
    }
  } else {
    return null;
  }
}


async function find(
  { code, channel = null }: { code: string, channel: Channel | null },
): Promise<Emote | null> {
  // FIXME: refactor

  if (!checkEmoteCode({ emoteCode: code, caseSensitive: false })) {
    return null;
  }

  try {
    if (channel !== null && checkEmoteCode({ emoteCode: code, caseSensitive: true })) {
      const channelEmotes = await list(channel);
      const foundInChannelEmotes = (
        channelEmotes && channelEmotes.find(
          e => e.code.toLowerCase() == code.toLowerCase(),
        )
      ) ?? null;
      if (foundInChannelEmotes) {
        return foundInChannelEmotes;
      } else {
        const emote = await findCode(code);
        if (emote && emote instanceof GlobalEmote) {
          return emote;
        }
      }
    } else {
      const emote = await findCode(code);
      if (emote) {
        return emote;
      }
    }
  } catch (e) {
    if (
      e instanceof TwitchEmotesApiSentIncorrect404
      && checkEmoteCode({ emoteCode: code, caseSensitive: true })
    ) {
      const emote = await findCode(code);
      if (emote !== null && channel !== null) {
        if (
          emote instanceof ChannelEmote
          && emote.creatorDisplayName.toLowerCase() == channel.name
        ) {
          return emote;
        }
      } else if (emote !== null) {
        return emote;
      }
    } else {
      throw e;
    }
  }
  return null;
}


export { ChannelEmote, GlobalEmote, find };
