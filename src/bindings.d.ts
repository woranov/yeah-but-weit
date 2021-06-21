export {};

declare global {
  const ADMIN_TOKEN: string | undefined;
  const TWITCH_CLIENT_ID: string;
  const TWITCH_CLIENT_SECRET: string;
  const EMOTES: KVNamespace;
}
