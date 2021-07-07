import { Request } from "itty-router";

import { checkChannelName, fetchChannel } from "../twitch";
import { BaseChannelEmote, BaseEmote, EMOTE_PROVIDERS, find } from "../emotes";
import { addLinkToAtMentionTransformer, createHtml, notFoundHandler } from "./common";
import { originUrl } from "../supibot";
import { BaseEmoteList, providerFullNames } from "../emotes/base";
import {
  BaseTwitchChannelEmote as TwitchChannelEmote,
  BitEmote,
  EmoteList as TwitchEmoteList,
  FollowerEmote,
  GlobalEmote as TwitchGlobalEmote,
  SubEmote,
} from "../emotes/ttv";
import { ChannelEmote as BttvChannelEmote, GlobalEmote as BttvGlobalEmote } from "../emotes/bttv";
import { GlobalEmote as FfzGlobalEmote } from "../emotes/ffz";
import { GlobalEmote as SevenTvGlobalEmote } from "../emotes/7tv";


const REDIRECT_PROPERTIES = [
  "EMOTE_IMAGE_URL", "EMOTE_INFO_PAGE_URL", "EMOTE_TESTER_URL",
  "EMOTE_CREATOR_CHANNEL_URL", "EMOTE_SUPIBOT_ORIGIN_URL",
  "EMOTE_CREATOR_EMOTE_LIST_URL",
] as const;
type RedirectProperty = typeof REDIRECT_PROPERTIES[number];

const EMOTE_ATTRIBUTE_PROPERTIES = [
  "EMOTE_CODE", "EMOTE_CREATOR", "EMOTE_DESCRIPTION", "WEIT_URL",
  "EMOTE_SUPIBOT_ORIGIN_INFO",
] as const;
type EmoteAttributeProperty = typeof EMOTE_ATTRIBUTE_PROPERTIES[number];

type Property = RedirectProperty | EmoteAttributeProperty;
type RedirectPropertyAliasesType = Record<RedirectProperty, string[]>;
type EmotePropertyAliasesType = Record<EmoteAttributeProperty, string[]>;

const REDIRECT_PROPERTY_ALIASES: RedirectPropertyAliasesType = {
  EMOTE_IMAGE_URL: [
    "image", "file", "dl", "imageurl", "fileurl", "dlurl", "cdn", "cdnurl",
  ],
  EMOTE_INFO_PAGE_URL: [
    "info", "page", "infopage", "infourl", "pageurl", "infopageurl",
  ],
  EMOTE_TESTER_URL: [
    "test", "tester", "emotetester", "testurl", "testerurl", "emotetesterurl",
  ],
  EMOTE_CREATOR_CHANNEL_URL: [
    "channel", "channelurl",
  ],
  EMOTE_SUPIBOT_ORIGIN_URL: [
    "origin", "originurl",
  ],
  EMOTE_CREATOR_EMOTE_LIST_URL: [
    "list", "listurl",
  ],
};

const EMOTE_PROPERTY_ALIASES: EmotePropertyAliasesType = {
  EMOTE_CODE: [
    "code", "emote", "emotecode",
  ],
  EMOTE_CREATOR: [
    "creator",
  ],
  EMOTE_DESCRIPTION: [
    "description",
  ],
  WEIT_URL: [
    "weiturl",
  ],
  EMOTE_SUPIBOT_ORIGIN_INFO: [
    "origininfo",
  ],
};


async function getProperty({ request, emote, property }: {
  request: Request, emote: BaseEmote, property: Property
}): Promise<string | null> {
  switch (property) {
    case "EMOTE_CODE":
      return emote.code;
    case "EMOTE_DESCRIPTION":
      return emote.description;
    case "EMOTE_CREATOR":
      if (emote instanceof BaseChannelEmote) {
        return `@${emote.creator.name}`;
      } else {
        return null;
      }
    case "WEIT_URL":
      const url = new URL(request.url);
      return url.hostname + url.pathname.replace(
        /\/[^\/]+\/?$/,
        `/${emote.code}`,
      );
    case "EMOTE_SUPIBOT_ORIGIN_INFO": {
      return await emote.getOrigin()
        ? "Supibot origin available"
        : "No origin available";
    }
    case "EMOTE_IMAGE_URL":
      return emote.imageUrl();
    case "EMOTE_INFO_PAGE_URL":
      return emote.infoUrl;
    case "EMOTE_TESTER_URL":
      return `https://emotetester.gempir.com/?emoteUrl=${encodeURIComponent(emote.imageUrl(1))}&resize=0`;
    case "EMOTE_CREATOR_CHANNEL_URL":
      if (emote instanceof BaseChannelEmote) {
        return `https://www.twitch.tv/${emote.creator.name}`;
      } else {
        return null;
      }
    case "EMOTE_SUPIBOT_ORIGIN_URL": {
      const origin = await emote.getOrigin();
      if (origin) {
        return originUrl(origin.ID);
      } else {
        return null;
      }
    }
    case "EMOTE_CREATOR_EMOTE_LIST_URL":
      if (emote instanceof BaseChannelEmote) {
        const url = new URL(request.url);
        return `${url.protocol}//${url.hostname}/list/${emote.creator.name}`;
      } else {
        return null;
      }
  }
}


async function createEmoteResponseHtml(
  channel: Channel | null, emote: BaseEmote,
): Promise<string> {
  const emoteOrigin = await emote.getOrigin();

  let extraHtml = "";
  let extraHead = "";

  if (emoteOrigin) {
    extraHtml += `
      <h2>Origin</h2>
      <p>Available on <a href='${originUrl(emoteOrigin.ID)}'>supinic.com</a></p>
    `;
  }

  const contextChannelNames = <string[]>[
    ...new Set([
      channel ? channel.name : null,
      emote instanceof BaseChannelEmote ? emote.creator.name : null,
    ].filter(Boolean)),
  ];

  if (contextChannelNames.length) {
    extraHead += `
      <style>
        .goto-channel-emotes-links {
          margin-top: 5rem;        
        }
      </style>
    `;

    const links = contextChannelNames.map(name => `
      <li><a href='/list/${name}'>@${name} Emote List</a></li>
    `).join("\n");

    extraHtml += `
      <span style='display: inline-block;'></span>
      <ul class='goto-channel-emotes-links'>
        ${links}
      </ul>
    `;
  }

  let author: string;
  if (emote instanceof BaseChannelEmote) {
    author = emote.creator.displayName;
  } else if (emote instanceof TwitchGlobalEmote) {
    author = providerFullNames["ttv"];
  } else if (emote instanceof BttvGlobalEmote) {
    author = providerFullNames["bttv"];
  } else if (emote instanceof FfzGlobalEmote) {
    author = providerFullNames["ffz"];
  } else if (emote instanceof SevenTvGlobalEmote) {
    author = providerFullNames["7tv"];
  } else {
    throw Error("dank");
  }

  return createHtml({
    title: {
      text: emote.code,
      url: emote.infoUrl,
    },
    description: emote.description,
    image: {
      url: emote.imageUrl(),
      alt: emote.code,
    },
    ogProperties: {
      title: emote.code,
      description: emote.description + (
        emoteOrigin
          ? " (Supibot origin available)"
          : ""
      ),
      author,
      imageUrl: emote.imageUrl(),
    },
    head: extraHead,
    html: extraHtml,
    textTransformers: [addLinkToAtMentionTransformer],
  });
}


type UnavailableEmoteList = { err: "unavailable", provider: EmoteProviderName };

function makeEmoteListHtml(channel: ChannelWithProfilePicture, emoteLists: Array<BaseEmoteList<BaseEmote> | UnavailableEmoteList>): string {
  const totalEmoteCount = (
    emoteLists.filter(el => el instanceof BaseEmoteList) as BaseEmoteList<BaseEmote>[]
  ).reduce(
    (currNum, currList) => currNum + (currList.emotes ? currList.emotes.length : 0),
    0,
  );

  const perProviderEmoteCountString = (
    emoteLists.filter(el => el instanceof BaseEmoteList && el.emotes !== null) as BaseEmoteList<BaseEmote>[]
  ).map(({ provider, emotes }) => `${emotes!.length} ${provider.toUpperCase()}`)
    .join(", ") + " Emotes";

  const makeEmoteList = (provider: EmoteProviderName, emotes: BaseEmote[]) => {
    const listItems = emotes.map(emote => `
      <li><a href='/${provider}/${channel.name.toLowerCase()}/${emote.code}' title='${emote.code} – ${emote.description}'>
        <img src='${emote.imageUrl(2)}' alt='${emote.code}'>
      </a></li>
    `).join("\n");

    return `<ul class='provider-emote-list'>${listItems}</ul>`;
  };

  const providerHtmlSections = emoteLists
    .map(emoteList => {
      if (!(emoteList instanceof BaseEmoteList)) {
        return `
          <h2>${providerFullNames[emoteList.provider]}</h2>
          <em class='provider-emote-list'>unavailable</em>
        `;
      }
      const { provider, emotes, overviewUrl } = emoteList;
      if (emotes !== null) {
        let emoteList = "";
        if (provider === "ttv") {
          // TODO: un-hardcode this mess
          const specialEmotes: TwitchChannelEmote[] = [];
          const t1Emotes: TwitchChannelEmote[] = [];
          const t2Emotes: TwitchChannelEmote[] = [];
          const t3Emotes: TwitchChannelEmote[] = [];
          const followerEmotes: TwitchChannelEmote[] = [];
          const bitEmotes: TwitchChannelEmote[] = [];

          for (const emote of emotes) {
            if (emote instanceof SubEmote) {
              switch (emote.tier) {
                case 1:
                  t1Emotes.push(emote);
                  break;
                case 2:
                  t2Emotes.push(emote);
                  break;
                case 3:
                  t3Emotes.push(emote);
                  break;
                case "special":
                  specialEmotes.push(emote);
                  break;
              }
            } else if (emote instanceof FollowerEmote) {
              followerEmotes.push(emote);
            } else if (emote instanceof BitEmote) {
              bitEmotes.push(emote);
            }
          }

          const sort = (ems: TwitchChannelEmote[]) => ems.sort((e1, e2) =>
            e1.code < e2.code
              ? -1 : e1.code > e2.code
              ? 1 : 0,
          );

          sort(specialEmotes);
          sort(t1Emotes);
          sort(t2Emotes);
          sort(t3Emotes);
          sort(followerEmotes);
          sort(bitEmotes);
          if (specialEmotes.length) {
            emoteList += `
              <h3>Special <small>(${specialEmotes.length})</small></h3>
              ${makeEmoteList("ttv", specialEmotes)}
            `;
          }
          if (t1Emotes.length) {
            emoteList += `
              <h3>Tier 1 <small>(${t1Emotes.length})</small></h3>
              ${makeEmoteList("ttv", t1Emotes)}
            `;
          }
          if (t2Emotes.length) {
            emoteList += `
              <h3>Tier 2 <small>(${t2Emotes.length})</small></h3>
              ${makeEmoteList("ttv", t2Emotes)}
            `;
          }
          if (t3Emotes.length) {
            emoteList += `
              <h3>Tier 3 <small>(${t3Emotes.length})</small></h3>
              ${makeEmoteList("ttv", t3Emotes)}
            `;
          }
          if (followerEmotes.length) {
            emoteList += `
              <h3>Follower <small>(${followerEmotes.length})</small></h3>
              ${makeEmoteList("ttv", followerEmotes)}
            `;
          }
          if (bitEmotes.length) {
            emoteList += `
              <h3>Bits <small>(${bitEmotes.length})</small></h3>
              ${makeEmoteList("ttv", bitEmotes)}
            `;
          }
        } else if (provider === "bttv") {
          const channelEmotes = (<BttvChannelEmote[]>emotes).filter(e => !e.isShared);
          const sharedEmotes = (<BttvChannelEmote[]>emotes).filter(e => e.isShared);
          if (channelEmotes.length) {
            emoteList += `
              <h3>Channel <small>(${channelEmotes.length})</small></h3>
              ${makeEmoteList("bttv", channelEmotes)}
            `;
          }
          if (sharedEmotes.length) {
            emoteList += `
              <h3>Shared <small>(${sharedEmotes.length})</small></h3>
              ${makeEmoteList("bttv", sharedEmotes)}
            `;
          }
          if (!channelEmotes.length && !sharedEmotes.length) {
            // add a blank list to insert spacing
            emoteList += makeEmoteList("bttv", []);
          }
        } else {
          emoteList += makeEmoteList(provider, emotes);
        }

        return `
          <h2><a href='${overviewUrl}'>${providerFullNames[provider]} (${emotes!.length})</a></h2>
          ${emoteList}
        `;
      } else {
        return `
          <h2><a href='${overviewUrl}'>${providerFullNames[emoteList.provider]}</a></h2>
          <em class='provider-emote-list'>unavailable</em>
        `;
      }
    });

  return createHtml({
    title: {
      text: `@${channel.name} Emote List`,
    },
    description: `${totalEmoteCount} Emotes`,
    image: {
      url: channel.profileImageUrl,
      alt: channel.name,
    },
    ogProperties: {
      title: `${channel.name} Emote List`,
      description: perProviderEmoteCountString,
      imageUrl: channel.profileImageUrl,
    },
    head: `
      <style>
        main {
          padding: 3rem;
          max-width: 60rem;
          margin: 0 auto;
        }
  
        main > a img {
          max-width: 200px;
        }
  
        main .provider-emote-list + h2 {
          margin-top: 5rem;
        }
      </style>
    `,
    html: providerHtmlSections.join("\n"),
    textTransformers: [addLinkToAtMentionTransformer],
  });
}


export const makeHandler = (provider: EmoteProviderName | null = null) => {
  return async (request: Request) => {
    let { channelName = null, code } = request.params!;
    let channel: ChannelWithProfilePicture | null = null;

    if (channelName) {
      if (!checkChannelName(channelName)) {
        return notFoundHandler();
      }

      channel = await fetchChannel(channelName);

      if (!channel)
        return notFoundHandler();
    }

    const emote = await find(
      { code, channel, provider: provider },
    );

    let getRawKey = null;
    let goToKey = null;
    if (request.query) {
      getRawKey = Object.keys(request.query).find(
        k => k.toLowerCase() === "raw",
      );
      goToKey = Object.keys(request.query).find(
        k => k.toLowerCase() === "goto",
      );
    }
    if (!emote && getRawKey) {
      return new Response("Emote not found", { status: 404 });
    }
    if (emote) {
      if (getRawKey) {
        const getRawValues = [...new Set(
          request.query![getRawKey]
            .toLowerCase()
            .split(",")
            .map(s => s.trim())
            .filter(Boolean),
        )];

        if (getRawValues.length === 0) {
          getRawValues.push("weiturl", "description");
        }
        let output = "";
        for (const rawValue of getRawValues) {
          for (const [property, propAliases] of <[Property, string[]][]>Object.entries(
            Object.assign({}, EMOTE_PROPERTY_ALIASES, REDIRECT_PROPERTY_ALIASES),
          )) {
            if (propAliases.includes(rawValue)) {
              const value = await getProperty({ request, emote, property });
              if (value) {
                if (property.endsWith("_URL") || property.endsWith("_CODE")) {
                  output += `${value} `;
                } else {
                  output += `${value}, `;
                }
              }
            }
          }
        }
        output = output.slice(0, -1);
        if (output.endsWith(",")) {
          output = output.slice(0, -1);
        }

        return new Response(output);

      } else if (goToKey) {
        const goToValue = request.query![goToKey].toLowerCase();
        for (const [property, propAliases] of <[Property, string[]][]>Object.entries(REDIRECT_PROPERTY_ALIASES)) {
          if (propAliases.includes(goToValue)) {
            const value = await getProperty({ request, emote, property });
            if (value) {
              return Response.redirect(value, 302);
            }
            break;
          }
        }
        return notFoundHandler();
      }
      return new Response(await createEmoteResponseHtml(channel, emote), {
        headers: { "Content-type": "text/html" },
      });
    } else {
      return notFoundHandler();
    }
  };
};

export async function listEmotesHandler(request: Request): Promise<Response> {
  const channelName = request.params!.channelName;

  const channel = await fetchChannel(channelName);

  if (channel === null)
    return notFoundHandler();

  const emoteLists: Array<BaseEmoteList<BaseEmote> | UnavailableEmoteList> = [];

  for (const provider of <EmoteProviderName[]>["ttv", "ffz", "bttv", "7tv"]) {
    let providerEmoteList;
    try {
      providerEmoteList = await EMOTE_PROVIDERS[provider].listChannel(channel);
    } catch (e) {
      if (provider === "ttv") {
        providerEmoteList = new TwitchEmoteList({ channel, emotes: null });
      } else {
        providerEmoteList = { err: "unavailable", provider } as UnavailableEmoteList;
      }
    }

    if (providerEmoteList === null) {
      providerEmoteList = { err: "unavailable", provider } as UnavailableEmoteList;
    }
    emoteLists.push(providerEmoteList);
  }

  return new Response(makeEmoteListHtml(channel, emoteLists), {
    headers: { "Content-type": "text/html" },
  });
}
