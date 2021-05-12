import { Request } from "itty-router";

import { checkChannelName, fetchChannel } from "../twitch";
import { BaseChannelEmote, BaseEmote, EMOTE_PROVIDERS, find } from "../emotes";
import { addLinkToAtMentionTransformer, createHtml, notFoundHandler } from "./common";
import { originUrl } from "../supibot";
import { BaseEmoteList } from "../emotes/base";
import {
  ChannelEmote as TwitchChannelEmote,
  EmoteList as TwitchEmoteList,
  TwitchEmotesApiSentIncorrect404,
} from "../emotes/ttv";
import { ChannelEmote as BttvChannelEmote } from "../emotes/bttv";


const REDIRECT_PROPERTIES = [
  "EMOTE_IMAGE_URL", "EMOTE_INFO_PAGE_URL", "EMOTE_TESTER_URL",
  "EMOTE_CREATOR_CHANNEL_URL", "EMOTE_SUPIBOT_ORIGIN_URL",
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
      <ul class='goto-channel-emotes-links'>
        ${links}
      </ul>
    `;
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
      imageUrl: emote.imageUrl(),
    },
    head: extraHead,
    html: extraHtml,
    textTransformers: [addLinkToAtMentionTransformer],
  });
}


function makeEmoteListHtml(channel: ChannelWithProfilePicture, emoteLists: BaseEmoteList<BaseEmote>[]): string {
  const totalEmoteCount = emoteLists.reduce(
    (currNum, currList) => currNum + (currList.emotes ? currList.emotes.length : 0),
    0,
  );

  const perProviderEmoteCountString = emoteLists
    .filter(emoteList => emoteList.emotes)
    .map(({ provider, emotes }) => `${emotes!.length} ${provider.toUpperCase()}`)
    .join(", ") + " Emotes";

  const makeEmoteList = (provider: EmoteProviderName, emotes: BaseEmote[]) => {
    const listItems = emotes.map(emote => `
      <li><a href='/${provider}/${channel.name.toLowerCase()}/${emote.code}' title='${emote.code} – ${emote.description}'>
        <img src='${emote.imageUrl(2)}' alt='${emote.code}'>
      </a></li>
    `).join("\n");

    return `<ul class='provider-emote-list'>${listItems}</ul>`;
  }

  const providerHtmlSections = emoteLists
    .map(emoteList => {
      const { provider, emotes, overviewUrl } = emoteList;
      if (emotes !== null) {
        let emoteList = "";
        if (provider === "ttv") {
          const t1Emotes = (<TwitchChannelEmote[]>emotes).filter(e => e.tier === 1);
          const t2Emotes = (<TwitchChannelEmote[]>emotes).filter(e => e.tier === 2);
          const t3Emotes = (<TwitchChannelEmote[]>emotes).filter(e => e.tier === 3);
          emoteList += makeEmoteList("ttv", t1Emotes);
          if (t2Emotes.length) {
            emoteList += `
              <h3>Tier 2</h3>
              ${makeEmoteList("ttv", t2Emotes)}
            `;
          }
          if (t3Emotes.length) {
            emoteList += `
              <h3>Tier 3</h3>
              ${makeEmoteList("ttv", t3Emotes)}
            `;
          }
        } else if (provider === "bttv") {
          const channelEmotes = (<BttvChannelEmote[]>emotes).filter(e => !e.isShared);
          const sharedEmotes = (<BttvChannelEmote[]>emotes).filter(e => e.isShared);
          if (channelEmotes.length) {
            emoteList += makeEmoteList("bttv", channelEmotes);
          }
          if (sharedEmotes.length) {
            emoteList += `
              <h3>Shared</h3>
              ${makeEmoteList("bttv", sharedEmotes)}
            `;
          }
        } else {
          emoteList += makeEmoteList(provider, emotes);
        }

        return `
          <h2><a href='${overviewUrl}'>${provider.toUpperCase()} (${emotes!.length})</a></h2>
          ${emoteList}
        `;
      } else {
        return `
          <h2><a href='${overviewUrl}'>${provider.toUpperCase()}</a></h2>
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
            .filter(Boolean)
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

  const emoteLists: BaseEmoteList<BaseEmote>[] = [];

  for (const provider of <EmoteProviderName[]>["ttv", "ffz", "bttv"]) {
    let providerEmoteList;
    try {
      providerEmoteList = await EMOTE_PROVIDERS[provider].listChannel(channel);
    } catch (e) {
      if (!(e instanceof TwitchEmotesApiSentIncorrect404)) {
        throw e;
      } else {
        providerEmoteList = null;
      }
    }

    if (providerEmoteList && providerEmoteList.emotes === null) {
      providerEmoteList.emotes = [];
    } else if (providerEmoteList === null) {
      providerEmoteList = new TwitchEmoteList({ channel, emotes: null });
    }
    emoteLists.push(providerEmoteList);
  }

  return new Response(makeEmoteListHtml(channel, emoteLists), {
    headers: { "Content-type": "text/html" },
  });
}
