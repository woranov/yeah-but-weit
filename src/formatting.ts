const THIN_SPACE = " ";

export function formatNumber(n: number): string {
  return n.toLocaleString("en-US").replace(",", THIN_SPACE);
}
