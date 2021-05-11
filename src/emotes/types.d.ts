type TwitchChannelEmoteTier = 1 | 2 | 3;
type EmoteProviderName = "ttv" | "bttv" | "ffz";


interface TwitchEmoteEntry {
  id: number;
  code: string;
  emoticon_set: number;
}


interface TwitchEmoteListResult {
  plans: {
    [key: string]: string;
  };
  emotes: TwitchEmoteEntry[];
}


interface TwitchEmoteLookupResult {
  channel: string | null;
  channellogin: string | null;
  emoteid: string;
  emotecode: string;
  tier: string;
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
      displayName: string;
    };
  };
  total: number;
}


interface BttvEmoteSearchResultEntry {
  id: string;
  code: string;
  user: {
    displayName: string;
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


// type EmoteEntry = TwitchEmoteEntry | BttvEmoteEntry | FfzEmoteEntry;


interface Channel {
  id: number;
  name: string;
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
