import { Request } from "itty-router";

import { fetchTwitchChannelId } from "../twitch";
import { BaseEmote, find } from "../emotes";
import { createHtml, notFoundHandler } from "./common";


function createEmoteResponseHtml(emote: BaseEmote): string {
  return createHtml({
    title: emote.code,
    titleLink: emote.infoUrl,
    description: emote.description,
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

    if (emote) {
      if (request.query) {
        const goToKey = Object.keys(request.query).find(
          k => k.toLowerCase() === "goto",
        );
        if (goToKey) {
          switch (request.query[goToKey].toLowerCase()) {
            case "image":
            case "file":
            case "dl":
              return Response.redirect(emote.imageUrl, 302);
            case "info":
            case "page":
              return Response.redirect(emote.infoUrl, 302);
          }
        }
      }
      return new Response(createEmoteResponseHtml(emote), {
        headers: { "Content-type": "text/html" },
      });
    } else {
      return notFoundHandler();
    }
  };
};
