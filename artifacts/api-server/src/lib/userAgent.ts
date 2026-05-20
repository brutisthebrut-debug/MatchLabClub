export function describeUserAgent(ua: string | null | undefined): string | null {
  if (!ua) return null;
  const lower = ua.toLowerCase();
  let browser = "Browser";
  if (lower.includes("firefox/")) browser = "Firefox";
  else if (lower.includes("edg/")) browser = "Edge";
  else if (lower.includes("chrome/")) browser = "Chrome";
  else if (lower.includes("safari/")) browser = "Safari";
  let os = "Unknown OS";
  if (lower.includes("windows")) os = "Windows";
  else if (lower.includes("mac os x") || lower.includes("macintosh"))
    os = "macOS";
  else if (lower.includes("iphone") || lower.includes("ipad")) os = "iOS";
  else if (lower.includes("android")) os = "Android";
  else if (lower.includes("linux")) os = "Linux";
  return `${browser} on ${os}`;
}
