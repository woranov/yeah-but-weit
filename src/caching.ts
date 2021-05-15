interface ToStringable {
  toString(radix?: number): string;
}


export default async function cached<T extends ToStringable | null>(
  namespace: KVNamespace,
  key: string,
  fun: () => Promise<T>,
  {
    type = "json",
    forceRefresh = false,
    ...putOptions
  }: {
    type?: "json" | "text",
    forceRefresh?: boolean,
    [_: string]: any,
  } = {},
): Promise<T> {
  let data = forceRefresh
    ? null
    : <T | null>(
      // yes, this ternary is required to appease the type checker
      type === "json"
        ? await namespace.get(key, "json")
        : await namespace.get(key, "text")
    );

  if (!data) {
    data = await fun();

    if (data !== null) {
      await namespace.put(
        key,
        type === "json"
          ? JSON.stringify(data)
          : (<ToStringable>data).toString(),
        putOptions,
      );
    }
  }

  return data;
}