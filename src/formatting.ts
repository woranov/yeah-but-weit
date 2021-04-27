const THIN_SPACE = " ";

export function formatNumber(n: number): string {
  return n.toLocaleString("en-US").replace(",", THIN_SPACE);
}

export function pluralize(text: string, num: number) {
  return text + (num !== 1 ? "s" : "");
}
