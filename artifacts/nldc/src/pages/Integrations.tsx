import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { motion } from "framer-motion";
import { Shield, Mail, Calendar, Camera, Users, Lock, Eye, Trash2, ChevronDown, ChevronUp, CheckCircle, ArrowRight } from "lucide-react";
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
};

const INTEGRATIONS: Integration[] = [
  {
    icon: Mail,
    title: "Email / Gmail Import",
    description: "Connect your Gmail (read-only, specific labels only) to automatically analyze your dating conversation history — without manual copy-paste.",
    status: "coming_soon",
    whatWeAccess: [
      "Subject lines and message body from threads labeled 'Dating' or 'Hinge / Bumble / Tinder'",
      "Sent and received timestamps",
      "Thread participant count",
    ],
    whatWeExclude: [
      "Financial or bank-related emails",
      "Medical or health emails",
      "Work, HR, or legal threads",
      "Emails from family or friends not on dating apps",
    ],
    benefit: "Unlock automatic pattern analysis across months of conversation history — no manual pasting required.",
    previewBeforeAnalysis: true,
  },
  {
    icon: Calendar,
    title: "Calendar / Context Import",
    description: "Let us know when you have dates planned so we can prep you with personalized coaching before each one.",
    status: "coming_soon",
    whatWeAccess: [
      "Event title and time (not location or invitees)",
      "Events you choose to tag as 'date-related'",
    ],
    whatWeExclude: [
      "Work meetings and professional appointments",
      "All non-tagged events",
      "Attendee information",
    ],
    benefit: "Pre-date coaching briefs sent automatically 24 hours before each date.",
    previewBeforeAnalysis: true,
  },
  {
    icon: Camera,
    title: "Dating App Screenshot Upload",
    description: "Upload screenshots from Hinge, Bumble, or Tinder and we'll analyze your profile performance and conversation style.",
    status: "beta",
    whatWeAccess: [
      "Profile photos (analyzed for composition and quality)",
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
    description: "Optionally connect LinkedIn or Instagram (read-only) to help us understand how you present yourself online vs. on dating apps.",
    status: "coming_soon",
    whatWeAccess: [
      "Public bio / about section",
      "Profile photo (public only)",
      "Public posts you've shared (optional)",
    ],
    whatWeExclude: [
      "Private messages or DMs",
      "Connection lists or followers",
      "Account analytics or reach data",
      "Anything not publicly visible",
    ],
    benefit: "Cross-platform presence alignment — make sure who you are online matches who you are on dating apps.",
    previewBeforeAnalysis: true,
  },
];

const statusConfig: Record<IntegrationStatus, { label: string; color: string }> = {
  not_connected: { label: "Not Connected", color: "bg-secondary text-secondary-foreground" },
  coming_soon: { label: "Coming Soon", color: "bg-secondary text-muted-foreground" },
  beta: { label: "Available (Beta)", color: "bg-green-50 text-green-700 border-green-200" },
};

function IntegrationCard({ integration }: { integration: Integration }) {
  const [expanded, setExpanded] = useState(false);
  const [consented, setConsented] = useState(false);
  const [previewEnabled, setPreviewEnabled] = useState(true);
  const status = statusConfig[integration.status];

  return (
    <div className="bg-card border border-card-border rounded-3xl overflow-hidden" data-testid={`card-integration-${integration.title.toLowerCase().replace(/ /g, "-")}`}>
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center flex-shrink-0">
              <integration.icon className="w-6 h-6 text-foreground" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-foreground">{integration.title}</h3>
                <Badge className={`text-xs border ${status.color}`}>{status.label}</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed max-w-md">{integration.description}</p>
            </div>
          </div>
          {integration.status === "beta" ? (
            <Button size="sm" className="rounded-full text-xs shrink-0" disabled data-testid={`button-connect-${integration.title.split(" ")[0].toLowerCase()}`}>
              Coming Soon
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="rounded-full text-xs shrink-0" disabled>
              Coming Soon
            </Button>
          )}
        </div>
        <div className="mt-4 bg-secondary/30 rounded-xl p-3 text-sm text-foreground">
          <span className="font-medium">Benefit: </span>
          <span className="text-muted-foreground">{integration.benefit}</span>
        </div>
      </div>

      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-6 py-3 border-t border-border text-sm text-muted-foreground hover:bg-secondary/20 transition-colors"
        data-testid={`button-expand-${integration.title.split(" ")[0].toLowerCase()}`}
      >
        <span className="font-medium">Data access details & consent controls</span>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {expanded && (
        <div className="px-6 pb-6 pt-4 border-t border-border space-y-5">
          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <p className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-green-600" /> What we access
              </p>
              <ul className="space-y-1">
                {integration.whatWeAccess.map((item, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-red-500" /> What we never touch
              </p>
              <ul className="space-y-1">
                {integration.whatWeExclude.map((item, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-red-400 mt-1.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="space-y-3 border-t border-border pt-4">
            {integration.previewBeforeAnalysis && (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Eye className="w-4 h-4" /> Preview before analysis
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Review exactly what will be analyzed before we process anything</p>
                </div>
                <Switch checked={previewEnabled} onCheckedChange={setPreviewEnabled} disabled data-testid={`switch-preview-${integration.title.split(" ")[0].toLowerCase()}`} />
              </div>
            )}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Shield className="w-4 h-4" /> I consent to this analysis
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">You can revoke this consent and delete your data anytime</p>
              </div>
              <Switch checked={consented} onCheckedChange={setConsented} disabled data-testid={`switch-consent-${integration.title.split(" ")[0].toLowerCase()}`} />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button className="text-xs text-red-500 flex items-center gap-1 hover:text-red-700 transition-colors" data-testid={`button-delete-data-${integration.title.split(" ")[0].toLowerCase()}`}>
                <Trash2 className="w-3 h-3" /> Delete my data
              </button>
              <span className="text-xs text-muted-foreground">· Not connected yet</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Integrations() {
  return (
    <AppLayout>
      <div className="min-h-screen bg-background py-10 px-4">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <p className="text-sm font-medium text-muted-foreground mb-1">Future Connections</p>
            <h1 className="text-3xl font-serif font-bold text-foreground">Data Connections</h1>
            <p className="text-muted-foreground mt-2 max-w-xl">
              Connect your data sources to unlock deeper, automatic coaching insights. All integrations are opt-in, privacy-first, and built around your explicit consent.
            </p>
          </motion.div>

          {/* Privacy Promise */}
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="bg-card border border-card-border rounded-3xl p-6 mb-8"
            data-testid="card-privacy-promise"
          >
            <h2 className="font-serif font-bold text-foreground text-lg mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" /> Your Privacy Promise
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { title: "Limited scope", desc: "We only access the specific data categories you explicitly approve — nothing more." },
                { title: "Preview before analysis", desc: "See exactly what we'll analyze before we process anything. No surprises." },
                { title: "Delete anytime", desc: "One click removes your data from our systems permanently. No questions asked." },
                { title: "Never sold", desc: "Your data is never sold, shared with third parties, or used for advertising." },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3" data-testid={`privacy-point-${i}`}>
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{item.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Available Now: Email Insight Demo */}
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-primary/5 border border-primary/30 rounded-3xl p-6 mb-6 flex items-start gap-4"
          >
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Mail className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-semibold text-foreground">Email Insight Import — Available Now (Demo)</p>
                <Badge className="bg-primary text-primary-foreground text-xs">Live</Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                No email login required. Paste exported message snippets and get full communication pattern analysis. This is the privacy-first version of what full Gmail integration will look like.
              </p>
              <Button asChild size="sm" className="rounded-full" data-testid="button-try-email-insights">
                <Link href="/insights">Try Email Insights <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Link>
              </Button>
            </div>
          </motion.div>

          {/* Integration Cards */}
          <div className="space-y-4">
            {INTEGRATIONS.map((integration, i) => (
              <motion.div
                key={integration.title}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12 + i * 0.05 }}
              >
                <IntegrationCard integration={integration} />
              </motion.div>
            ))}
          </div>

          {/* Footer note */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
            className="mt-8 text-center"
          >
            <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
              Integrations are being built with a consent-first architecture. When these ship, you'll authorize each one individually, see exactly what data is accessed, and be able to revoke access at any time from this page.
            </p>
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
}
