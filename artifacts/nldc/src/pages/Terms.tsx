import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { absoluteUrl } from "@/lib/seo";
import { FileText, Heart, Star, AlertCircle, Ban, Mail, X, Sparkles } from "lucide-react";

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

export default function Terms() {
  useMeta(
  "Terms of Service",
  "MatchLab Club terms of service, plain English, no surprises.",
  undefined,
  { canonicalUrl: absoluteUrl("/terms") },
  );

  return (
  <AppLayout>
  <div className="container mx-auto px-4 md:px-6 py-16 max-w-3xl">
  {/* Header */}
  <div className="text-center mb-12">
  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass text-xs font-semibold text-[hsl(248_62%_62%)] border border-[hsl(248_62%_52%/0.3)] mb-6">
  <FileText className="w-3.5 h-3.5" />
  Terms of Service
  </div>
  <h1 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-4">
  Terms that actually <span className="gradient-text-violet">make sense</span>
  </h1>
  <p className="text-muted-foreground leading-relaxed max-w-xl mx-auto">
  We've written this the way we'd want to read it, clear, direct, no legalese. If anything seems unclear, email us and we'll explain it in plain English.
  </p>
  <p className="text-muted-foreground/50 text-xs mt-4">Last updated: August 24, 2026</p>
  </div>

  <div className="space-y-6">
  <Section icon={Heart} title="What MatchLab Club is (and isn't)">
  <p><strong className="text-foreground">What it is:</strong> A relationship decision companion with self-understanding tools, coaching workflows, and an optional controlled-introduction pilot. It helps you interpret information you choose to share, preserve your own record, and decide what to do next.</p>
  <p><strong className="text-foreground">What it isn't:</strong></p>
  <ul className="space-y-1.5 list-none">
  <li className="flex items-start gap-2"><span className="text-[hsl(248_62%_52%)]">→</span> Not therapy or mental health counselling</li>
  <li className="flex items-start gap-2"><span className="text-[hsl(248_62%_52%)]">→</span> Not an open dating marketplace or an on-demand supply of matches</li>
  <li className="flex items-start gap-2"><span className="text-[hsl(248_62%_52%)]">→</span> Not a guarantee of any outcome, dates, relationships, or otherwise</li>
  <li className="flex items-start gap-2"><span className="text-[hsl(248_62%_52%)]">→</span> Not a substitute for your own judgment in your relationships</li>
  </ul>
  <p>If you're working through something that feels bigger than dating, anxiety, self-worth, past trauma, we'd gently suggest talking to a therapist alongside anything you do here.</p>
  </Section>

  <Section icon={Heart} title="Controlled introductions">
  <p><strong className="text-foreground">Introductions are optional and limited.</strong> Joining the pool means you may be considered for a founder-reviewed introduction. It does not promise that a suitable person is available, that you will receive an introduction by a particular date, or that another member will say yes.</p>
  <p><strong className="text-foreground">Private decisions stay private.</strong> A candidate remains internal until an authorized founder sends it. Your response is not revealed as mutual interest unless the corresponding member response permits that next step.</p>
  <p><strong className="text-foreground">Use your own judgment.</strong> Compatibility reads and founder review are decision support, not identity, background, safety, medical, or legal verification. Follow the safety tools and report concerns, but make your own meeting and relationship decisions.</p>
  </Section>

  <Section icon={FileText} title="Your content">
  <p><strong className="text-foreground">You own what you write.</strong> When you paste your bio, prompts, or message samples into MatchLab Club, those words remain yours. Full stop.</p>
  <p><strong className="text-foreground">The limited licence.</strong> By submitting content, you give us permission to process it to generate your coaching output. That's the entire extent of the licence, we use it to help you, nothing more.</p>
  <p><strong className="text-foreground">Accuracy.</strong> Please only submit content that you created or have the right to submit. Pasting someone else's messages without their knowledge isn't something we encourage, and for any 1:1 coaching that involves a third party's private messages, please get their consent first.</p>
  </Section>

  <Section icon={Sparkles} title="The Wellness Center and your match profile">
  <p><strong className="text-foreground">Saving is not blanket permission.</strong> A new wellness answer defaults to coaching use only. Matching and research use require an explicit scope you can change later without rewriting the answer.</p>
  <p><strong className="text-foreground">Imported sources are separate too.</strong> Keeping a source, allowing Echo to process it, confirming proposed learning, and allowing derived matching use are independent choices. All downstream uses default off for a newly saved import.</p>
  <p><strong className="text-foreground">You stay in control.</strong> You can review stored data, change available permissions, delete individual records, export your account data, or transactionally delete the account.</p>
  </Section>

  <Section icon={Star} title="Our coaching output">
  <p><strong className="text-foreground">You can use it freely.</strong> The rewrites, observations, analyses, and suggestions we generate are our intellectual property, but you're fully and permanently licenced to use them for your own purposes. Copy them into your profile. Share them with people you trust. That's what they're for.</p>
  <p><strong className="text-foreground">No commercial resale.</strong> The one thing we ask: don't resell or redistribute our coaching output as your own product or service. Using the output is fine. Building a competing service on top of our output isn't.</p>
  </Section>

  <Section icon={AlertCircle} title="No guarantees on results">
  <p>Dating is genuinely complicated. We'll give you our most honest, specific, actionable coaching, and many people see real improvement in their matches, conversations, and confidence.</p>
  <p>But we can't promise a specific number of matches, specific outcomes, or that any particular approach will work for any particular person. Results vary. Dating involves other humans, and other humans are unpredictable.</p>
  <p>What we can promise: we'll be honest with you, we'll give you our best work, and we'll improve the product continuously based on what actually helps people.</p>
  </Section>

  <Section icon={Ban} title="Acceptable use">
  <p>Please don't use MatchLab Club to:</p>
  <ul className="space-y-1.5 list-none">
  <li className="flex items-start gap-2"><X className="w-4 h-4 mt-0.5 text-red-400/80 flex-shrink-0" aria-hidden="true" /> Harass, deceive, or manipulate other people</li>
  <li className="flex items-start gap-2"><X className="w-4 h-4 mt-0.5 text-red-400/80 flex-shrink-0" aria-hidden="true" /> Create fake profiles or represent yourself as someone you're not</li>
  <li className="flex items-start gap-2"><X className="w-4 h-4 mt-0.5 text-red-400/80 flex-shrink-0" aria-hidden="true" /> Submit someone else's private messages without their consent</li>
  <li className="flex items-start gap-2"><X className="w-4 h-4 mt-0.5 text-red-400/80 flex-shrink-0" aria-hidden="true" /> Automate, scrape, or spam our platform</li>
  <li className="flex items-start gap-2"><X className="w-4 h-4 mt-0.5 text-red-400/80 flex-shrink-0" aria-hidden="true" /> Violate anyone's privacy or dignity</li>
  </ul>
  <p>We built this for people who want genuine connection. Using it to manipulate or harm people is the opposite of that.</p>
  </Section>

  <Section icon={FileText} title="Subscriptions and cancellation">
  <p><strong className="text-foreground">One-time products.</strong> A Signal Audit or Dating Reset checkout is a one-time payment unless the checkout screen expressly says otherwise. A fully refunded one-time payment ends that paid entitlement.</p>
  <p><strong className="text-foreground">Monthly Wingman.</strong> When offered, Wingman renews monthly until canceled. Use Plan &amp; billing in Account to open Stripe's secure portal. End-of-period cancellation stops future renewal while paid access continues through the current period. Failed payment can suspend access; a later successful renewal can restore it.</p>
  <p><strong className="text-foreground">Refunds.</strong> Any specific refund term shown at checkout applies in addition to rights that cannot legally be waived. Otherwise, contact hello@matchlab.club for review. Refunding a subscription charge does not by itself stop future renewal; cancel the subscription separately when you want renewal to end.</p>
  <p><strong className="text-foreground">Billing and account data are separate.</strong> Canceling a subscription does not delete your MatchLab account. Use the account deletion control when you want stored account data removed. Account deletion first attempts to stop any continuing subscription renewal and does not proceed if that cannot be confirmed.</p>
  </Section>

  <Section icon={Mail} title="Changes and contact">
  <p><strong className="text-foreground">Changes to these terms.</strong> We'll email you at least 14 days before any material changes take effect, if you have an account with us. Continued use after that date means acceptance of the updated terms.</p>
  <p><strong className="text-foreground">Questions?</strong> We're real people. Email us:</p>
  <p><strong className="text-foreground">General:</strong> hello@matchlab.club</p>
  <p><strong className="text-foreground">Privacy:</strong> privacy@matchlab.club</p>
  <p className="text-muted-foreground/60 text-xs pt-2">MatchLab Club · hello@matchlab.club</p>
  </Section>
  </div>
  </div>
  </AppLayout>
  );
}
