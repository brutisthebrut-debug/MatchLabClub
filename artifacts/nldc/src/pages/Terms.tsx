import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { FileText, Heart, Star, AlertCircle, Ban, Mail } from "lucide-react";

const Section = ({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) => (
  <div className="glass rounded-2xl p-6 md:p-8 space-y-4">
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[hsl(268_52%_68%)] to-[hsl(285_45%_55%)] flex items-center justify-center flex-shrink-0">
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
    "Next Level Dating Club terms of service — plain English, no surprises."
  );

  return (
    <AppLayout>
      <div className="container mx-auto px-4 md:px-6 py-16 max-w-3xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass text-xs font-semibold text-[hsl(268_52%_78%)] border border-[hsl(268_52%_68%/0.3)] mb-6">
            <FileText className="w-3.5 h-3.5" />
            Terms of Service
          </div>
          <h1 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-4">
            Terms that actually <span className="gradient-text-violet">make sense</span>
          </h1>
          <p className="text-muted-foreground leading-relaxed max-w-xl mx-auto">
            We've written this the way we'd want to read it — clear, direct, no legalese. If anything seems unclear, email us and we'll explain it in plain English.
          </p>
          <p className="text-muted-foreground/50 text-xs mt-4">Last updated: May 2026</p>
        </div>

        <div className="space-y-6">
          <Section icon={Heart} title="What NLDC is (and isn't)">
            <p><strong className="text-foreground">What it is:</strong> A dating coaching tool. NLDC analyses your dating profile, messages, and communication style to give you personalised, actionable coaching. Think of it as an intelligent mirror — honest feedback and a path forward.</p>
            <p><strong className="text-foreground">What it isn't:</strong></p>
            <ul className="space-y-1.5 list-none">
              <li className="flex items-start gap-2"><span className="text-[hsl(268_52%_68%)]">→</span> Not therapy or mental health counselling</li>
              <li className="flex items-start gap-2"><span className="text-[hsl(268_52%_68%)]">→</span> Not a professional matchmaking service</li>
              <li className="flex items-start gap-2"><span className="text-[hsl(268_52%_68%)]">→</span> Not a guarantee of any outcome — dates, relationships, or otherwise</li>
              <li className="flex items-start gap-2"><span className="text-[hsl(268_52%_68%)]">→</span> Not a substitute for your own judgment in your relationships</li>
            </ul>
            <p>If you're working through something that feels bigger than dating — anxiety, self-worth, past trauma — we'd gently suggest talking to a therapist alongside anything you do here.</p>
          </Section>

          <Section icon={FileText} title="Your content">
            <p><strong className="text-foreground">You own what you write.</strong> When you paste your bio, prompts, or message samples into NLDC, those words remain yours. Full stop.</p>
            <p><strong className="text-foreground">The limited licence.</strong> By submitting content, you give us permission to process it to generate your coaching output. That's the entire extent of the licence — we use it to help you, nothing more.</p>
            <p><strong className="text-foreground">Accuracy.</strong> Please only submit content that you created or have the right to submit. Pasting someone else's messages without their knowledge isn't something we encourage — and for any 1:1 coaching that involves a third party's private messages, please get their consent first.</p>
          </Section>

          <Section icon={Star} title="Our coaching output">
            <p><strong className="text-foreground">You can use it freely.</strong> The rewrites, scores, analyses, and suggestions we generate are our intellectual property — but you're fully and permanently licenced to use them for your own purposes. Copy them into your profile. Send them to your matches. Share them with friends. That's what they're for.</p>
            <p><strong className="text-foreground">No commercial resale.</strong> The one thing we ask: don't resell or redistribute our coaching output as your own product or service. Using the output is fine. Building a competing service on top of our output isn't.</p>
          </Section>

          <Section icon={AlertCircle} title="No guarantees on results">
            <p>Dating is genuinely complicated. We'll give you our most honest, specific, actionable coaching — and many people see real improvement in their matches, conversations, and confidence.</p>
            <p>But we can't promise a specific number of matches, specific outcomes, or that any particular approach will work for any particular person. Results vary. Dating involves other humans, and other humans are unpredictable.</p>
            <p>What we can promise: we'll be honest with you, we'll give you our best work, and we'll improve the product continuously based on what actually helps people.</p>
          </Section>

          <Section icon={Ban} title="Acceptable use">
            <p>Please don't use NLDC to:</p>
            <ul className="space-y-1.5 list-none">
              <li className="flex items-start gap-2"><span className="text-red-400/80">✗</span> Harass, deceive, or manipulate other people</li>
              <li className="flex items-start gap-2"><span className="text-red-400/80">✗</span> Create fake profiles or represent yourself as someone you're not</li>
              <li className="flex items-start gap-2"><span className="text-red-400/80">✗</span> Submit someone else's private messages without their consent</li>
              <li className="flex items-start gap-2"><span className="text-red-400/80">✗</span> Automate, scrape, or spam our platform</li>
              <li className="flex items-start gap-2"><span className="text-red-400/80">✗</span> Violate anyone's privacy or dignity</li>
            </ul>
            <p>We built this for people who want genuine connection. Using it to manipulate or harm people is the opposite of that.</p>
          </Section>

          <Section icon={FileText} title="Subscriptions and cancellation">
            <p><strong className="text-foreground">Monthly Wingman.</strong> Billed monthly. Cancel anytime from your account settings — no penalty, no questions. Cancellation stops future charges; any remaining time in your billing period continues until it ends.</p>
            <p><strong className="text-foreground">The Dating Reset.</strong> One-time payment. No recurring charge.</p>
            <p><strong className="text-foreground">Refunds.</strong> If you're unhappy with a purchase, email us within 14 days and we'll make it right. We'd rather earn your trust than keep your money.</p>
            <p><strong className="text-foreground">Data on cancellation.</strong> Your account data is retained for 30 days after cancellation in case you change your mind. After that, it's deleted unless you request otherwise.</p>
          </Section>

          <Section icon={Mail} title="Changes and contact">
            <p><strong className="text-foreground">Changes to these terms.</strong> We'll email you at least 14 days before any material changes take effect, if you have an account with us. Continued use after that date means acceptance of the updated terms.</p>
            <p><strong className="text-foreground">Questions?</strong> We're real people. Email us:</p>
            <p><strong className="text-foreground">General:</strong> hello@nextleveldatingclub.com</p>
            <p><strong className="text-foreground">Privacy:</strong> privacy@nextleveldatingclub.com</p>
            <p className="text-muted-foreground/60 text-xs pt-2">Next Level Dating Club · hello@nextleveldatingclub.com</p>
          </Section>
        </div>
      </div>
    </AppLayout>
  );
}
