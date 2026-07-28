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
  <p className="text-muted-foreground/50 text-xs mt-4">Last updated: July 2026</p>
  </div>

  {/* Quick summary */}
  <div className="glass-strong rounded-2xl p-6 mb-8 border border-[hsl(248_62%_52%/0.2)]">
  <h2 className="font-semibold text-foreground mb-3">The short version</h2>
  <ul className="space-y-2 text-sm text-muted-foreground">
  <li className="flex items-start gap-2"><Check className="text-green-400 mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> You own your content. We just process it to generate your coaching.</li>
  <li className="flex items-start gap-2"><Check className="text-green-400 mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> We never sell your data. Not now, not ever.</li>
  <li className="flex items-start gap-2"><Check className="text-green-400 mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> Saving a profile answer does not approve it for Echo, matching, or research.</li>
  <li className="flex items-start gap-2"><Check className="text-green-400 mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> You can export or delete your data directly from your Data Vault.</li>
  <li className="flex items-start gap-2"><Check className="text-green-400 mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> Optional integrations require an explicit connection and can be disconnected.</li>
  </ul>
  </div>

  <div className="space-y-6">
  <Section icon={Eye} title="What we collect">
  <p><strong className="text-foreground">If you sign up or join the waitlist:</strong> your first name and email address.</p>
  <p><strong className="text-foreground">When you use the tools:</strong> the bio, prompts, or message samples you paste in. This is necessary to generate your personalised coaching output. Without it, the tool can't work.</p>
  <p><strong className="text-foreground">Your results:</strong> we save your Signal Score, Signal Spectrum, bio rewrite, and coaching notes so you can revisit them. If you want them deleted, just ask.</p>
  <p><strong className="text-foreground">Your profile answers and permissions:</strong> we save the answers you choose to give and the purpose controls you set for Echo, Mirror, matching, and research. We also keep a content-free record of permission changes so you can audit how each answer was allowed to be used.</p>
  <p><strong className="text-foreground">Basic usage data:</strong> which features you use, how often, which pages you visit. No advertising profiles. No resale. This helps us understand what's working so we can improve it.</p>
  </Section>

  <Section icon={Shield} title="What we do with it">
  <p><strong className="text-foreground">Generate your coaching output.</strong> Your bio goes in, your personalised rewrite and Signal Score come out. That's the whole point.</p>
  <p><strong className="text-foreground">Save your results.</strong> So you can come back, track progress over time, and not have to start from scratch.</p>
  <p><strong className="text-foreground">Use profile answers only for approved purposes.</strong> An answer may be stored without being available to Echo or matching. Research use is separate and optional.</p>
  <p><strong className="text-foreground">Contact you (only if you've signed up).</strong> If you joined the waitlist or created an account, we may send you updates about your coaching, new features, or early access offers. Every message has a clear unsubscribe link.</p>
  <p>That's it. Nothing else.</p>
  </Section>

  <Section icon={Lock} title="What we never do">
  <p><strong className="text-foreground">Sell your data.</strong> Never, to no one, under any circumstances.</p>
  <p><strong className="text-foreground">Share your content with third parties</strong> without your explicit permission, not your bio, not your messages, not your name.</p>
  <p><strong className="text-foreground">Use your content to train AI models</strong> without a clear opt-in. Your words aren't fuel for someone else's dataset.</p>
  <p><strong className="text-foreground">Profile you for advertising.</strong> We don't use your data for targeted ads, retargeting, or any ad network.</p>
  <p><strong className="text-foreground">Routinely read your personal content.</strong> Automated analysis is the default. A person may access content only when you explicitly request human help, when a safety report requires review, or when access is legally required. Access should be limited to what that task needs.</p>
  </Section>

  <Section icon={ExternalLink} title="Optional integrations">
  <p>MatchLab Club may offer optional connections to calendars, wellness services, or other accounts for deeper context. These are:</p>
  <ul className="space-y-1 list-none">
  <li className="flex items-start gap-2"><span className="text-[hsl(248_62%_52%)]">→</span> Entirely optional, you'll never be prompted to connect something you haven't asked for</li>
  <li className="flex items-start gap-2"><span className="text-[hsl(248_62%_52%)]">→</span> Turned on only by you, with a clear consent step before any data is read</li>
  <li className="flex items-start gap-2"><span className="text-[hsl(248_62%_52%)]">→</span> Revocable at any time from your settings</li>
  <li className="flex items-start gap-2"><span className="text-[hsl(248_62%_52%)]">→</span> Never enabled by default</li>
  </ul>
  <p>When an integration is enabled, we access only what's needed for the specific feature you've turned on. We read the minimum. We never write to your accounts without explicit confirmation.</p>
  </Section>

  <Section icon={Trash2} title="Your rights">
  <p><strong className="text-foreground">Download your data.</strong> Use the Data Vault to download your export immediately or request a single-use email link.</p>
  <p><strong className="text-foreground">Delete everything.</strong> Use the Data Vault to permanently delete your account and user-scoped data. You can also contact us if you cannot access the in-product control.</p>
  <p><strong className="text-foreground">Correct anything.</strong> If something we have is wrong, tell us and we'll fix it.</p>
  <p><strong className="text-foreground">Opt out of communications.</strong> Every email we send has an unsubscribe link that works immediately.</p>
  <p><strong className="text-foreground">Withdraw consent.</strong> If you've connected an integration, you can disconnect it at any time from settings. We'll stop processing that data immediately.</p>
  </Section>

  <Section icon={Mail} title="Contact & deletion requests">
  <p>For any privacy question, data request, or deletion request:</p>
  <p><strong className="text-foreground">Email:</strong> privacy@matchlab.club</p>
  <p>We'll respond within 2 business days. Deletion requests are completed within 48 hours of confirmation.</p>
  <p className="text-muted-foreground/60 text-xs">This policy may be updated from time to time. If you have an account, we'll email you about material changes before they take effect.</p>
  </Section>
  </div>
  </div>
  </AppLayout>
  );
}
