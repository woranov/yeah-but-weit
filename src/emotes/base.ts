import { find as findSupibotOrigin } from "../supibot";


export abstract class BaseEmote {
  readonly id: number | string;
  readonly code: string;

  constructor(
    { id, code }: {
      id: number | string,
      code: string,
    },
  ) {
    this.id = id;
    this.code = code;
  }

  abstract get description(): string;

  abstract get imageUrl(): string;

  abstract get infoUrl(): string;

  async getOrigin(): Promise<SupibotEmoteOriginEntry | null> {
    return await findSupibotOrigin(this);
  }
}


export abstract class BaseGlobalEmote extends BaseEmote {
}


export abstract class BaseChannelEmote extends BaseEmote {
  readonly creatorDisplayName: string;

  protected constructor(
    { creatorDisplayName, ...rest }: {
      id: number | string,
      code: string,
      creatorDisplayName: string,
    },
  ) {
    super(rest);
    this.creatorDisplayName = creatorDisplayName;
  }
}


export abstract class BaseEmoteList<T extends BaseEmote> {
  readonly provider: EmoteProviderName;
  readonly overviewUrl: string;
  emotes: T[] | null;

  protected constructor({ provider, overviewUrl, emotes }: {
    provider: EmoteProviderName, overviewUrl: string, emotes: T[] | null
  }) {
    this.provider = provider;
    this.overviewUrl = overviewUrl;
    this.emotes = emotes;
  }
}


/*
export interface ProviderModule<T extends BaseEmote> {
  find(args: { code: string, channel: Channel | null }): Promise<T | null>;
}
*/
