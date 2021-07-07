type TwitchChannelEmoteTier = 1 | 2 | 3 | "special";
type EmoteProviderName = "ttv" | "bttv" | "ffz" | "7tv";

type ImageScale = 1 | 2 | 3 | 4;
type AvailableScalesArray = [ImageScale, ...ImageScale[]];


// old twitchemotes types
interface _TwitchEmoteEntry {
  id: number;
  code: string;
  emoticon_set: number;
}


interface _TwitchEmoteListResult {
  plans: {
    [key: string]: string;
  };
  emotes: _TwitchEmoteEntry[];
}


interface TwitchEmoteEntry {
  id: string;
  name: string;
  tier: string;
  emote_type: "subscriptions" | "bitstier" | "follower";
}


interface TwitchEmoteLookupResult {
  channelid: string | null;
  channel: string | null;
  channellogin: string | null;
  emoteid: string;
  emotecode: string;
  tier: string | null;
}


interface BttvEmoteEntry {
  id: string;
  code: string;
}


interface BttvChannelEmoteEntry extends BttvEmoteEntry {

}


interface BttvSharedEmoteEntry extends BttvEmoteEntry {
  user: {
    id: string;
    name: string;
    displayName: string;
    providerId: string;
  }
}


interface BttvEmoteListResult {
  id: string;
  sharedEmotes: BttvSharedEmoteEntry[];
  channelEmotes: BttvChannelEmoteEntry[];
}


interface BttvTrendingEmoteListEntry {
  emote: {
    id: string;
    code: string;
    user: {
      name: string;
      displayName: string;
      providerId: string;
    };
  };
  total: number;
}


interface BttvEmoteSearchResultEntry {
  id: string;
  code: string;
  user: {
    name: string;
    displayName: string;
    providerId: string;
  };
}


interface FfzEmoteEntry {
  id: number;
  name: string;
  owner: {
    _id: number;
    name: string;
    display_name: string;
  }
  urls: { [key: string]: string };
  usage_count: number;
}


interface FfzEmoteListResult {
  room: {
    set: number;
  };
  sets: {
    [key: string]: {
      emoticons: FfzEmoteEntry[];
    };
  };
}


interface FfzGlobalEmoteListResult {
  default_sets: number[];
  users: { [key: string]: string[] };
  sets: {
    [key: string]: {
      emoticons: FfzEmoteEntry[];
    };
  };
}


interface FfzEmoteSearchResult {
  _pages: number;
  emoticons: FfzEmoteEntry[];
}


interface SevenTvEmoteEntry {
  id: string;
  name: string;
  owner: {
    id: string;
    login: string;
    display_name: string;
    twitch_id: string;
  };
  channel_count: number;
  visibility: number;
}


interface SevenTvChannelEmoteList {
  id: string;
  emotes: SevenTvEmoteEntry[];
}


// type EmoteEntry = TwitchEmoteEntry | BttvEmoteEntry | FfzEmoteEntry;


interface Channel {
  name: string;
  displayName: string;
}


interface ChannelWithId extends Channel {
  id: number;
}


interface ChannelWithProfilePicture extends ChannelWithId {
  profileImageUrl: string;
}


interface SupibotEmoteOriginEntry {
  ID: string;
  emoteID: string | null;
  type: string;
  author: string | null;
  reporter: string | null;
  text: string | null;
  notes: string | null;
}
