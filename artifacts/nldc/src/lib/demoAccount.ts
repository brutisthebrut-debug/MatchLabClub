export function isDemoAccountId(userId: string | null | undefined): boolean {
  return typeof userId === "string" && userId.startsWith("dev-test-");
}
