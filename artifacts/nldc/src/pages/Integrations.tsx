import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { motion } from "framer-motion";
import {
  Shield, Mail, Calendar, Camera, Users, Lock, Eye, Trash2,
  ChevronDown, ChevronUp, CheckCircle, ArrowRight, Brain,
  BarChart3, Sparkles, Globe, Clock, Map
} from "lucide-react";
import { Link } from "wouter";

type IntegrationStatus = "not_connected" | "coming_soon" | "beta";

type Integration = {
  icon: typeof Mail;
  title: string;
  description: string;
  status: IntegrationStatus;
  whatWeAccess: string[];
  whatWeExclude: string[];
  benefit: string;
  previewBeforeAnalysis: boolean;
  level: number;
};

const INTEGRATIONS: Integration[] = [
  {
    icon: Mail,
    title: "Email / Gmail Import",
    description: "Connect Gmail (read-only, specific labels only) to automatically analyse your dating conversation history — without manual copy-paste.",
    status: "coming_soon",
    level: 3,
    whatWeAccess: [
      "Subject lines and message body from threads labelled 'Dating' or 'Hinge / Bumble / Tinder'",
      "Sent and received timestamps",
      "Thread participant count",
    ],
    whatWeExclude: [
      "Financial or bank-related emails",
      "Medical or health emails",
      "Work, HR, or legal threads",
      "Emails from family or friends not on dating apps",
    ],
    benefit: "Automatic pattern analysis across months of conversation history — no manual pasting required.",
    previewBeforeAnalysis: true,
  },
  {
    icon: Calendar,
    title: "Calendar / Context Import",
    description: "Let us know when you have dates planned so we can prep you with personalised coaching briefs before each one.",
    status: "coming_soon",
    level: 3,
    whatWeAccess: [
      "Event title and time only (not location or invitees)",
      "Events you explicitly tag as 'date-related'",
    ],
    whatWeExclude: [
      "Work meetings and professional appointments",
      "All non-tagged events",
      "Attendee information and location details",
    ],
    benefit: "Pre-date coaching briefs sent automatically 24 hours before each date.",
    previewBeforeAnalysis: true,
  },
  {
    icon: Camera,
    title: "Dating App Screenshot Upload",
    description: "Upload screenshots from Hinge, Bumble, or Tinder. We analyse your profile performance and conversation style from what you choose to share.",
    status: "beta",
    level: 2,
    whatWeAccess: [
      "Profile photos (analysed for composition and quality)",
      "Bio and prompt text visible in screenshots",
      "Conversation screenshots you choose to upload",
    ],
    whatWeExclude: [
      "Personal contacts or phone data",
      "App metadata or account information",
      "Any data you don't explicitly select and upload",
    ],
    benefit: "Profile performance analysis without API access — upload what you want, nothing more.",
    previewBeforeAnalysis: false,
  },
  {
    icon: Users,
    title: "Social Profile Import",
    description: "Optionally connect LinkedIn or Instagram (read-only) to analyse how you present yourself online vs. on dating apps.",
    status: "coming_soon",
    level: 3,
    whatWeAccess: [
      "Public bio / about section only",
      "Profile photo (public-facing only)",
      "Public posts you've already shared",
    ],
    whatWeExclude: [
      "Private messages or DMs",
      "Connection lists or followers",
      "Account analytics or reach data",
      "Anything not already publicly visible",
    ],
    benefit: "Cross-platform presence alignment — make sure who you are online matches who you are on dating apps.",
    previewBeforeAnalysis: true,
  },
];

const STATUS_CONFIG: Record<IntegrationStatus, { label: string; color: string; bg: string; border: string }> = {
  not_connected: { label: "Not Connected", color: "hsl(228 18% 55%)", bg: "hsl(232 28% 16%)", border: "hsl(232 28% 22%)" },
  coming_soon:   { label: "Coming Soon",   color: "hsl(268 52% 72%)", bg: "hsl(268 52% 68% / 0.1)", border: "hsl(268 52% 68% / 0.25)" },
  beta:          { label: "Beta — Available", color: "hsl(142 55% 62%)", bg: "hsl(142 55% 45% / 0.1)", border: "hsl(142 55% 45% / 0.25)" },
};

const LEVEL_COLORS: Record<number, string> = {
  2: "hsl(268 52% 72%)",
  3: "hsl(43 65% 65%)",
  4: "hsl(285 45% 65%)",
};

function IntegrationCard({ integration }: { integration: Integration }) {
  const [expanded, setExpanded] = useState(false);
  const [consented, setConsented] = useState(false);
  const [previewEnabled, setPreviewEnabled] = useState(true);
  const status = STATUS_CONFIG[integration.status];
  const lvlColor = LEVEL_COLORS[integration.level] || "hsl(268 52% 68%)";

  return (
    <div
      className="glass rounded-3xl overflow-hidden transition-all"
      style={{ borderColor: `${lvlColor.replace(")", " / 0.15)")}`, borderWidth: "1px", borderStyle: "solid" }}
      data-testid={`card-integration-${integration.title.toLowerCase().replace(/ /g, "-")}`}
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: `${lvlColor.replace(")", " / 0.1)")}`, border: `1px solid ${lvlColor.replace(")", " / 0.2)")}` }}>
              <integration.icon className="w-6 h-6" style={{ color: lvlColor }} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h3 className="font-semibold text-foreground">{integration.title}</h3>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full" style={{ background: status.bg, color: status.color, border: `1px solid ${status.border}` }}>{status.label}</span>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[hsl(232_28%_16%)] text-muted-foreground border border-white/6">Level {integration.level}</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-md">{integration.description}</p>
            </div>
          </div>
          <Button size="sm" disabled className="rounded-full text-xs flex-shrink-0 border border-white/8 text-muted-foreground bg-transparent">
            Coming Soon
          </Button>
        </div>
        <div className="mt-4 rounded-xl p-3 text-sm" style={{ background: `${lvlColor.replace(")", " / 0.07)")}`, border: `1px solid ${lvlColor.replace(")", " / 0.15)")}` }}>
          <span className="font-semibold text-foreground/80">Benefit: </span>
          <span className="text-muted-foreground">{integration.benefit}</span>
        </div>
      </div>

      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-6 py-3 border-t border-white/6 text-sm text-muted-foreground hover:bg-white/2 transition-colors"
        data-testid={`button-expand-${integration.title.split(" ")[0].toLowerCase()}`}
      >
        <span className="font-medium text-xs uppercase tracking-wider">Data access details & consent controls</span>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {expanded && (
        <div className="px-6 pb-7 pt-5 border-t border-white/6 space-y-5">
          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-[hsl(142_55%_60%)]" /> What we access
              </p>
              <ul className="space-y-2">
                {integration.whatWeAccess.map((item, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[hsl(142_55%_60%)] mt-1.5 flex-shrink-0" />{item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-[hsl(348_55%_65%)]" /> What we never touch
              </p>
              <ul className="space-y-2">
                {integration.whatWeExclude.map((item, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[hsl(348_55%_65%)] mt-1.5 flex-shrink-0" />{item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="space-y-3 border-t border-white/6 pt-5">
            {integration.previewBeforeAnalysis && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Eye className="w-4 h-4 text-[hsl(268_52%_68%)]" /> Preview before analysis
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Review exactly what will be analysed before we process anything</p>
                </div>
                <Switch checked={previewEnabled} onCheckedChange={setPreviewEnabled} disabled data-testid={`switch-preview-${integration.title.split(" ")[0].toLowerCase()}`} />
              </div>
            )}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[hsl(268_52%_68%)]" /> I consent to this analysis
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">You can revoke this consent and delete your data anytime</p>
              </div>
              <Switch checked={consented} onCheckedChange={setConsented} disabled data-testid={`switch-consent-${integration.title.split(" ")[0].toLowerCase()}`} />
            </div>
            <div className="flex items-center gap-3 pt-1">
              <button className="text-xs text-[hsl(348_55%_65%)] flex items-center gap-1.5 hover:opacity-80 transition-opacity" data-testid={`button-delete-data-${integration.title.split(" ")[0].toLowerCase()}`}>
                <Trash2 className="w-3.5 h-3.5" /> Delete my data
              </button>
              <span className="text-xs text-muted-foreground">· Not connected yet</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

export default function Integrations() {
  useMeta("Integrations", "Manage your connected apps and privacy controls — Gmail, Calendar, screenshot upload, and more. Always consent-first.");
  return (
    <AppLayout>
      <div className="min-h-screen mesh-bg py-10 px-4">
        <div className="orb orb-violet fixed w-[400px] h-[400px] -top-20 -right-20 opacity-40 pointer-events-none" />
        <div className="orb orb-gold fixed w-[300px] h-[300px] bottom-20 -left-20 opacity-30 pointer-events-none" />

        <div className="max-w-3xl mx-auto relative z-10">
          {/* Header */}
          <motion.div {...fadeUp(0)} className="mb-8">
            <p className="text-sm font-medium text-muted-foreground mb-1">Consent-First Architecture</p>
            <h1 className="text-3xl font-bold text-foreground">Data Connections</h1>
            <p className="text-muted-foreground mt-2 max-w-xl leading-relaxed">
              Connect data sources to unlock deeper, automatic coaching insights. Every integration is opt-in, previewed before analysis, and permanently revocable — one switch, one source at a time.
            </p>
          </motion.div>

          {/* Privacy Promise */}
          <motion.div {...fadeUp(0.05)} className="glass border border-white/8 rounded-3xl p-6 mb-7" data-testid="card-privacy-promise">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[hsl(268_52%_68%/0.12)] border border-[hsl(268_52%_68%/0.2)]">
                <Shield className="w-5 h-5 text-[hsl(268_52%_68%)]" />
              </div>
              <h2 className="font-bold text-foreground">Your Privacy Promise</h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { title: "Preview before analysis", desc: "See exactly what we'll process before we touch it — line by line." },
                { title: "Per-source consent", desc: "Approving one source never implies approval for another. Each switch is separate." },
                { title: "Delete everything, permanently", desc: "One click removes your data from our systems. No 30-day hold. No loopholes." },
                { title: "Never sold, never shared", desc: "Your raw data is never sold to data brokers, advertisers, or third parties." },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3" data-testid={`privacy-point-${i}`}>
                  <CheckCircle className="w-4 h-4 text-[hsl(142_55%_60%)] flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{item.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Available Now: Email Insight Demo */}
          <motion.div {...fadeUp(0.1)} className="rounded-3xl p-6 mb-7 flex items-start gap-4" style={{ background: "hsl(268 52% 68% / 0.08)", border: "1px solid hsl(268 52% 68% / 0.25)" }}>
            <div className="w-10 h-10 rounded-xl bg-[hsl(268_52%_68%/0.15)] flex items-center justify-center flex-shrink-0 border border-[hsl(268_52%_68%/0.2)]">
              <Mail className="w-5 h-5 text-[hsl(268_52%_68%)]" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <p className="font-semibold text-foreground">Email Insight Import — Available Now (Demo)</p>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[hsl(142_55%_45%/0.15)] text-[hsl(142_55%_62%)] border border-[hsl(142_55%_45%/0.3)]">Live</span>
              </div>
              <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
                No email login required. Paste exported message snippets and get full communication pattern analysis. This is the privacy-first version of what full Gmail integration will look like.
              </p>
              <Button asChild size="sm" className="rounded-full bg-gradient-to-r from-[hsl(268_52%_65%)] to-[hsl(285_45%_58%)] border-0 font-semibold" data-testid="button-try-email-insights">
                <Link href="/insights">Try Email Insights <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Link>
              </Button>
            </div>
          </motion.div>

          {/* Integration Cards */}
          <div className="space-y-4 mb-10">
            {INTEGRATIONS.map((integration, i) => (
              <motion.div key={integration.title} {...fadeUp(0.12 + i * 0.05)}>
                <IntegrationCard integration={integration} />
              </motion.div>
            ))}
          </div>

          {/* Future Roadmap Section */}
          <motion.div {...fadeUp(0.32)} className="glass border border-white/8 rounded-3xl p-8 mb-7">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[hsl(43_65%_62%/0.12)] border border-[hsl(43_65%_62%/0.2)]">
                <Clock className="w-5 h-5 text-[hsl(43_65%_65%)]" />
              </div>
              <div>
                <p className="font-bold text-foreground">Future Integration Roadmap</p>
                <p className="text-xs text-muted-foreground">Planned for Levels 3–5 of the platform</p>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { icon: Brain, level: 4, title: "Personal Intelligence Layer", desc: "A private, encrypted profile mapping your communication style, dating patterns, confidence blockers, and mismatch risks — seen only by you.", status: "Phase 3" },
                { icon: Globe, level: 5, title: "Aggregate Insight Engine", desc: "Anonymised trend benchmarks and coaching reports — built only on opted-in, non-identifiable patterns. No individual data, ever.", status: "Vision" },
                { icon: BarChart3, level: 3, title: "Dating App Export Analysis", desc: "Where apps allow it, import your conversation and match history directly for the deepest pattern analysis possible.", status: "Roadmap" },
                { icon: Users, level: 3, title: "Multi-Platform Presence Sync", desc: "Cross-platform analysis of how you present on Hinge, LinkedIn, and Instagram — and whether they're telling the same story.", status: "Roadmap" },
              ].map((future, i) => {
                const col = LEVEL_COLORS[future.level] || "hsl(268 52% 68%)";
                return (
                  <div key={i} className="rounded-2xl p-5" style={{ background: `${col.replace(")", " / 0.06)")}`, border: `1px solid ${col.replace(")", " / 0.15)")}` }}>
                    <div className="flex items-start gap-3 mb-2">
                      <future.icon className="w-4.5 h-4.5 flex-shrink-0 mt-0.5" style={{ color: col }} />
                      <div>
                        <p className="text-sm font-semibold text-foreground">{future.title}</p>
                        <span className="text-xs font-medium" style={{ color: col }}>Level {future.level} · {future.status}</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{future.desc}</p>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* View Full Roadmap CTA */}
          <motion.div
            {...fadeUp(0.38)}
            className="relative rounded-3xl p-7 text-center overflow-hidden"
            style={{ background: "linear-gradient(135deg, hsl(268 52% 68% / 0.1), hsl(285 45% 60% / 0.07))", border: "1px solid hsl(268 52% 68% / 0.2)" }}
          >
            <div className="orb orb-violet absolute w-52 h-52 -right-16 -top-16 opacity-60 pointer-events-none" />
            <div className="relative z-10">
              <Map className="w-8 h-8 text-[hsl(268_52%_68%)] mx-auto mb-3" />
              <h3 className="font-bold text-foreground mb-2">See the full 5-Level platform vision</h3>
              <p className="text-sm text-muted-foreground mb-5 max-w-md mx-auto leading-relaxed">
                The integrations roadmap is one piece of a larger consent-based intelligence platform. See all five levels — from free audit to private personal intelligence to aggregate insights.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button asChild className="rounded-full bg-gradient-to-r from-[hsl(268_52%_65%)] to-[hsl(285_45%_58%)] border-0 font-semibold glow-pulse" data-testid="button-view-roadmap">
                  <Link href="/roadmap">View Platform Roadmap <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
                <Button asChild variant="ghost" className="rounded-full border border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/5">
                  <Link href="/waitlist">Join Waitlist for Early Access</Link>
                </Button>
              </div>
            </div>
          </motion.div>

          {/* Footer note */}
          <motion.div {...fadeUp(0.42)} className="mt-7 text-center">
            <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
              All integrations are built with a consent-first architecture. When these ship, you'll authorise each one individually, see exactly what data is accessed, and revoke access instantly from this page.
            </p>
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
}
