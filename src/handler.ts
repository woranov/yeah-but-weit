import { Router } from "itty-router";
import { errorHandler, notFoundHandler } from "./handlers/common";
import { makeHandler } from "./handlers/emotes";

const router = Router();

const anyProviderHandler = makeHandler();
const ttvHandler = makeHandler("ttv");
const bttvHandler = makeHandler("bttv");
const ffzHandler = makeHandler("ffz");

router
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
