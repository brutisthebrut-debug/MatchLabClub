import { Redirect } from "wouter";

export default function Checkout({ product }: { product?: string }) {
  const legacyOffer = product ? encodeURIComponent(product) : "legacy";
  return <Redirect to={`/pricing?from=${legacyOffer}`} />;
}
