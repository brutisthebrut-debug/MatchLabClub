import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  Smartphone,
  ScanFace,
  IdCard,
  Check,
  Lock,
  ArrowRight,
  TrendingUp,
  Eye,
  EyeOff,
  CalendarCheck,
  RefreshCw,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@workspace/replit-auth-web";
import { useMeta } from "@/hooks/useMeta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { trackEvent } from "@/lib/analytics";
import { ReadinessClimbReveal } from "@/components/climb/ReadinessClimbReveal";
import { useReadinessClimb } from "@/hooks/useReadinessClimb";
import {
  useGetVerification,
  getGetVerificationQueryKey,
  useStartPhoneVerification,
  useCheckPhoneVerification,
  useStartIdVerification,
  useRefreshIdVerification,
  getGetMatchingStateQueryKey,
  type UserVerification,
} from "@workspace/api-client-react";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: {
    duration: 0.45,
    delay,
    ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
  },
});

// A sample badge state for signed-out visitors so the page never looks empty
// and the climb framing reads clearly before anyone signs in.
const DEMO_VERIFICATION: UserVerification = {
  phoneVerified: false,
  phoneVerifiedAt: null,
  idVerified: false,
  idVerifiedAt: null,
  ageOver18: false,
  verifiedTiers: 0,
  tierTotal: 3,
  isVerified: false,
};

type Tier = {
  id: string;
  name: string;
  icon: typeof Smartphone;
  blurb: string;
  status: "live" | "building";
};

const TIERS: Tier[] = [
  {
    id: "phone",
    name: "Phone",
    icon: Smartphone,
    blurb: "A quick one-time code confirms a real, reachable number.",
    status: "live",
  },
  {
    id: "selfie",
    name: "Selfie match",
    icon: ScanFace,
    blurb: "A live selfie check, matched to your photos. Coming next.",
    status: "building",
  },
  {
    id: "id",
    name: "Government ID and age",
    icon: IdCard,
    blurb:
      "An optional premium check that confirms a real ID and that you are 18 or older. The top trust tier.",
    status: "live",
  },
];

function TierRow({
  tier,
  cleared,
}: {
  tier: Tier;
  cleared: boolean;
}) {
  const Icon = tier.icon;
  return (
    <div className="glass border border-white/8 rounded-2xl p-4 flex items-center gap-4">
      <div
        className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
          cleared ? "bg-emerald-500/15" : "bg-primary/10"
        }`}
      >
        {cleared ? (
          <Check className="w-5 h-5 text-emerald-400" />
        ) : (
          <Icon className="w-5 h-5 text-primary" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-serif text-lg font-bold text-foreground">
            {tier.name}
          </p>
          {cleared ? (
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">
              Verified
            </span>
          ) : tier.status === "building" ? (
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
              Coming soon
            </span>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">{tier.blurb}</p>
      </div>
    </div>
  );
}

export default function Verification() {
  useMeta(
    "Get verified",
    "Confirm a real phone, selfie, or ID. Verified profiles rank higher in matching. It is never a gate, and we store the result, never your documents.",
  );

  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isDemo = !isAuthenticated;

  const { data: liveVerification } = useGetVerification({
    query: {
      queryKey: getGetVerificationQueryKey(),
      enabled: isAuthenticated,
      retry: false,
    },
  });

  const verification: UserVerification = isDemo
    ? DEMO_VERIFICATION
    : liveVerification ?? DEMO_VERIFICATION;

  const startPhone = useStartPhoneVerification();
  const checkPhone = useCheckPhoneVerification();
  const startId = useStartIdVerification();
  const refreshId = useRefreshIdVerification();
  const [idUnavailable, setIdUnavailable] = useState(false);
  const climb = useReadinessClimb({ enabled: isAuthenticated });

  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"enter" | "confirm">("enter");
  const [devHint, setDevHint] = useState<string | null>(null);

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: getGetVerificationQueryKey(),
    });
    void queryClient.invalidateQueries({
      queryKey: getGetMatchingStateQueryKey(),
    });
  };

  const tierLabel = useMemo(
    () => `${verification.verifiedTiers} of ${verification.tierTotal} tiers`,
    [verification.verifiedTiers, verification.tierTotal],
  );

  const sendCode = () => {
    if (isDemo) {
      toast({
        title: "Sign in to verify",
        description: "Create a free account to start your phone check.",
      });
      return;
    }
    if (startPhone.isPending || phone.trim().length < 5) return;
    startPhone.mutate(
      { data: { phone: phone.trim() } },
      {
        onSuccess: (res) => {
          setStep("confirm");
          trackEvent("verification_phone_start", { transport: res.transport });
          if (res.transport === "log") {
            setDevHint(
              "Dev mode: no SMS provider configured, so the code is written to the server log.",
            );
          } else {
            setDevHint(null);
          }
          toast({
            title: "Code sent",
            description: "Enter the 6-digit code to confirm your number.",
          });
        },
        onError: () => {
          toast({
            title: "Could not send code",
            description: "Check the number and try again.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const startIdCheck = () => {
    if (isDemo) {
      toast({
        title: "Sign in to verify",
        description: "Create a free account to start your ID check.",
      });
      return;
    }
    if (startId.isPending) return;
    startId.mutate(undefined, {
      onSuccess: (res) => {
        if (!res.configured) {
          setIdUnavailable(true);
          toast({
            title: "ID check is warming up",
            description:
              "This premium tier is not switched on yet. Your other tiers still count.",
          });
          return;
        }
        setIdUnavailable(false);
        trackEvent("verification_id_start", {});
        if (res.url) {
          window.location.href = res.url;
        } else {
          toast({
            title: "Could not open the ID check",
            description: "Please try again in a moment.",
            variant: "destructive",
          });
        }
      },
      onError: () => {
        toast({
          title: "Could not start the ID check",
          description: "Please try again in a moment.",
          variant: "destructive",
        });
      },
    });
  };

  const refreshIdStatus = () => {
    if (isDemo || refreshId.isPending) return;
    climb.snapshot();
    refreshId.mutate(undefined, {
      onSuccess: (res) => {
        if (!res.configured) {
          setIdUnavailable(true);
          return;
        }
        invalidate();
        if (res.verification.idVerified) {
          trackEvent("verification_id_verified", {});
          toast({
            title: "ID verified",
            description: "You reached the top trust tier.",
          });
        } else {
          toast({
            title: "Not cleared yet",
            description:
              "If you just finished, give it a moment and refresh again.",
          });
        }
      },
      onError: () => {
        toast({
          title: "Could not check status",
          description: "Please try again in a moment.",
          variant: "destructive",
        });
      },
    });
  };

  const confirmCode = () => {
    if (isDemo || checkPhone.isPending || code.trim().length < 4) return;
    climb.snapshot();
    checkPhone.mutate(
      { data: { phone: phone.trim(), code: code.trim() } },
      {
        onSuccess: (res) => {
          if (res.verified) {
            invalidate();
            setStep("enter");
            setCode("");
            setDevHint(null);
            trackEvent("verification_phone_verified", {});
            toast({
              title: "Phone verified",
              description: "Your trust tier just went up.",
            });
          } else {
            toast({
              title: "Code did not match",
              description: "Double-check the digits and try again.",
              variant: "destructive",
            });
          }
        },
        onError: () => {
          toast({
            title: "Could not confirm code",
            description: "That code did not work. Request a new one if needed.",
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <motion.div {...fadeUp(0)} className="space-y-3">
          <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-primary">
            <ShieldCheck className="w-4 h-4" />
            Trust and safety
          </div>
          <h1 className="font-serif text-4xl sm:text-5xl font-bold text-foreground">
            Get verified
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Verified profiles rank higher in matching for everyone, of every
            gender and orientation. It is a boost, never a gate, so you stay in
            the pool either way. We store only that a check cleared, never your
            documents.
          </p>
        </motion.div>

        <motion.div {...fadeUp(0.05)}>
          <Card className="glass border-white/8 overflow-hidden">
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="font-serif text-2xl">
                    Your trust climb
                  </CardTitle>
                  <CardDescription>{tierLabel} cleared</CardDescription>
                </div>
                {verification.isVerified ? (
                  <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1.5 text-sm font-bold text-emerald-400">
                    <ShieldCheck className="w-4 h-4" />
                    Verified
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-sm font-medium text-muted-foreground">
                    <Lock className="w-4 h-4" />
                    Not yet
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {isAuthenticated && climb.before !== null && (
                <ReadinessClimbReveal
                  from={climb.before}
                  to={climb.current}
                  className="mb-2"
                />
              )}
              {TIERS.map((tier) => (
                <TierRow
                  key={tier.id}
                  tier={tier}
                  cleared={
                    (tier.id === "phone" && verification.phoneVerified) ||
                    (tier.id === "id" && verification.idVerified)
                  }
                />
              ))}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div {...fadeUp(0.1)}>
          <Card className="glass border-white/8">
            <CardHeader>
              <CardTitle className="font-serif text-2xl flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-primary" />
                Phone check
              </CardTitle>
              <CardDescription>
                A one-time code confirms a real, reachable number. The number and
                code are never stored, only the result.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {verification.phoneVerified ? (
                <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                  <Check className="w-5 h-5 text-emerald-400 shrink-0" />
                  <p className="text-sm text-foreground">
                    Your phone is verified. This tier already counts toward your
                    matching boost.
                  </p>
                </div>
              ) : step === "enter" ? (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">Phone number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      inputMode="tel"
                      placeholder="+1 415 555 0123"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      autoComplete="tel"
                    />
                    <p className="text-xs text-muted-foreground">
                      Use the full number with country code.
                    </p>
                  </div>
                  <Button
                    onClick={sendCode}
                    disabled={startPhone.isPending || phone.trim().length < 5}
                    className="w-full sm:w-auto"
                  >
                    {startPhone.isPending ? "Sending..." : "Send code"}
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="code">Verification code</Label>
                    <Input
                      id="code"
                      inputMode="numeric"
                      placeholder="123456"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      autoComplete="one-time-code"
                    />
                    <p className="text-xs text-muted-foreground">
                      Sent to {phone.trim()}.
                    </p>
                    {devHint && (
                      <p className="text-xs text-amber-400/80">{devHint}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={confirmCode}
                      disabled={checkPhone.isPending || code.trim().length < 4}
                    >
                      {checkPhone.isPending ? "Confirming..." : "Confirm code"}
                      <Check className="w-4 h-4 ml-1" />
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setStep("enter");
                        setCode("");
                        setDevHint(null);
                      }}
                      disabled={checkPhone.isPending}
                    >
                      Use a different number
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div {...fadeUp(0.13)}>
          <Card className="glass border-white/8">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="font-serif text-2xl flex items-center gap-2">
                  <IdCard className="w-5 h-5 text-primary" />
                  Government ID and age
                </CardTitle>
                <span className="inline-flex items-center rounded-full bg-primary/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-primary">
                  Premium
                </span>
              </div>
              <CardDescription>
                The top trust tier. A quick photo of a government ID confirms a
                real person and that you are 18 or older. About $1.50 per check.
                Optional, and never a gate.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {verification.idVerified ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                    <Check className="w-5 h-5 text-emerald-400 shrink-0" />
                    <p className="text-sm text-foreground">
                      Your ID is verified. This is the highest trust tier and it
                      counts toward your matching boost.
                    </p>
                  </div>
                  {verification.ageOver18 && (
                    <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1.5 text-sm font-bold text-emerald-400">
                      <CalendarCheck className="w-4 h-4" />
                      18+ confirmed
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 space-y-2">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <Eye className="w-4 h-4 text-primary" />
                        What we will see
                      </div>
                      <ul className="space-y-1.5 text-xs text-muted-foreground">
                        <li>That a government ID passed the check.</li>
                        <li>That you are 18 or older.</li>
                        <li>The date the check cleared.</li>
                      </ul>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 space-y-2">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <EyeOff className="w-4 h-4 text-primary" />
                        What we will never touch
                      </div>
                      <ul className="space-y-1.5 text-xs text-muted-foreground">
                        <li>The document image or scan.</li>
                        <li>Your ID number or full date of birth.</li>
                        <li>Your address or any field on the document.</li>
                      </ul>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    The check runs with Stripe Identity. Stripe collects and
                    holds the document; we receive only the pass and over-18
                    result, never the document itself.
                  </p>
                  {idUnavailable && (
                    <div className="flex items-center gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
                      <Lock className="w-5 h-5 text-amber-400 shrink-0" />
                      <p className="text-sm text-foreground">
                        The ID tier is not switched on yet. Your phone and other
                        tiers still count toward your boost.
                      </p>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={startIdCheck}
                      disabled={startId.isPending}
                    >
                      {startId.isPending ? "Opening..." : "Start ID check"}
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={refreshIdStatus}
                      disabled={refreshId.isPending}
                    >
                      <RefreshCw className="w-4 h-4 mr-1" />
                      {refreshId.isPending ? "Checking..." : "Refresh status"}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div {...fadeUp(0.15)}>
          <Card className="glass border-white/8">
            <CardHeader>
              <CardTitle className="font-serif text-xl flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Why it helps
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                When two people are equally compatible, the verified one is
                shown first. It is a small, symmetric nudge that rewards trust
                without ever excluding anyone who has not verified.
              </p>
              <p>
                Want to see who you would meet?{" "}
                <Link
                  href="/matching"
                  className="text-primary font-medium hover:underline"
                >
                  Open matching
                </Link>
                .
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </AppLayout>
  );
}
