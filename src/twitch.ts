const CHANNEL_NAME_REGEX = /^[a-zA-Z0-9_]{4,25}$/;
const CASE_SENSITIVE_EMOTE_CODE_REGEX = /^[a-z0-9]{3,}[A-Z0-9]\w*$/;
const CASE_INSENSITIVE_EMOTE_CODE_REGEX = /^[a-zA-Z0-9]{3,}\w+$/;


async function fetchChannel(channel: string): Promise<Channel | null> {
  try {
    const response = await fetch(
      `https://api.twitch.tv/kraken/users?login=${channel.toLowerCase()}`,
      {
        headers: {
          "Accept": "application/vnd.twitchtv.v5+json",
          "Client-ID": TWITCH_CLIENT_ID,
        },
      },
    );
    if (!response.ok) {
      return null;
    } else {
      const user = (await response.json()).users[0];
      return {
        id: user._id,
        name: user.display_name,
        profileImageUrl: user.logo,
      };
    }
  } catch (error) {
    return null;
  }
}


function checkChannelName(channelName: string): boolean {
  return CHANNEL_NAME_REGEX.test(channelName);
}


function checkEmoteCode({ emoteCode, caseSensitive }: {
  emoteCode: string, caseSensitive: boolean
}): boolean {
  return (
    caseSensitive
      ? CASE_SENSITIVE_EMOTE_CODE_REGEX
      : CASE_INSENSITIVE_EMOTE_CODE_REGEX
  ).test(emoteCode);
}


export { fetchChannel, checkChannelName, checkEmoteCode };
