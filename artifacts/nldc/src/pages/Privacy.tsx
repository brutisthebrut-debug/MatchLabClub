import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { absoluteUrl } from "@/lib/seo";
import { Shield, Eye, Lock, Trash2, Mail, ExternalLink, Check } from "lucide-react";

const Section = ({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) => (
  <div className="glass rounded-2xl p-6 md:p-8 space-y-4">
  <div className="flex items-center gap-3">
  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[hsl(248_62%_52%)] to-[hsl(326_100%_55%)] flex items-center justify-center flex-shrink-0">
  <Icon className="w-4.5 h-4.5 text-white" />
  </div>
  <h2 className="font-serif text-xl font-bold text-foreground">{title}</h2>
  </div>
  <div className="text-muted-foreground text-sm leading-relaxed space-y-3 pl-12">{children}</div>
  </div>
);

export default function Privacy() {
  useMeta(
  "Privacy Policy",
  "How MatchLab Club handles your data, what we collect, why, and your rights. Plain English, no legal jargon.",
  undefined,
  { canonicalUrl: absoluteUrl("/privacy") },
  );

  return (
  <AppLayout>
  <div className="container mx-auto px-4 md:px-6 py-16 max-w-3xl">
  {/* Header */}
  <div className="text-center mb-12">
  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass text-xs font-semibold text-[hsl(248_62%_62%)] border border-[hsl(248_62%_52%/0.3)] mb-6">
  <Shield className="w-3.5 h-3.5" />
  Privacy Policy
  </div>
  <h1 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-4">
  Your privacy, <span className="gradient-text-violet">plainly stated</span>
  </h1>
  <p className="text-muted-foreground leading-relaxed max-w-xl mx-auto">
  You're trusting us with personal stuff, your dating profile, your messages, maybe even conversations that felt vulnerable to write. We don't take that lightly. Here's exactly how we handle it.
  </p>
  <p className="text-muted-foreground/50 text-xs mt-4">Last updated: August 24, 2026</p>
  </div>

  {/* Quick summary */}
  <div className="glass-strong rounded-2xl p-6 mb-8 border border-[hsl(248_62%_52%/0.2)]">
  <h2 className="font-semibold text-foreground mb-3">The short version</h2>
  <ul className="space-y-2 text-sm text-muted-foreground">
  <li className="flex items-start gap-2"><Check className="text-green-400 mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> You own your content. We just process it to generate your coaching.</li>
  <li className="flex items-start gap-2"><Check className="text-green-400 mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> We never sell your data. Not now, not ever.</li>
  <li className="flex items-start gap-2"><Check className="text-green-400 mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> Authorized people review content only for a service or safety workflow you deliberately enter.</li>
  <li className="flex items-start gap-2"><Check className="text-green-400 mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> You can export or transactionally delete your account from Account settings.</li>
  <li className="flex items-start gap-2"><Check className="text-green-400 mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> Integrations and downstream source uses require explicit choices and can be revoked.</li>
  </ul>
  </div>

  <div className="space-y-6">
  <Section icon={Eye} title="What we collect">
  <p><strong className="text-foreground">If you sign up or join the waitlist:</strong> your first name and email address.</p>
  <p><strong className="text-foreground">When you use the tools:</strong> the bio, prompts, or message samples you paste in. This is necessary to generate your personalised coaching output. Without it, the tool can't work.</p>
  <p><strong className="text-foreground">Your results and record:</strong> we save the reports, rewrites, observations, confirmed learnings, Journey events, and preferences needed for you to revisit your work.</p>
  <p><strong className="text-foreground">Billing state:</strong> Stripe handles card and payment details. We store limited processor identifiers, product, amount/currency when supplied, entitlement status, renewal period, cancellation/refund timestamps, and an idempotent event status. We do not store raw Stripe webhook payloads or card numbers.</p>
  <p><strong className="text-foreground">Basic usage data:</strong> which features you use, how often, which pages you visit. No advertising profiles. No resale. This helps us understand what's working so we can improve it.</p>
  </Section>

  <Section icon={Shield} title="What we do with it">
  <p><strong className="text-foreground">Generate your requested output.</strong> Content you deliberately submit is processed to produce the coaching, reflection, or compatibility read you asked for.</p>
  <p><strong className="text-foreground">Save your results.</strong> So you can come back, track progress over time, and not have to start from scratch.</p>
  <p><strong className="text-foreground">Operate controlled introductions.</strong> If you opt into matching, authorized founder operations may review internal candidates, derived compatibility summaries, and the information needed to decide whether to send an introduction. Private founder notes are not returned through member APIs.</p>
  <p><strong className="text-foreground">Contact you (only if you've signed up).</strong> If you joined the waitlist or created an account, we may send you updates about your coaching, new features, or early access offers. Every message has a clear unsubscribe link.</p>
  <p>That's it. Nothing else.</p>
  </Section>

  <Section icon={Lock} title="What we never do">
  <p><strong className="text-foreground">Sell your data.</strong> Never, to no one, under any circumstances.</p>
  <p><strong className="text-foreground">Share your content with third parties</strong> without your explicit permission, not your bio, not your messages, not your name.</p>
  <p><strong className="text-foreground">Use your content to train AI models</strong> without a clear opt-in. Your words aren't fuel for someone else's dataset.</p>
  <p><strong className="text-foreground">Profile you for advertising.</strong> We don't use your data for targeted ads, retargeting, or any ad network.</p>
  <p><strong className="text-foreground">Let people browse your personal content.</strong> Human access is limited to deliberate service workflows such as 1:1 coaching, controlled-introduction review, a report/safety investigation, or support you request. Role checks and actor logs protect founder-only routes.</p>
  </Section>

  <Section icon={ExternalLink} title="Integrations and imported sources">
  <p>MatchLab offers or previews optional calendar, receipt, profile-import, voice-metric, and other source connections. Availability varies. These are:</p>
  <ul className="space-y-1 list-none">
  <li className="flex items-start gap-2"><span className="text-[hsl(248_62%_52%)]">→</span> Entirely optional, you'll never be prompted to connect something you haven't asked for</li>
  <li className="flex items-start gap-2"><span className="text-[hsl(248_62%_52%)]">→</span> Turned on only by you, with a clear consent step before any data is read</li>
  <li className="flex items-start gap-2"><span className="text-[hsl(248_62%_52%)]">→</span> Revocable at any time from your settings</li>
  <li className="flex items-start gap-2"><span className="text-[hsl(248_62%_52%)]">→</span> Never enabled by default</li>
  </ul>
  <p>Saving a source does not authorize every downstream use. Source-level Echo processing, confirmed learning, and matching use are independent and default off. Account-level hosted-AI consent is an additional gate when a workflow can send your own content to a hosted model.</p>
  </Section>

  <Section icon={Trash2} title="Your rights">
  <p><strong className="text-foreground">Download your data.</strong> Use the export control in Account for a direct JSON export or an expiring emailed download link.</p>
  <p><strong className="text-foreground">Delete the account.</strong> Type the account email in Account settings to run the transactional deletion flow. If a recurring Stripe entitlement is still renewing, we first schedule it to stop and abort deletion if Stripe cannot confirm that action. Stripe or other processors may retain transaction records under their own legal obligations.</p>
  <p><strong className="text-foreground">Correct anything.</strong> If something we have is wrong, tell us and we'll fix it.</p>
  <p><strong className="text-foreground">Opt out of communications.</strong> Every email we send has an unsubscribe link that works immediately.</p>
  <p><strong className="text-foreground">Withdraw consent.</strong> If you've connected an integration, you can disconnect it at any time from settings. We'll stop processing that data immediately.</p>
  </Section>

  <Section icon={Mail} title="Contact & deletion requests">
  <p>For any privacy question, data request, or deletion request:</p>
  <p><strong className="text-foreground">Email:</strong> privacy@matchlab.club</p>
  <p>We'll respond as promptly as we can. The self-service export and confirmed account-deletion controls are available without waiting for support.</p>
  <p className="text-muted-foreground/60 text-xs">This policy may be updated from time to time. If you have an account, we'll email you about material changes before they take effect.</p>
  </Section>
  </div>
  </div>
  </AppLayout>
  );
}
