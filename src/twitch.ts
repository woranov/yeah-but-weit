const CHANNEL_NAME_REGEX = /^[a-zA-Z0-9_]{4,25}$/;
const CASE_SENSITIVE_EMOTE_CODE_REGEX = /^[a-z0-9]*[A-Z0-9]\w*$/;
const CASE_INSENSITIVE_EMOTE_CODE_REGEX = /^[a-zA-Z0-9]{3,}\w+$/;


export async function fetchChannel(channel: string): Promise<ChannelWithProfilePicture | null> {
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
        name: user.name,
        displayName: user.display_name,
        profileImageUrl: user.logo,
      };
    }
  } catch (error) {
    return null;
  }
}


export function checkChannelName(channelName: string): boolean {
  return CHANNEL_NAME_REGEX.test(channelName);
}


export function checkEmoteCode({ emoteCode, caseSensitive }: {
  emoteCode: string, caseSensitive: boolean
}): boolean {
  return (
    caseSensitive
      ? CASE_SENSITIVE_EMOTE_CODE_REGEX
      : CASE_INSENSITIVE_EMOTE_CODE_REGEX
  ).test(emoteCode);
}


const ACCESS_TOKEN_KV_KEY = "_ACCESS_TOKEN";


async function getInitialAccessToken(): Promise<{ access_token: string, refresh_token: string } | { access_token: null, refresh_token: null }> {
  const response = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${TWITCH_CLIENT_ID}&client_secret=${TWITCH_CLIENT_SECRET}&grant_type=client_credentials`,
    { method: "POST" },
  );

  if (response.ok) {
    const json = await response.json();
    await EMOTES.put(ACCESS_TOKEN_KV_KEY, JSON.stringify(json));
    return json;
  } else {
    await EMOTES.put(ACCESS_TOKEN_KV_KEY, JSON.stringify({ access_token: null, refresh_token: null }));
    return { access_token: null, refresh_token: null };
  }
}


async function refreshAccessToken(): Promise<{ access_token: string, refresh_token: string } | { access_token: null, refresh_token: null }> {
  const { refresh_token: refreshToken } = (await EMOTES.get(ACCESS_TOKEN_KV_KEY, "json")) ?? { refresh_token: null };

  if (!refreshToken) {
    return { access_token: null, refresh_token: null };
  }

  const response = await fetch(
    `https://id.twitch.tv/oauth2/token?grant_type=refresh_token&refresh_token=${refreshToken}&client_id=${TWITCH_CLIENT_ID}&client_secret=${TWITCH_CLIENT_SECRET}`,
    { method: "POST" },
  );

  if (response.ok) {
    const json = await response.json();
    await EMOTES.put(ACCESS_TOKEN_KV_KEY, JSON.stringify(json));
    return json;
  } else {
    await EMOTES.put(ACCESS_TOKEN_KV_KEY, JSON.stringify({ access_token: null, refresh_token: null }));
    return { access_token: null, refresh_token: null };
  }
}


async function getToken(): Promise<{ access_token: string, refresh_token: string } | { access_token: null, refresh_token: null }> {
  let token = (<{ access_token: string, refresh_token: string } | { access_token: null, refresh_token: null }>(await EMOTES.get(ACCESS_TOKEN_KV_KEY, "json"))) ?? {
    access_token: null,
    refresh_token: null,
  };
  if (token.access_token === null) {
    return await getInitialAccessToken();
  }
  return token;
}


export async function helix(path: string): Promise<Response> {
  const makeRequest = async () => {
    const { access_token: accessToken } = await getToken();
    return await fetch(
      `https://api.twitch.tv/helix/${path}`,
      {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Client-Id": TWITCH_CLIENT_ID,
        },
      },
    );
  };

  let response = await makeRequest();
  if (!response.ok && response.status === 401) {
    await refreshAccessToken();
    response = await makeRequest();
  }

  return response;
}
