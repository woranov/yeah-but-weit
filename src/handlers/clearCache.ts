import { Request } from "itty-router";
import { notFoundHandler, okHandler, unauthorizedHandler } from "./common";
import { fetchChannel } from "../twitch";

export async function clearCacheHandler(request: Request): Promise<Response> {
  if (request.query) {
    const token = request.query.token;
    if (token && token === ADMIN_TOKEN) {
      let { channelName = null, cacheKey = null } = request.params!;
      if (channelName) {
        const channel = await fetchChannel(channelName);
        if (channel === null) {
          return notFoundHandler();
        } else {
          await Promise.all([
            `list:ttv:${channel.id}`,
            `list:bttv:${channel.id}`,
            `list:ffz:${channel.id}`,
            `list:7tv:${channel.id}`,
          ].map(key => EMOTES.delete(key)));
        }
      } else if (cacheKey) {
        await EMOTES.delete(cacheKey);
      } else {
        return notFoundHandler();
      }
      return okHandler();
    }
  }
  return unauthorizedHandler();
}
