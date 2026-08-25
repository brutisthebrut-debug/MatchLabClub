import { FlaskConical } from "lucide-react";
import { useAuth } from "@workspace/replit-auth-web";
import { isDemoAccountId } from "@/lib/demoAccount";

export function DemoAccountFlag() {
  const { user } = useAuth();
  if (!isDemoAccountId(user?.id)) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-4 left-1/2 z-[100] -translate-x-1/2 rounded-full border border-amber-400/35 bg-background/95 px-4 py-2 text-xs font-bold text-foreground shadow-lg backdrop-blur"
      role="status"
      aria-label="Demo account"
      data-testid="demo-account-flag"
    >
      <span className="flex items-center gap-2 whitespace-nowrap">
        <FlaskConical className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
        Demo account · preview data resets at sign-in
      </span>
    </div>
  );
}
