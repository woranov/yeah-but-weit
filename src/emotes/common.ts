export function preferCaseSensitiveFind<EmoteT extends { code: string }>(
  emotes: EmoteT[], code: string,
): EmoteT | null {
  return (
      code.toLowerCase() !== code
        ? emotes.find(e => e.code === code)
        : null
    )
    ?? emotes.find(e => e.code.toLowerCase() === code.toLowerCase())
    ?? null;
}
