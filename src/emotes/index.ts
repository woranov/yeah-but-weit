import * as Ttv from "./ttv";
import * as Bttv from "./bttv";
import * as Ffz from "./ffz";
import { BaseEmote } from "./base";


const EMOTE_PROVIDERS = {
  "ttv": Ttv,
  "bttv": Bttv,
  "ffz": Ffz,
};


async function find(
  { code, channel = null, provider = null }: {
    code: string, channel: Channel | null, provider: EmoteProviderName | null
  },
): Promise<BaseEmote | null> {
  const providers: EmoteProviderName[] = provider ? [provider] : ["ttv", "bttv", "ffz"];

  let candidates: BaseEmote[] = [];
  for (const provider of providers) {
    const emote = await EMOTE_PROVIDERS[provider].find({ code, channel });
    if (emote && provider == "ttv") {
      return emote;
    } else if (emote) {
      candidates.push(emote);
    }
  }
  if (candidates.length >= 2) {
    let mostPopular = null;
    let maxCount = -1;
    for (const candidate of candidates) {
      if (candidate instanceof Bttv.Emote && candidate.usageCount === null) {
        return candidate;
      } else if ((<Bttv.Emote | Ffz.Emote>candidate).usageCount! > maxCount) {
        maxCount = (<Bttv.Emote | Ffz.Emote>candidate).usageCount!;
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

export { find };
export { BaseEmote } from "./base";
