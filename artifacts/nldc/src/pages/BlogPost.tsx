import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { motion } from "framer-motion";
import { Clock, ArrowLeft, ArrowRight, Sparkles, BookOpen } from "lucide-react";
import { ARTICLES } from "@/lib/blogArticles";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] as const },
});

// ── Article content ──────────────────────────────────────────────────────────

const ARTICLE_CONTENT: Record<string, React.ReactNode> = {
  "what-your-dating-profile-is-actually-communicating": (
    <>
      <p>
        There's a version of your dating profile that you wrote. And then there's the version someone reads when they see it for the first time, with no context, in three seconds, while swiping through forty other people.
      </p>
      <p>
        Those two versions are almost never the same — and the gap between them is the most important thing to understand about online dating.
      </p>

      <h2>The signal problem</h2>
      <p>
        Every element of your profile — your bio, your photo lineup, your answers to prompts — communicates something. But what it communicates isn't necessarily what you intended to say.
      </p>
      <p>
        When you write "I love hiking and good coffee," you're thinking about who you actually are: someone who values being active, who appreciates small pleasures, who's low-maintenance and easy to be around. But the person reading it sees the forty-seventh profile today that says exactly the same thing.
      </p>
      <p>
        This isn't a judgment on your personality. It's a signal problem. The words are accurate but generic — they communicate nothing specific that would make someone feel like they'd be getting something different with you versus anyone else.
      </p>

      <h2>What specificity actually does</h2>
      <p>
        Research on what makes dating profiles memorable consistently finds the same thing: specificity creates mental images. Mental images create emotional responses. Emotional responses drive action.
      </p>
      <p>
        Compare these two:
      </p>
      <blockquote>
        "I love hiking and being outdoors."
      </blockquote>
      <blockquote>
        "I did the Routeburn Track in New Zealand last spring and cried a little at the pass. Apparently I'm that person now."
      </blockquote>
      <p>
        The second one is longer, riskier, and more vulnerable. It's also the one that gets messages. Because it gives someone something to respond to, something to picture, and a clear signal about what kind of person you are.
      </p>

      <h2>The three signals your profile is sending right now</h2>
      <p>
        Every dating profile communicates on three channels simultaneously — whether you're aware of it or not:
      </p>
      <p>
        <strong>The content signal:</strong> The literal facts and details you share. What you do, where you've been, what you care about. This is what most people focus on.
      </p>
      <p>
        <strong>The character signal:</strong> What the way you write those facts implies about your personality. Are you self-aware? Do you have a sense of humour? Do you take yourself too seriously, or not seriously enough?
      </p>
      <p>
        <strong>The effort signal:</strong> What your profile communicates about how much thought you put into it. A profile that looks like it took three minutes to write communicates something specific — even if everything in it is true.
      </p>
      <p>
        Most people only think about the content signal. The character and effort signals are what actually drive decisions.
      </p>

      <h2>Why the photos are doing more work than you think</h2>
      <p>
        Studies consistently show that photo selection accounts for a disproportionate share of swipe decisions — but not for the reason most people assume. It's not purely about attractiveness. It's about the story the photo lineup tells.
      </p>
      <p>
        A photo of you laughing at a table with friends communicates: this person has real relationships. A photo of you at a concert communicates: this person has a life beyond work. A solo photo in front of a generic backdrop communicates: this person exists but has nothing specific to show me.
      </p>
      <p>
        Each photo is an opportunity to add evidence for a specific impression. Most people don't use those opportunities intentionally.
      </p>

      <h2>The fastest way to find the gap</h2>
      <p>
        The most reliable way to discover what your profile is actually communicating is to show it to someone who has never met you and ask them to tell you three things: what kind of person they think you are, what they'd want to ask you about, and whether they'd want to meet you.
      </p>
      <p>
        The answers will often surprise you. Sometimes pleasantly. Usually with at least one thing you hadn't considered.
      </p>
      <p>
        That feedback — the three-second impression a stranger forms — is worth more than any amount of self-analysis, because it's what's actually happening every time someone lands on your profile.
      </p>

      <h2>What to do with this</h2>
      <p>
        Read your bio as if you've never met yourself. Not as the person who lived those experiences — as someone who's seeing this for the first time, scanning for a reason to feel something.
      </p>
      <p>
        Ask: what specific thing does this tell someone about what it would actually be like to spend time with me? If you can't answer that clearly, neither can they.
      </p>
      <p>
        That's the gap. Close it with specifics, not with more adjectives.
      </p>
    </>
  ),

  "the-science-of-message-coaching": (
    <>
      <p>
        In 2016, researchers analysed 186,000 conversations on an online dating platform and published one of the most counterintuitive findings in the field: the messages most likely to get replies were not the funniest, the most confident, or the most complimentary.
      </p>
      <p>
        They were the ones that asked a question about something specific in the other person's profile.
      </p>
      <p>
        That finding has held up across every subsequent study. And yet most first messages still ignore it entirely.
      </p>

      <h2>Why "hey" works better than you'd expect (and worse than you'd hope)</h2>
      <p>
        The shortest possible message — "hey," "hi," "hello" — gets a reply rate that's meaningfully above zero. This surprises people, because it provides nothing for the recipient to work with. But it does one thing right: it's low-friction. There's nothing to disagree with, nothing to respond to awkwardly, nothing that could go wrong.
      </p>
      <p>
        The problem is that the reply rate, while not zero, is also not good. And the conversations it generates tend to stall quickly because neither person has given the other much to build on.
      </p>

      <h2>The anatomy of a message that gets a response</h2>
      <p>
        Across multiple studies, the messages with the highest response rates share a consistent structure:
      </p>
      <p>
        <strong>They reference something specific.</strong> Not "your photos are great" — something in the bio, a prompt answer, a specific detail. This signals that you actually read their profile, which is a higher bar than most people clear.
      </p>
      <p>
        <strong>They include an open question.</strong> Not "what do you do for fun?" — that requires the other person to do all the work. A question tied to the specific detail you referenced: "I saw you mentioned the Amalfi Coast — was that as chaotic as it looks, or does it somehow work?"
      </p>
      <p>
        <strong>They're short.</strong> Long first messages, however thoughtful, create pressure. They feel like they require a proportional response, which raises the perceived cost of replying. The sweet spot in most studies is 2–4 sentences.
      </p>
      <p>
        <strong>They don't lead with a compliment on appearance.</strong> Complimenting someone's smile or photos in the first message has a significantly lower reply rate than messages that don't mention appearance at all. The leading theory is that appearance-based compliments signal that you didn't read the profile — that you're responding to a photo, not a person.
      </p>

      <h2>The reciprocity trap</h2>
      <p>
        One of the most reliable ways to kill a conversation early is to answer a question without redirecting it. If someone asks where you're from and you answer without asking them something back, the conversation ends.
      </p>
      <p>
        This sounds obvious, but people forget it constantly when they're nervous or on autopilot. Every message in a new conversation should either ask a question or share something that makes the other person want to.
      </p>

      <h2>The tone calibration problem</h2>
      <p>
        The other major finding across conversation research is that tone mismatch kills momentum faster than almost anything else. If someone writes warmly and you respond clinically, they feel dismissed. If someone is being direct and you're being playful in a way that avoids the substance, they feel handled.
      </p>
      <p>
        This is harder to get right than content, because it requires reading someone's communication style from a small sample size and mirroring it without being mechanical about it.
      </p>
      <p>
        The practical approach: read the energy of their last message, then ask — does my response feel like a natural continuation of that energy, or a jarring shift?
      </p>

      <h2>What this means practically</h2>
      <p>
        The best first message isn't the wittiest one or the most confident one. It's the one that makes the person reading it feel like you were actually paying attention to them — and gives them something easy to grab onto and respond to.
      </p>
      <p>
        Specificity, brevity, a genuine question. That's the formula. It's not exciting, but it's what the data says.
      </p>
    </>
  ),

  "red-flags-in-your-own-profile": (
    <>
      <p>
        Most people have received the advice: look for red flags in other people's profiles. Inconsistencies, negativity, vagueness that hides something.
      </p>
      <p>
        Fewer people have sat with the harder question: what red flags are in my own profile — and why can't I see them?
      </p>
      <p>
        The answer is almost always the same. You can't see them because they're invisible from the inside. Every choice you made felt reasonable when you made it. But reasonable from your perspective and clear from a stranger's are completely different things.
      </p>

      <h2>1. The defensive disclaimer</h2>
      <p>
        Any version of "I'm not good at these things" or "I hate writing about myself" or "I'm an open book, just ask" is a defensive move that backfires. It signals low self-awareness wrapped in false humility. It also makes the reader do all the work of figuring out who you are.
      </p>
      <p>
        What you think it communicates: approachability, honesty, anti-pretension.
        What it actually communicates: this person hasn't thought carefully about who they are or what they want.
      </p>

      <h2>2. The exhaustion list</h2>
      <p>
        "I work hard and I play hard. Love exploring new restaurants, hiking, travel, yoga, good wine, live music, brunches with friends." A list that covers every popular hobby is not a personality. It's a résumé of safe answers designed to appeal to everyone — which means it connects with no one.
      </p>
      <p>
        The fix is not fewer hobbies. It's one specific detail about any one of them that only you would say.
      </p>

      <h2>3. The photo that requires explanation</h2>
      <p>
        Any photo that you feel the need to caption or explain is a photo that's doing you a disservice. "This is from a costume party" or "I know, the angle is weird" are warning signs. A profile photo shouldn't raise questions it can't answer.
      </p>
      <p>
        This includes group photos where you're not the obvious focal point, heavily filtered photos that don't look like the other photos, and any photo where your face is obscured, in shadow, or facing away from camera.
      </p>

      <h2>4. The negativity hedge</h2>
      <p>
        "Not looking for hookups." "Please be serious about actually meeting up." "If you're just here to collect matches, swipe left." These phrases feel like reasonable filters. From the outside, they read as someone who's been burned and is now leading with resentment.
      </p>
      <p>
        Legitimate preferences can be expressed positively. "Looking for something real" communicates the same thing without signalling that you're bracing for disappointment.
      </p>

      <h2>5. The ambiguous relationship with your own life</h2>
      <p>
        When someone reads your profile, they're trying to imagine spending time with you. If your profile gives no sense of what your actual life looks like — what you do, what matters to you, what a typical week involves — they have nothing to imagine.
      </p>
      <p>
        Vagueness is often mistaken for mystery. It's not. Mystery is when you reveal something intriguing and leave the rest unexplained. Vagueness is when you reveal nothing, which just feels like absence.
      </p>

      <h2>6. The goal mismatch</h2>
      <p>
        Saying you're "open to whatever" when you actually have a preference is a strategy that tends to attract the wrong people and repel the right ones. The people who are also clear about what they want will move on to someone who matches. The people who are unclear will fill in their own projections.
      </p>
      <p>
        Being honest about what you're actually looking for filters your matches — and that's a feature, not a bug.
      </p>

      <h2>7. The unmaintained profile</h2>
      <p>
        The quietest red flag is a profile that clearly hasn't been updated. Photos from years ago, prompt answers that feel like they were written once and forgotten, references to things that no longer apply. It signals that you're not really here, you're just present.
      </p>
      <p>
        An active, engaged presence on a dating app communicates something real: that this matters to you, and you're treating it accordingly.
      </p>

      <h2>What to do about any of these</h2>
      <p>
        The hardest part is that you usually can't diagnose your own profile accurately because you know too much about yourself. You fill in the gaps unconsciously with context that the reader doesn't have.
      </p>
      <p>
        The most useful exercise: read your profile as if you're trying to find a reason not to swipe right. What gives you pause? What leaves you flat? What makes you work harder than you should have to? Those are the spots to fix first.
      </p>
    </>
  ),

  "photo-psychology-dating-apps": (
    <>
      <p>
        Dating app photos are not just visual evidence. They're a communication medium — one that operates faster than language and carries information the person viewing them often can't fully articulate.
      </p>
      <p>
        When someone swipes left on your profile in under two seconds, they're not making a conscious aesthetic judgment. They're responding to a feeling — and that feeling is generated by the combined signal of everything in the frame.
      </p>

      <h2>What the research actually says</h2>
      <p>
        Studies on dating photo selection have found consistent patterns across demographic groups. The photos that perform best are not necessarily the ones that show the most attractive version of the person — they're the ones that communicate the most clearly about who the person is.
      </p>
      <p>
        A landmark study by researchers at MIT found that photos triggering a "genuine warmth" impression drove significantly higher engagement than photos where the subject was objectively more attractive but appeared less approachable. Competence signals (professional, well-dressed, composed) also correlated with engagement, but warmth was the stronger predictor.
      </p>

      <h2>The order problem</h2>
      <p>
        Your first photo is doing the most work. It determines whether someone pauses long enough to see the rest. A first photo that creates a clear, warm, direct impression buys you the time to tell the rest of your story.
      </p>
      <p>
        The most effective first photo characteristics, based on engagement data:
      </p>
      <ul>
        <li>Direct eye contact with the camera (vs. looking away)</li>
        <li>A genuine smile — crow's feet, crinkled eyes — rather than a posed smile</li>
        <li>Clear face visibility, good lighting, minimal distraction in the background</li>
        <li>You as the clear focal point of the image</li>
      </ul>
      <p>
        Group photos as a first photo consistently underperform, for an obvious reason: the viewer has to do work to figure out which person is you.
      </p>

      <h2>What each photo position should do</h2>
      <p>
        Think of your photo lineup as a short story. Each photo has a job:
      </p>
      <p>
        <strong>Photo 1:</strong> Stop the scroll. Create warmth and approachability. Make the viewer want to see more.
      </p>
      <p>
        <strong>Photo 2–3:</strong> Add dimension. This is where you show context — an activity, a place, a setting that reveals something about your life. The goal is to give the viewer a mental image of what spending time with you might look like.
      </p>
      <p>
        <strong>Photo 4–5:</strong> Add evidence. Social proof (you with friends, laughing), range (you in a different context than photo 1), or a memorable specific (the obscure location, the unusual hobby, the thing that makes you you).
      </p>

      <h2>The solo vs. group photo question</h2>
      <p>
        Group photos are valuable — they signal that you have real social connections, which is a genuinely important signal to people looking for a partner. But they work best in positions 3–5, not position 1.
      </p>
      <p>
        When you do include group photos, make sure you're clearly identifiable and ideally positioned as the natural focal point of the image. The viewer should never have to wonder.
      </p>

      <h2>The "trying too hard" signal</h2>
      <p>
        Heavily edited photos, dramatically lit photos, or photos that look professionally staged sometimes backfire — not because people don't appreciate the effort, but because they create a gap between the profile and the expectation. If someone meets you and you look noticeably different from your photos, the mismatch creates distrust before the conversation even starts.
      </p>
      <p>
        The most effective photos look like your best natural self, not a curated version of what you wish you looked like.
      </p>

      <h2>What your photos are missing</h2>
      <p>
        The most common photo lineup failure isn't having bad photos. It's having five versions of the same photo — same expression, same context, same pose, slightly different location. A lineup that doesn't change across five photos gives the viewer nothing new after the first one.
      </p>
      <p>
        Each photo should add a piece of information that the others don't. If you can swap two photos in your lineup without losing anything, one of them isn't doing its job.
      </p>

      <h2>The practical audit</h2>
      <p>
        Print out your five photos (or lay them out side by side on screen). For each one, write one sentence describing what a stranger would learn about you from that photo alone — not who you are in the context of your full profile, but what that single image tells someone who knows nothing about you.
      </p>
      <p>
        If any photo doesn't add something new, replace it with one that does.
      </p>
      <p>
        If more than two photos give the same impression, you're repeating yourself instead of building a picture.
      </p>
      <p>
        That's the audit. It's not about being more attractive — it's about being more legible.
      </p>
    </>
  ),
};

// ── Prose wrapper ─────────────────────────────────────────────────────────────

function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="
      prose prose-invert max-w-none
      prose-p:text-muted-foreground prose-p:leading-[1.85] prose-p:mb-5
      prose-h2:font-serif prose-h2:text-foreground prose-h2:text-2xl prose-h2:font-bold prose-h2:mt-10 prose-h2:mb-4
      prose-strong:text-foreground
      prose-blockquote:border-l-[hsl(248_62%_52%)] prose-blockquote:text-muted-foreground prose-blockquote:italic prose-blockquote:not-italic
      prose-ul:text-muted-foreground prose-li:mb-1.5
    ">
      {children}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BlogPost({ slug }: { slug: string }) {
  const article = ARTICLES.find(a => a.slug === slug);
  const content = ARTICLE_CONTENT[slug];

  if (!article || !content) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-24 max-w-2xl text-center">
          <h1 className="font-serif text-3xl font-bold text-foreground mb-4">Article not found</h1>
          <Link href="/blog" className="text-[hsl(248_62%_62%)] hover:opacity-80 transition-opacity">
            ← Back to the blog
          </Link>
        </div>
      </AppLayout>
    );
  }

  const currentIndex = ARTICLES.indexOf(article);
  const prev = currentIndex > 0 ? ARTICLES[currentIndex - 1] : null;
  const next = currentIndex < ARTICLES.length - 1 ? ARTICLES[currentIndex + 1] : null;

  useMeta(article.title, article.excerpt);

  return (
    <AppLayout>
      <div className="min-h-screen mesh-bg">
        <div className="orb orb-violet fixed w-[400px] h-[400px] -top-40 -right-40 opacity-25 pointer-events-none" />

        <div className="container mx-auto px-4 md:px-6 py-16 max-w-2xl relative z-10">

          {/* Back link */}
          <motion.div {...fadeUp(0)} className="mb-10">
            <Link href="/blog" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" /> All articles
            </Link>
          </motion.div>

          {/* Header */}
          <motion.div {...fadeUp(0.06)} className="mb-10">
            <div className="flex items-center gap-3 mb-5 flex-wrap">
              <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: `${article.color.replace(")", " / 0.12)")}`, color: article.color, border: `1px solid ${article.color.replace(")", " / 0.25)")}` }}>
                {article.category}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground/50">
                <Clock className="w-3 h-3" /> {article.readMin} min read · {article.date}
              </span>
            </div>
            <h1 className="font-serif text-3xl md:text-4xl font-bold text-foreground leading-snug mb-6">
              {article.title}
            </h1>
            <p className="text-muted-foreground text-lg leading-relaxed border-l-2 pl-4" style={{ borderColor: article.color }}>
              {article.excerpt}
            </p>
          </motion.div>

          {/* Body */}
          <motion.div {...fadeUp(0.1)}>
            <Prose>{content}</Prose>
          </motion.div>

          {/* CTA */}
          <motion.div {...fadeUp(0.2)} className="mt-14 glass border border-[hsl(248_62%_52%/0.2)] rounded-2xl p-6 text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50 mb-2">Put this into practice</p>
            <h3 className="font-serif text-xl font-bold text-foreground mb-3">Get your free Profile Signal Audit</h3>
            <p className="text-sm text-muted-foreground mb-5 max-w-sm mx-auto">
              Find out exactly what your profile is communicating — Signal Score, bio critique, prompt rewrites, and a 7-day action plan.
            </p>
            <Link
              href="/start"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B] text-white font-semibold rounded-xl hover:opacity-90 transition-opacity text-sm"
            >
              <Sparkles className="w-4 h-4" /> Start free audit — takes 3 minutes
            </Link>
          </motion.div>

          {/* Prev/next */}
          {(prev || next) && (
            <motion.div {...fadeUp(0.25)} className="mt-10 grid grid-cols-2 gap-4">
              <div>
                {prev && (
                  <Link href={`/blog/${prev.slug}`} className="group block glass rounded-xl p-4 hover:bg-white/3 transition-colors">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-1 flex items-center gap-1"><ArrowLeft className="w-2.5 h-2.5" /> Previous</p>
                    <p className="text-xs font-semibold text-muted-foreground group-hover:text-foreground transition-colors leading-snug">{prev.title}</p>
                  </Link>
                )}
              </div>
              <div>
                {next && (
                  <Link href={`/blog/${next.slug}`} className="group block glass rounded-xl p-4 hover:bg-white/3 transition-colors text-right">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-1 flex items-center gap-1 justify-end">Next <ArrowRight className="w-2.5 h-2.5" /></p>
                    <p className="text-xs font-semibold text-muted-foreground group-hover:text-foreground transition-colors leading-snug">{next.title}</p>
                  </Link>
                )}
              </div>
            </motion.div>
          )}

          {/* Back to blog */}
          <motion.div {...fadeUp(0.3)} className="mt-8 text-center">
            <Link href="/blog" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <BookOpen className="w-4 h-4" /> Read more articles
            </Link>
          </motion.div>

        </div>
      </div>
    </AppLayout>
  );
}
