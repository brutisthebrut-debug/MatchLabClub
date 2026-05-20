import { useState } from "react";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { motion } from "framer-motion";
import { ArrowRight, ChevronDown, ChevronUp, Sparkles } from "lucide-react";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

interface Rewrite {
  scenario: string;
  platform: string;
  platformColor: string;
  badge?: string;
  context: string;
  before: string;
  after: string;
  why: string;
}

const REWRITES: Rewrite[] = [
  {
    scenario: "The Sparse Profile",
    platform: "Tinder",
    platformColor: "hsl(348 75% 60%)",
    badge: "Most common",
    context: "Straight man, 31. Profile has two lines and a gym selfie. He's been getting low match rates and can't figure out why.",
    before: `Engineer. Love to travel and try new restaurants. Here for something real. DM me 😊`,
    after: `I'm a structural engineer who once convinced my entire team to spend our Friday afternoon testing whether the bridge we just designed could handle a spontaneous dance-off (it could). Currently three countries into a slow tour of every country with a really good national dish. Looking for someone to argue about the best way to eat a croissant — walking, no plate, non-negotiable.`,
    why: "Swapped job title for a specific story. Replaced 'love to travel' with a detail that does the work for you. Added a hook that invites a reply. Result: something only he could write.",
  },
  {
    scenario: "The Hinge Prompt Problem",
    platform: "Hinge",
    platformColor: "hsl(268 55% 65%)",
    badge: "Prompt rewrite",
    context: "Serious dater, 28. Good photos, weak prompts. The prompts all answer the question but tell you nothing real.",
    before: `Two truths and a lie: I've been to 12 countries. I speak fluent Spanish. I once met a celebrity.

I'm looking for: Someone genuine who knows what they want.

My simple pleasures: Good coffee, hiking, quiet Sunday mornings.`,
    after: `Two truths and a lie: I cried at the end of Toy Story 3 in a cinema full of strangers and I'd do it again. I know every word of Bohemian Rhapsody. I've never been on a rollercoaster.

I'm looking for: Someone who asks follow-up questions. The second or third layer of a conversation is where people actually show up.

My simple pleasures: The 45 minutes before the restaurant fills up. A dog that decides you're their person before you've said anything.`,
    why: "The first prompt now invites a conversation instead of a guessing game. The second prompt signals emotional intelligence without claiming it. The third prompt creates a picture instead of a list.",
  },
  {
    scenario: "The Queer Profile That Plays It Safe",
    platform: "HER",
    platformColor: "hsl(285 55% 65%)",
    badge: "Inclusive",
    context: "Queer woman, 26. Profile is vague to avoid alienating people. But vague also means invisible.",
    before: `Just a girl who loves music and her cat. Looking for someone kind and fun. I'm pretty chill and easy to talk to. Drop me a message if you want!`,
    after: `She/her. I'm a graphic designer who spends way too much time making playlists no one asked for (they're very good though). My cat Margot has opinions about which people I date and I've started listening to her. I'm queer, I date women and non-binary people, and I'm looking for something that doesn't feel like work. If you also have strong feelings about the correct way to watch a film (subtitles, dark room, phone face-down), we'll get along.`,
    why: "Added pronouns and clear identity. Replaced 'kind and fun' with two specific details that show personality. The cat went from prop to character. The ending screens for compatibility instead of just inviting anyone.",
  },
  {
    scenario: "The Grindr/Sniffies Direct Profile",
    platform: "Grindr",
    platformColor: "hsl(43 75% 55%)",
    badge: "Direct style",
    context: "Gay man, 34. Wants to be clear about what he's looking for but his profile sounds aggressive rather than direct.",
    before: `Masc. 6'1. Not here for games. If you don't have a face pic don't bother. Looking for discreet daytime fun only. No pic no chat.`,
    after: `34, 6'1, professional, use my face pic. Here for daytime fun — discreet is fine with me. I'm direct and I expect the same. Message me with what you're about. I reply to messages that actually say something.`,
    why: "Kept all the directness. Removed the aggressive framing. Added one real detail. Changed the rules from prohibitions to preferences. The tone went from bouncer to confident.",
  },
  {
    scenario: "The Feeld / Nontraditional Profile",
    platform: "Feeld",
    platformColor: "hsl(190 55% 60%)",
    badge: "Non-monogamy",
    context: "Non-monogamous couple, both 30s. Their profile is a wall of rules and disclaimers that reads like a contract.",
    before: `We are an established couple (5 years) looking for a third for occasional fun. Must be female. No drama. We have rules and boundaries. We are not looking for a relationship, just something casual. Couples in the comments will be blocked.`,
    after: `We're Sam (she/her) and Rio (he/him) — five years in and very happy. We're exploring and open to meeting people who are genuinely curious, kind, and comfortable with themselves. We tend to connect best with women and non-binary folks. We go slowly, we communicate clearly, and we're allergic to pressure in either direction. Tell us something about what you're looking for — we like to start with a conversation.`,
    why: "Introduced them as people. Replaced the rule-list with values. Kept the same preferences but framed them as fit instead of restrictions. Ended with an invitation instead of a warning.",
  },
  {
    scenario: "The Anxious Overtexter's Message",
    platform: "Hinge",
    platformColor: "hsl(268 55% 65%)",
    badge: "Message coaching",
    context: "He matched with someone on Friday. They had a good conversation. She's been quiet for 2 days. He's written and deleted three follow-ups. Here's the fourth one.",
    before: `Hey! Just wanted to check in, I know we talked about getting drinks sometime this week and I wasn't sure if you were still down or if something came up? No worries either way, I just didn't want things to get weird. Let me know what works for you 😊`,
    after: `Hey — still up for drinks this week if you are. I'm free Wednesday or Thursday. Let me know.`,
    why: "Cut 65 words to 18. Removed all the pre-apologies and 'no worries' hedges. Made a specific ask instead of a vague check-in. The original message communicated anxiety before she'd done anything. This one communicates ease.",
  },
  {
    scenario: "The Generic Bumble Opener",
    platform: "Bumble",
    platformColor: "hsl(43 75% 55%)",
    badge: "First message",
    context: "Woman made the first move (Bumble requires it). She sent the same opener she sends to everyone.",
    before: `Hey! How's your week going? 😊`,
    after: `Okay I noticed you also love the kind of restaurant that doesn't have a website and might be cash only — what's your best find in the city?`,
    why: "Referenced something specific from his profile. Turned it into a question that has a real answer. Created a shared frame immediately. The original opener could have been sent to literally anyone on the app.",
  },
  {
    scenario: "The Dry LinkedIn-Style Bio",
    platform: "The League",
    platformColor: "hsl(228 40% 65%)",
    badge: "High-intent app",
    context: "Ambitious professional, 35. Profile reads like a cover letter. She's impressive on paper and invisible as a person.",
    before: `VP of Product at a Series B startup. Stanford MBA. Previously Google. I work hard and play hard. Looking for a partner who's equally driven and values growth.`,
    after: `I run product at a startup that's about to be very loud (can't say more yet). I got the Stanford MBA, did the Google thing, and at some point realised ambition is more interesting when it has a 'why' behind it. I'm still figuring out what mine is. Outside work: marathon training, extremely opinionated about Italian food, and currently reading everything Zadie Smith has ever written. Looking for someone with a real interior life, not just a good CV.`,
    why: "Kept the credentials but made them feel earned rather than listed. Added the question behind the career. The 'looking for' section now signals what she actually wants, not just what she requires.",
  },
];

function RewriteCard({ r, index }: { r: Rewrite; index: number }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <motion.div {...fadeUp(0.04 + index * 0.04)} className="glass border border-white/8 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-5 pb-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full border text-[10px]"
              style={{ color: r.platformColor, borderColor: r.platformColor.replace(")", " / 0.3)"), background: r.platformColor.replace(")", " / 0.08)") }}>
              {r.platform}
            </span>
            {r.badge && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 px-2 py-1 rounded-full border border-white/8">
                {r.badge}
              </span>
            )}
          </div>
        </div>
        <h3 className="font-semibold text-foreground text-sm">{r.scenario}</h3>
        <p className="text-[11px] text-muted-foreground/50 mt-1 leading-relaxed">{r.context}</p>
      </div>

      {/* Before / After */}
      <div className="grid sm:grid-cols-2 border-t border-white/5">
        <div className="p-5 border-b sm:border-b-0 sm:border-r border-white/5">
          <p className="text-[9px] font-bold uppercase tracking-widest text-[hsl(348_55%_65%)] mb-2.5">Before</p>
          <p className="text-xs text-muted-foreground/60 leading-relaxed whitespace-pre-line font-mono">{r.before}</p>
        </div>
        <div className="p-5 bg-[hsl(142_55%_60%/0.04)]">
          <p className="text-[9px] font-bold uppercase tracking-widest text-[hsl(142_55%_60%)] mb-2.5">After</p>
          <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">{r.after}</p>
        </div>
      </div>

      {/* Why it works */}
      <div className="border-t border-white/5">
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-full flex items-center justify-between px-5 py-3 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        >
          <span className="font-semibold uppercase tracking-wider text-[9px]">Why it works</span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        {expanded && (
          <div className="px-5 pb-5">
            <p className="text-xs text-muted-foreground/70 leading-relaxed">{r.why}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function Gallery() {
  useMeta("Before & After Gallery", "Real profile rewrites, message improvements, and prompt makeovers — sample content only.");
  return (
    <AppLayout>
      <div className="min-h-screen mesh-bg py-10 px-4">
        <div className="orb orb-violet fixed w-[400px] h-[400px] -top-20 -right-20 opacity-20 pointer-events-none" />
        <div className="orb orb-gold   fixed w-[300px] h-[300px] bottom-0 -left-10 opacity-15 pointer-events-none" />

        <div className="max-w-3xl mx-auto relative z-10">
          {/* Hero */}
          <motion.div {...fadeUp(0)} className="mb-8 text-center space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 text-xs text-muted-foreground/60 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-[hsl(268_52%_68%)]" />
              Sample content — fictional profiles only
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground">Before & After</h1>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-md mx-auto">
              See how vague, generic, or off-putting copy becomes specific, clear, and compelling.
              Eight real scenarios — straight, queer, casual, serious, every platform.
            </p>
          </motion.div>

          {/* Rewrites */}
          <div className="space-y-4">
            {REWRITES.map((r, i) => <RewriteCard key={r.scenario} r={r} index={i} />)}
          </div>

          {/* CTA strip */}
          <motion.div {...fadeUp(0.4)} className="mt-8 glass border border-white/8 rounded-2xl p-6 text-center space-y-4">
            <h2 className="text-lg font-bold text-foreground">Ready to rewrite yours?</h2>
            <p className="text-sm text-muted-foreground">
              The Profile Signal Audit gives you a personalised breakdown — not sample content, your actual profile.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/signal-check"
                className="px-6 py-2.5 rounded-full text-sm font-semibold bg-gradient-to-r from-[hsl(268_52%_68%)] to-[hsl(348_55%_65%)] text-white border-0">
                Free Signal Check <ArrowRight className="inline ml-1 w-3.5 h-3.5" />
              </Link>
              <Link href="/copilot/profile"
                className="px-6 py-2.5 rounded-full text-sm font-semibold border border-white/10 hover:border-white/20 transition-colors text-muted-foreground">
                Improve My Profile →
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
}
