// Optional venue provider seam. Today the product has no maps/places key wired,
// so date ideas are built from deterministic category templates (and, when the
// account opted in, the Claude lane on top). This module is the single place a
// real provider drops in later: when a key is configured, construct the concrete
// client here and return it. Until then `getPlacesProvider()` returns null, the
// same null-when-unconfigured shape the Stripe client uses, and every caller is
// written to treat a real venue list as a nice-to-have, never a requirement. We
// never invent venue names in the deterministic baseline; only a real provider
// (or the opted-in Claude lane, which is told to stay generic) supplies specifics.

export interface PlaceSuggestion {
  name: string;
  category: string;
}

export interface PlacesProvider {
  // Resolve a few real venues near a city for a coarse category. Implementations
  // must fail soft (return an empty list) rather than throw, so a flaky upstream
  // never breaks the date-ideas endpoint.
  nearby(city: string, category: string, limit: number): Promise<PlaceSuggestion[]>;
}

function placesApiKey(): string | null {
  const raw =
    process.env.PLACES_API_KEY ??
    process.env.GOOGLE_MAPS_API_KEY ??
    process.env.MAPBOX_API_KEY ??
    null;
  if (!raw) return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// Returns a configured provider, or null when no maps key is present. Null is the
// expected, supported state today: callers fall back to template-only ideas.
export function getPlacesProvider(): PlacesProvider | null {
  const key = placesApiKey();
  if (!key) return null;
  // A concrete provider (Google Places, Mapbox, etc.) is constructed here once a
  // key exists. It is intentionally not implemented yet: shipping a half-real
  // client that silently returns nothing would be worse than an honest null, and
  // the deterministic baseline already covers the no-provider path end to end.
  return null;
}

// True when a real venue provider is wired. Surfaced so callers and tests can
// branch on configuration without reaching for env vars directly.
export function placesProviderConfigured(): boolean {
  return getPlacesProvider() !== null;
}
