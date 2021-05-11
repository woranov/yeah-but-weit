import * as Ttv from "./ttv";
import * as Bttv from "./bttv";
import * as Ffz from "./ffz";
import { BaseChannelEmote, BaseEmote, BaseGlobalEmote } from "./base";


const EMOTE_PROVIDERS = {
  "ttv": Ttv,
  "bttv": Bttv,
  "ffz": Ffz,
};


function mostPopularCandidate(candidates: BaseEmote[]): BaseEmote | null {
  if (candidates.length >= 2) {
    let mostPopular = null;
    let maxCount = -1;
    for (const candidate of candidates) {
      if (candidate instanceof Bttv.ChannelEmote && candidate.usageCount === null) {
        return candidate;
      } else if ((<Bttv.ChannelEmote | Ffz.ChannelEmote>candidate).usageCount! > maxCount) {
        maxCount = (<Bttv.ChannelEmote | Ffz.ChannelEmote>candidate).usageCount!;
        mostPopular = candidate;
      }
    }
    return mostPopular!;
  } else if (candidates.length == 1) {
    return candidates[0];
  } else {
    return null;
  }
}


async function find(
  { code, channel = null, provider = null }: {
    code: string, channel: Channel | null, provider: EmoteProviderName | null
  },
): Promise<BaseEmote | null> {
  const providers: EmoteProviderName[] = provider ? [provider] : ["ttv", "ffz", "bttv"];

  let candidates: BaseEmote[] = [];
  for (const provider of providers) {
    const emote = await EMOTE_PROVIDERS[provider].find({ code, channel });
    if (emote && (
      (provider == "ttv" || emote instanceof BaseGlobalEmote)
      || (channel && !(emote instanceof BaseGlobalEmote))
    )) {
      return emote;
    } else if (emote) {
      candidates.push(emote);
    }
  }

  let mostPopular = null;
  if (code.toLowerCase() !== code) {
    mostPopular = mostPopularCandidate(candidates.filter(e => e.code === code));
  }
  if (!mostPopular) {
    mostPopular = mostPopularCandidate(candidates);
  }
  return mostPopular;
}

export { EMOTE_PROVIDERS, find };
export { BaseEmote, BaseChannelEmote } from "./base";
