import { Router } from "itty-router";
import { createHtml, errorHandler, notFoundHandler } from "./handlers/common";
import { makeHandler } from "./handlers/emotes";
import { listTop as listTopBttvEmotes } from "./emotes/bttv";
import { clearCacheHandler } from "./handlers/clearCache";


const router = Router();

try {
  if (ADMIN_TOKEN) {
    router
      .get("/clear-cache/channel/:channelName", clearCacheHandler)
      .get("/clear-cache/:cacheKey", clearCacheHandler);
  }
} catch (e) {
  if (!(e instanceof ReferenceError)) {
    throw e;
  }
}

const anyProviderHandler = makeHandler();
const ttvHandler = makeHandler("ttv");
const bttvHandler = makeHandler("bttv");
const ffzHandler = makeHandler("ffz");

router
  .get("/418", () => {
    return new Response(createHtml({
      title: "418",
      description: "I'm a teapot",
      image: {
        url: "https://cdn.betterttv.net/emote/56f6eb647ee3e8fc6e4fe48e/3x",
        alt: "TeaTime",
      },
    }), {
      headers: { "Content-type": "text/html" },
    });
  })
  .get("/:code", anyProviderHandler)
  .get("/ttv/:code", ttvHandler)
  .get("/bttv/:code", bttvHandler)
  .get("/ffz/:code", ffzHandler)
  .get("/:channelName/:code", anyProviderHandler)
  .get("/ttv/:channelName/:code", ttvHandler)
  .get("/bttv/:channelName/:code", bttvHandler)
  .get("/ffz/:channelName/:code", ffzHandler)
  .all("*", notFoundHandler);


export async function handleRequest(request: Request): Promise<Response> {
  return router.handle(request).catch(errorHandler);
}

export async function handleScheduled(_: ScheduledEvent) {
  await listTopBttvEmotes({ force: true });
}
