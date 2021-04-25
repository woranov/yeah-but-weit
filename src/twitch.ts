export async function fetchTwitchChannelId(
  channel: string,
): Promise<number | null> {
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
      return (await response.json()).users[0]._id;
    }
  } catch (error) {
    return null;
  }
}