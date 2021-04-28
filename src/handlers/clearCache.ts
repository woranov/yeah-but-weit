import { Request } from "itty-router";
import { notFoundHandler, okHandler, unauthorizedHandler } from "./common";
import { fetchTwitchChannelId } from "../twitch";

export async function clearCacheHandler(request: Request): Promise<Response> {
  if (request.query) {
    const token = request.query.token;
    if (token && token === ADMIN_TOKEN) {
      let { channelName = null, cacheKey = null } = request.params!;
      if (channelName) {
        const channelId = await fetchTwitchChannelId(channelName);
        if (channelId === null) {
          return notFoundHandler();
        } else {
          await Promise.all([
            `list:ttv:${channelId}`,
            `list:bttv:${channelId}`,
            `list:ffz:${channelId}`,
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
