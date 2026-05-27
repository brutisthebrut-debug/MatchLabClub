import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { motion } from "framer-motion";
import { Clock, ArrowRight, BookOpen, Sparkles } from "lucide-react";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] as const },
});

export interface Article {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  readMin: number;
  date: string;
  color: string;
}

export const ARTICLES: Article[] = [
  {
    slug: "what-your-dating-profile-is-actually-communicating",
    title: "What Your Dating Profile Is Actually Communicating (And Why It's Not What You Think)",
    excerpt: "Your bio says you love hiking and good coffee. But what it's communicating is something entirely different — and that gap is exactly why you're not getting the matches you want.",
    category: "Profile Science",
    readMin: 7,
    date: "May 2026",
    color: "hsl(268 52% 68%)",
  },
  {
    slug: "the-science-of-message-coaching",
    title: "The Science Behind Why Some Messages Get Replies and Others Don't",
    excerpt: "Researchers have analysed millions of dating app conversations. The patterns are surprisingly consistent — and almost none of them are about being clever or funny.",
    category: "Message Coaching",
    readMin: 8,
    date: "May 2026",
    color: "hsl(190 75% 50%)",
  },
  {
    slug: "red-flags-in-your-own-profile",
    title: "The 7 Subtle Red Flags in Your Own Profile You Can't See Yourself",
    excerpt: "These aren't the obvious ones. They're the quiet signals that make someone feel vaguely uneasy and swipe left before they can even articulate why.",
    category: "Profile Audit",
    readMin: 6,
    date: "April 2026",
    color: "hsl(348 55% 65%)",
  },
  {
    slug: "photo-psychology-dating-apps",
    title: "Photo Psychology: What Your Dating App Photos Are Really Saying",
    excerpt: "Photo order, solo vs. group shots, eye contact, smile type — every choice in your photo lineup sends a signal. Here's what the research actually says.",
    category: "Photo Psychology",
    readMin: 9,
    date: "April 2026",
    color: "hsl(43 65% 65%)",
  },
];

export default function Blog() {
  useMeta(
    "Dating Coaching Blog",
    "Evidence-based articles on dating profile science, message coaching, photo psychology, and communication patterns. From MatchLab Club.",
  );

  return (
    <AppLayout>
      <div className="min-h-screen mesh-bg">
        <div className="orb orb-violet fixed w-[500px] h-[500px] -top-40 -right-40 opacity-30 pointer-events-none" />
        <div className="orb orb-gold fixed w-[300px] h-[300px] bottom-0 -left-20 opacity-20 pointer-events-none" />

        <div className="container mx-auto px-4 md:px-6 py-20 max-w-4xl relative z-10">

          {/* Header */}
          <motion.div {...fadeUp(0)} className="mb-14">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass border border-[hsl(268_52%_68%/0.25)] text-xs font-semibold uppercase tracking-widest text-[hsl(268_60%_82%)] mb-6">
              <BookOpen className="w-3.5 h-3.5" /> The MatchLab Journal
            </div>
            <h1 className="font-serif text-4xl md:text-5xl font-bold text-foreground mb-4">
              Dating smarter starts with <span className="gradient-text-violet">understanding the signals.</span>
            </h1>
            <p className="text-muted-foreground text-lg leading-relaxed max-w-2xl">
              Evidence-based articles on what actually works in dating — profile science, message psychology, photo research, and communication patterns. No fluff.
            </p>
          </motion.div>

          {/* Featured article */}
          <motion.div {...fadeUp(0.08)} className="mb-10">
            <Link href={`/blog/${ARTICLES[0]!.slug}`}>
              <div className="glass border border-[hsl(268_52%_68%/0.2)] rounded-3xl p-8 md:p-10 hover:bg-white/3 transition-colors group cursor-pointer">
                <div className="flex items-center gap-3 mb-4 flex-wrap">
                  <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: "hsl(268 52% 68% / 0.12)", color: "hsl(268 52% 78%)", border: "1px solid hsl(268 52% 68% / 0.25)" }}>
                    {ARTICLES[0]!.category}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-[hsl(268_52%_68%/0.12)] border border-[hsl(268_52%_68%/0.2)] text-[hsl(268_52%_78%)]">
                    <Sparkles className="w-3 h-3" /> Featured
                  </span>
                </div>
                <h2 className="font-serif text-2xl md:text-3xl font-bold text-foreground mb-4 leading-snug group-hover:text-[hsl(268_52%_82%)] transition-colors">
                  {ARTICLES[0]!.title}
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-6 max-w-2xl">
                  {ARTICLES[0]!.excerpt}
                </p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground/50">
                  <span className="flex items-center gap-1.5"><Clock className="w-3 h-3" /> {ARTICLES[0]!.readMin} min read</span>
                  <span>{ARTICLES[0]!.date}</span>
                  <span className="ml-auto text-[hsl(268_52%_78%)] font-semibold flex items-center gap-1 group-hover:gap-2 transition-all">
                    Read article <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            </Link>
          </motion.div>

          {/* Article grid */}
          <div className="grid md:grid-cols-3 gap-5">
            {ARTICLES.slice(1).map((article, i) => (
              <motion.div key={article.slug} {...fadeUp(0.14 + i * 0.05)}>
                <Link href={`/blog/${article.slug}`}>
                  <div className="glass rounded-2xl p-6 h-full hover:bg-white/3 transition-colors group cursor-pointer flex flex-col"
                    style={{ borderColor: `${article.color.replace(")", " / 0.15)")}`, borderWidth: "1px", borderStyle: "solid" }}>
                    <span className="text-[10px] font-bold uppercase tracking-widest mb-3 flex-shrink-0" style={{ color: article.color }}>
                      {article.category}
                    </span>
                    <h3 className="font-serif text-base font-bold text-foreground mb-3 leading-snug group-hover:text-[hsl(268_52%_82%)] transition-colors flex-1">
                      {article.title}
                    </h3>
                    <p className="text-xs text-muted-foreground/70 leading-relaxed mb-4 line-clamp-3">
                      {article.excerpt}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground/40 mt-auto">
                      <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> {article.readMin} min</span>
                      <span className="font-semibold" style={{ color: article.color }}>Read →</span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>

          {/* Bottom CTA */}
          <motion.div {...fadeUp(0.35)} className="mt-16 text-center">
            <p className="text-sm text-muted-foreground mb-4">Ready to put this into practice?</p>
            <Link
              href="/start"
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-[hsl(268_52%_68%)] to-[hsl(285_45%_55%)] text-white font-semibold rounded-xl hover:opacity-90 transition-opacity"
            >
              <Sparkles className="w-4 h-4" /> Run your free Signal Audit
            </Link>
          </motion.div>

        </div>
      </div>
    </AppLayout>
  );
}
