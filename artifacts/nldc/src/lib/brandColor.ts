export function withAlpha(color: string, alpha: number): string {
  if (typeof color !== "string") return color;
  const m = color.match(/^\s*hsl\(\s*([\s\S]+?)\s*\)\s*$/i);
  if (!m) return color;
  const inner = m[1].split("/")[0].trim();
  return `hsl(${inner} / ${alpha})`;
}
