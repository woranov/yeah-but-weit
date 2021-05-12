import { find as findSupibotOrigin } from "../supibot";


export type ImageScale = 1 | 2 | 3;
export type AvailableScalesArray = [ImageScale, ...ImageScale[]];


export abstract class BaseEmote {
  readonly id: number | string;
  readonly code: string;
  readonly availableScales: AvailableScalesArray;

  constructor(
    { id, code, availableScales }: {
      id: number | string,
      code: string,
      availableScales: AvailableScalesArray,
    },
  ) {
    this.id = id;
    this.code = code;
    this.availableScales = availableScales;
  }

  abstract get description(): string;

  abstract get infoUrl(): string;

  abstract imageUrl(preferScale?: ImageScale): string;

  async getOrigin(): Promise<SupibotEmoteOriginEntry | null> {
    return await findSupibotOrigin(this);
  }
}


export abstract class BaseGlobalEmote extends BaseEmote {
}


export abstract class BaseChannelEmote extends BaseEmote {
  readonly creator: Channel;

  protected constructor(
    { creator, ...rest }: {
      id: number | string,
      code: string,
      availableScales: AvailableScalesArray,
      creator: Channel,
    },
  ) {
    super(rest);
    this.creator = creator;
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
