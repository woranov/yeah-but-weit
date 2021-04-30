import { Request } from "itty-router";

import { checkChannelName, fetchTwitchChannelId } from "../twitch";
import { BaseChannelEmote, BaseEmote, find } from "../emotes";
import { createHtml, notFoundHandler } from "./common";
import { originUrl } from "../supibot";

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
        return `@${emote.creatorDisplayName}`;
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
      return emote.imageUrl;
    case "EMOTE_INFO_PAGE_URL":
      return emote.infoUrl;
    case "EMOTE_TESTER_URL":
      return `https://emotetester.gempir.com/?emoteUrl=${encodeURIComponent(emote.imageUrl)}&resize=1`;
    case "EMOTE_CREATOR_CHANNEL_URL":
      if (emote instanceof BaseChannelEmote) {
        return `https://www.twitch.tv/${emote.creatorDisplayName.toLowerCase()}`;
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


async function createEmoteResponseHtml(emote: BaseEmote): Promise<string> {
  const emoteOrigin = await emote.getOrigin();
  let additionalSections = undefined;
  let ogDescriptionExtra = undefined;
  if (emoteOrigin) {
    const link = originUrl(emoteOrigin.ID);
    additionalSections = [
      { title: "Origin", text: `Available on <a href='${link}'>supinic.com</a>` },
    ];
    ogDescriptionExtra = "(Supibot origin available)";
  }
  return createHtml({
    title: emote.code,
    titleLink: emote.infoUrl,
    description: emote.description,
    ogDescriptionExtra,
    additionalSections,
    atMentionReplacer: (
      match, channelName,
    ) => `<a href='https://www.twitch.tv/${channelName.toLowerCase()}'>@${channelName}</a>`,
    image: {
      url: emote.imageUrl,
      alt: emote.code,
    },
  });
}


export const makeHandler = (provider: EmoteProviderName | null = null) => {
  return async (request: Request) => {
    let { channelName = null, code } = request.params!;
    let channel: Channel | null = null;

    if (channelName) {
      if (!checkChannelName(channelName)) {
        return notFoundHandler();
      }

      const channelId = await fetchTwitchChannelId(channelName);

      if (channelId === null)
        return notFoundHandler();

      channel = {
        id: channelId,
        name: channelName.toLowerCase(),
      };
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
      return new Response(await createEmoteResponseHtml(emote), {
        headers: { "Content-type": "text/html" },
      });
    } else {
      return notFoundHandler();
    }
  };
};
