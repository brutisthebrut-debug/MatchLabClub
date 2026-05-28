import { useEffect } from "react";
import { withAlpha } from "@/lib/brandColor";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { motion } from "framer-motion";
import { Clock, ArrowLeft, ArrowRight, Sparkles, BookOpen } from "lucide-react";
import { ARTICLES } from "@/lib/blogArticles";
import { trackEvent } from "@/lib/analytics";

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

  "matching-with-the-wrong-people": (
    <>
      <p>
        Three matches in a row. All wrong. Different faces, different bios, somehow the same disappointment by week two.
      </p>
      <p>
        When this happens once, it's bad luck. When it happens four or five times in a row, it stops being about them and starts being about a pattern your swipe finger is running without your conscious permission.
      </p>

      <h2>The filter you don't know you're using</h2>
      <p>
        Most people swipe based on a fast feeling: this person is attractive, this person seems fun, this person is "my type." That fast feeling is built from years of associations — what your last good relationship looked like, what felt safe growing up, what your friends approve of, what you're proving to your ex.
      </p>
      <p>
        None of those filters are necessarily wrong. The problem is they're invisible. You don't see yourself filtering. You just see the matches you ended up with — and conclude the dating pool is broken.
      </p>

      <h2>The three patterns that produce wrong matches</h2>
      <p>
        <strong>Pattern one: the familiar.</strong> You're swiping right on people who feel familiar — because familiar feels safe — and familiar is often a version of the dynamic you said you wanted to leave. The signal you're tuning into isn't "compatible." It's "recognisable."
      </p>
      <p>
        <strong>Pattern two: the proof.</strong> You're swiping right on people who would prove something — to yourself, to an ex, to a friend group. Their profile is doing the job of a trophy more than a partner. Whatever it's proving, it's not actually about them.
      </p>
      <p>
        <strong>Pattern three: the avoidance.</strong> You're swiping right on people who give you cover for not actually committing — they live far away, they're recently single, they're "complicated." The match exists, but the relationship can't, and that's the unspoken reason it felt safe to swipe.
      </p>

      <h2>How to actually see the pattern</h2>
      <p>
        Write down the last five people you matched with and at least one detail about each: their job, their stated relationship goal, how the conversation ended. Then write down the last five people you went on a date with from the apps.
      </p>
      <p>
        Read both lists back. Look for what's the same. Not in their personalities — in the dynamic. Who initiated. Who kept the energy going. Who you were performing for. What ended each one.
      </p>
      <p>
        The pattern is almost always there. It's usually quieter than you'd expect.
      </p>

      <h2>The reset isn't "try harder"</h2>
      <p>
        Once you can see the pattern, the move isn't to white-knuckle different choices. It's to slow the swipe down enough that you're actually choosing instead of pattern-matching.
      </p>
      <p>
        Before the next right-swipe: read the bio twice, read the prompts, look at every photo, and ask the awkward question — what is this person's actual life going to ask of me? If the answer makes you feel something honest, swipe. If the answer makes you feel nothing, the swipe is your filter talking, not you.
      </p>
    </>
  ),

  "attachment-styles-on-dating-apps": (
    <>
      <p>
        Attachment theory is having a moment, and most of how it's used in dating discourse is wrong — flattened into four boxes, used to label other people, deployed mostly as a reason to stop trying with someone.
      </p>
      <p>
        Used honestly, it does something more useful: it gives you a frame for noticing how you actually behave in the first three weeks of any new dating connection. Because that's where attachment style does most of its damage, and it does most of it through behaviours you wouldn't have called "attachment" at all.
      </p>

      <h2>What each style looks like on a dating app specifically</h2>
      <p>
        <strong>Secure</strong> shows up on a dating app as steady pace. You match, you have a real conversation, you ask them out within a reasonable window, you don't catastrophise the gaps between replies. None of this feels effortful — it feels like baseline.
      </p>
      <p>
        <strong>Anxious</strong> shows up as the read-receipt spiral. You check whether they opened it. You re-read your last message looking for what was wrong with it. You draft and redraft. You sometimes send a follow-up to fill the silence. You feel relief, then a fresh wave of needing, every time they reply.
      </p>
      <p>
        <strong>Avoidant</strong> shows up as the slow fade-out. You match, the conversation is good, then on day three you can't bring yourself to open the app. You see they replied and you tell yourself you'll respond later. By the time you do, the energy is gone — and your nervous system registers that as relief.
      </p>
      <p>
        <strong>Disorganised</strong> looks like both of the above on alternate days — intense pursuit followed by total withdrawal, often without an obvious external trigger.
      </p>

      <h2>The signal you're sending without knowing</h2>
      <p>
        Here's the part nobody talks about: the person on the other end can feel your attachment style through the cadence and shape of your messages, even if they couldn't name what they're feeling.
      </p>
      <p>
        Anxious cadence — replies that come too fast, that are too long for the moment, that include three follow-up questions — feels like pressure to the reader, even if every word is fine. Avoidant cadence — multi-day gaps, replies that match the literal content but drop all the warmth — feels like rejection, even when no rejection was intended.
      </p>
      <p>
        Both of those feelings get attributed to chemistry, not to attachment. So when someone "loses interest," your read on what happened is almost always slightly off.
      </p>

      <h2>What to actually do about your own style</h2>
      <p>
        You can't change your attachment style in a week. You can change the behaviour it produces on a specific dating app, this week.
      </p>
      <p>
        If you're anxious-leaning, the move is delay-without-disappearing — match the cadence of their messages instead of beating them to the reply, and resist the urge to follow up on your own follow-up.
      </p>
      <p>
        If you're avoidant-leaning, the move is small consistent contact instead of intense bursts — reply within the day every day, even if briefly, instead of going dark for three days and coming back with a paragraph.
      </p>
      <p>
        Neither of these requires fixing yourself. They just require noticing the move you're about to make, and choosing a slightly different one in the moment.
      </p>
    </>
  ),

  "first-date-question-predicts-second-date": (
    <>
      <p>
        Most first-date questions are filler. "What do you do?" "Where are you from?" "How long have you lived here?" They exist because the silence would be worse, but they don't actually move anything forward.
      </p>
      <p>
        There's one question that does — and whether someone can answer it is the strongest in-conversation predictor that you'll want a second date.
      </p>

      <h2>The question</h2>
      <p>
        Some version of: "What's something you've changed your mind about in the last couple of years?"
      </p>
      <p>
        It's a small question. It doesn't look like much. But it does three things at once that almost no other first-date question does.
      </p>

      <h2>What it actually tests</h2>
      <p>
        First, it tests whether they're a person who reflects. People who don't update their beliefs based on experience tend to make for difficult long-term partners, because every disagreement becomes a stalemate. Someone who can name a real shift in their thinking is showing you they have an internal life that responds to evidence.
      </p>
      <p>
        Second, it tests vulnerability. Admitting you were wrong about something — even something small — is a low-stakes vulnerability test. People who can do it casually on a first date have a baseline emotional security. People who can't, often can't in higher-stakes situations either.
      </p>
      <p>
        Third, it gives you something specific to talk about for the next twenty minutes. Whatever they changed their mind about becomes the next conversation, and it'll be a real one — not a script.
      </p>

      <h2>The bad versions to avoid</h2>
      <p>
        Don't ask it like a job interview question. "So — tell me about a time you changed your mind." That collapses it.
      </p>
      <p>
        Ask it like you're genuinely curious. Lead with one of your own. "I used to think X about Y, and I've been thinking lately I had it backwards. Anything like that for you recently?"
      </p>
      <p>
        That reframing does the work — it makes it a conversation, not a test.
      </p>

      <h2>What the answers tell you</h2>
      <p>
        The content of the answer matters less than the shape. Watch for: do they engage the question or deflect it? Do they give you something concrete or stay abstract? Does the example reveal something about how they think, or just what they think?
      </p>
      <p>
        Someone who says "I used to be really judgmental about people who drink alcohol and I realised I was projecting" is giving you a window into a real internal process. Someone who says "I don't really change my mind about much" is also giving you a window — into something else entirely.
      </p>

      <h2>Why it predicts the second date</h2>
      <p>
        Because by the time you've both answered it, you've had something approximating an actual conversation — not an interview. And the felt sense of "this person is interesting" is built almost entirely from moments like that.
      </p>
      <p>
        The second date isn't decided by chemistry or attraction. It's decided by whether the first date generated even one moment that felt different from the dozen other first dates you've both had this year. This question generates that moment reliably.
      </p>
    </>
  ),

  "good-vibes-only-bio": (
    <>
      <p>
        "Good vibes only." "Looking for my partner in crime." "Just here to see what happens." "Adventure seeker. Coffee enthusiast. Dog lover."
      </p>
      <p>
        These phrases are written constantly because they feel safe. They're warm-sounding, non-committal, broadly agreeable. They are also the single most reliable signal that the writer didn't think carefully about their profile — and the reader picks that up immediately, even when they couldn't tell you why they swiped left.
      </p>

      <h2>What 'good vibes' actually communicates</h2>
      <p>
        On the surface: "I'm a positive person." Below the surface: "I haven't thought about what I want from this." And below that: "I'd like to seem fun without taking the risk of saying anything specific."
      </p>
      <p>
        Generic positivity does almost no filtering work. Everyone is "fun" in their profile. Everyone has "good vibes." If your bio applies equally well to half the platform, it's not telling someone why to choose you — and reading it produces nothing.
      </p>

      <h2>The mathematics of selection</h2>
      <p>
        Someone scrolling through dating profiles is performing a fast selection task. Their goal is not to find someone they like; their goal is to filter out people they don't want to think about further so they can focus on the small number worth a real swipe.
      </p>
      <p>
        Generic bios are easy to filter out — not because they're bad, but because they give no reason to stop. Specific bios are harder to filter out, because the reader has to actually engage with whether the specific thing is interesting to them.
      </p>
      <p>
        That brief moment of engagement is what you're competing for. Generic copy never earns it.
      </p>

      <h2>What to write instead</h2>
      <p>
        Pick a thing you actually do — a habit, a hobby, a recent obsession, an opinion — and describe it concretely enough that someone could form a mental picture.
      </p>
      <p>
        Not: "I love food."
      </p>
      <p>
        Try: "I will drive an unreasonable distance for good xiao long bao. Currently working through every Sichuan restaurant in a 30km radius and rating them on a private spreadsheet."
      </p>
      <p>
        Not: "I'm into music."
      </p>
      <p>
        Try: "Saw Big Thief three times this year and I'm somehow still not over it. Always looking for the next obsession."
      </p>

      <h2>Why this feels risky and isn't</h2>
      <p>
        Specificity feels risky because it's filtering. Some people read your xiao long bao bio and think "weird obsession." Good — they were never going to be a match.
      </p>
      <p>
        Some people read it and think "I'd actually want to meet that person." That's the entire point of a dating profile. You don't need every reader to want to meet you. You need the right ones to feel something specific.
      </p>
    </>
  ),

  "three-message-test": (
    <>
      <p>
        Most dating app conversations die quietly. Not in a fight, not from rejection — they just thin out. Reply gaps stretch. Energy fades. By message five or six, someone stops responding and neither of you mentions it.
      </p>
      <p>
        The reason is almost always something that happened at message three.
      </p>

      <h2>The three-message structure</h2>
      <p>
        Look at any healthy early dating app conversation and the first three messages tend to do specific work:
      </p>
      <p>
        <strong>Message one</strong> opens — usually a reference to something specific in their profile plus a real question.
      </p>
      <p>
        <strong>Message two</strong> answers the question and asks one back. Reciprocity.
      </p>
      <p>
        <strong>Message three</strong> is where the conversation either deepens or coasts. This is the inflection point. The third message either takes the topic somewhere more interesting, opens a new thread, or makes the leap toward suggesting a call or meeting up.
      </p>
      <p>
        When message three just answers the previous one without adding anything new, you've entered Q&A mode — and Q&A mode has a short shelf life.
      </p>

      <h2>Why this happens</h2>
      <p>
        Most people are so relieved to be in a working conversation that they keep doing the thing that's working — answering questions, sharing details, being nice. None of that is wrong. But all of it is reactive.
      </p>
      <p>
        Reactive conversations on dating apps stall because there's no momentum being generated. You're both just maintaining. Without someone driving — adding a new angle, sharing something unprompted, suggesting a next step — the energy slowly bleeds out.
      </p>

      <h2>How to handle message three</h2>
      <p>
        The simplest move: answer their question, then add something they didn't ask for. A connected story, an opinion, a tangent, a small piece of vulnerability.
      </p>
      <p>
        Instead of: "Yeah, I really liked Lisbon, the food was great." (Q&A loop.)
      </p>
      <p>
        Try: "Yeah, Lisbon was great — the actual highlight was getting completely lost in Alfama on the third night and ending up at this tiny fado bar with maybe ten people in it. I've been trying to replicate that 'accidentally found something real' feeling on trips ever since." (Story + signal + ongoing thread.)
      </p>
      <p>
        The second version gives them five things they could respond to. The first gives them one.
      </p>

      <h2>The other move: name what's happening</h2>
      <p>
        Sometimes the right message three move is to call the moment. "I'm enjoying this — want to keep going over a drink this week?" By message three, you've established enough of a baseline that suggesting meeting up doesn't feel like a leap.
      </p>
      <p>
        Conversations that drag on for forty messages before someone suggests a date almost always die before the date happens. The energy needs somewhere to go.
      </p>

      <h2>The bigger principle</h2>
      <p>
        Healthy early conversations have a small forward-motion vector on each message. The motion can come from depth, from humour, from a new topic, or from suggesting a next step — but something has to move.
      </p>
      <p>
        If you read the last three messages of any stalled conversation and find that nothing was added beyond the literal questions and answers, you'll know exactly why it stalled.
      </p>
    </>
  ),

  "read-a-profile-like-a-compatibility-analyst": (
    <>
      <p>
        There are two ways to read a dating profile. The first is the way almost everyone does it: do I like them? Am I attracted? Do they seem cool?
      </p>
      <p>
        The second is the way someone trying to predict an actual relationship would do it: what specific signals is this person sending, and what do those signals tell me about how we would actually fit together day-to-day?
      </p>
      <p>
        The second way takes ninety seconds longer and prevents most of the bad first dates.
      </p>

      <h2>Read the structure, not just the content</h2>
      <p>
        Start with how the profile is built before what's in it. Is the bio long, short, blank? Are the prompts answered with care or with throwaways? Are the photos varied or repetitive? Does the profile feel maintained, or like it was thrown together a year ago and forgotten?
      </p>
      <p>
        These structural signals tell you about effort, intention, and how seriously the person is treating this. Someone with three hastily-chosen photos and "ask me" as their bio is communicating something whether they meant to or not.
      </p>

      <h2>The four dimensions worth reading for</h2>
      <p>
        <strong>Life stage.</strong> What does their actual week probably look like? Are they in a stable job or a chaotic one, do they seem to have a settled friend group, are they in their hometown or transient? Stage compatibility matters more than personality compatibility in early dating, because misaligned stages produce conflict you can't talk your way out of.
      </p>
      <p>
        <strong>Energy.</strong> Read for whether this person sounds high-output or low-output, social or solitary, ambitious or content. None of these are good or bad — but pairing high-output with someone who needs a slow domestic life rarely works, no matter how much you like them in conversation.
      </p>
      <p>
        <strong>Communication style.</strong> Their bio and prompts are a writing sample. Do they explain things, do they joke, do they hedge, do they use sarcasm, do they over-explain, do they leave things implied? You're going to be communicating with them constantly if this works. Notice how the communication feels to read.
      </p>
      <p>
        <strong>What's not said.</strong> Almost every profile has a noticeable absence — no mention of work, no mention of friends, no mention of family, no mention of where they live. Absences are signals. They're not necessarily problems, but they're worth noting.
      </p>

      <h2>The mental exercise</h2>
      <p>
        After reading a profile, before you swipe, imagine the third Wednesday after a hypothetical fourth date. You're at home, you're tired, they text you. What does that text look like? What does dinner together look like? Are you texting friends about them, are you avoiding talking about them, are you bored, are you energised?
      </p>
      <p>
        You can't know for sure, of course. But the brief imaginative exercise reliably surfaces compatibility instincts that the fast swipe completely misses.
      </p>

      <h2>The questions that come from the read</h2>
      <p>
        Reading a profile this way also generates better first messages. Instead of complimenting a photo, you can reference something the profile suggested about how they live — "Your bio reads like someone who's recently moved cities and is figuring out their footing — true, or am I reading too much into it?" — and the conversation starts at a different depth than 99% of openers.
      </p>
      <p>
        That depth is what makes it possible to know, by message five, whether to actually go on a date.
      </p>
    </>
  ),

  "dating-app-burnout-reset": (
    <>
      <p>
        Dating app burnout doesn't announce itself. It arrives slowly, as a flatness — swipes that feel mechanical, matches that feel like obligations, conversations that feel like work you didn't ask for.
      </p>
      <p>
        And the standard advice — take a break, delete the apps, focus on yourself — almost never actually addresses what's causing the burnout, because the burnout isn't really about the apps.
      </p>

      <h2>The actual loop</h2>
      <p>
        What's burning you out isn't the volume of swiping. It's the specific neurological loop the apps train you into: short bursts of novelty + intermittent reward + low-stakes rejection + repetition. After enough cycles, your brain stops registering the matches as anything meaningful, and starts processing the whole experience as transactional.
      </p>
      <p>
        Once the experience is transactional, every match feels like one more small obligation. Every conversation feels like one more thing to maintain. The interesting people start to blur with the uninteresting ones, because your attention isn't sharp enough to tell them apart anymore.
      </p>

      <h2>Why deleting the apps doesn't fix it</h2>
      <p>
        Two weeks off and you'll feel better. Then you'll reinstall, and within four days you'll be in the same loop, because the loop wasn't caused by the apps — it was caused by how you were using them.
      </p>
      <p>
        The break gives your nervous system a rest, but it doesn't change the patterns you'll resume the moment you re-engage.
      </p>

      <h2>The reset that actually works</h2>
      <p>
        Three changes, in order:
      </p>
      <p>
        <strong>First, cap your swipe sessions.</strong> Not an absolute swipe count — a time cap. Ten minutes, twice a day, maximum. The burnout is largely produced by the volume, and capping the time is the cleanest intervention.
      </p>
      <p>
        <strong>Second, make every swipe deliberate.</strong> Stop fast-swiping. For every profile, you should be able to articulate one specific reason you swiped the way you did. This forces your attention back on, and turns swiping from a reflex into a choice.
      </p>
      <p>
        <strong>Third, treat your matches like fewer matters more.</strong> Instead of trying to keep ten conversations going at a sub-engaged level, pick the three you're actually interested in and let the others lapse. The apps' design rewards volume; the actual dating part rewards focus.
      </p>

      <h2>What to do during the reset</h2>
      <p>
        The reset doesn't work in isolation. Use the time you used to spend swiping on the part of dating most people skip: figuring out what you actually want and what kind of partner that points to.
      </p>
      <p>
        That sounds soft, but it's the part that determines whether you're filtering well when you're back in the apps. Almost everyone's filters are running on autopilot. The reset is the chance to actually look at them.
      </p>

      <h2>The signal that it's working</h2>
      <p>
        You'll know the reset has worked when a match arrives and you feel something specific about that match — not the generic "okay let me reply" flatness. That specific feeling is what you used to have before the burnout. The goal isn't to feel that about every match — it's to be able to feel it about any match at all.
      </p>
    </>
  ),

  "voice-notes-on-dating-apps": (
    <>
      <p>
        Voice notes on dating apps started as a Hinge novelty and have become a small ritual: the moment in a conversation where the energy is good enough to feel like text isn't quite enough, but a phone call would be too much.
      </p>
      <p>
        They're also one of the highest-leverage moves on a dating app, because a voice note carries information that text physically can't — and people read that information faster than they realise.
      </p>

      <h2>What a voice note actually transmits</h2>
      <p>
        The literal content of a voice note often matters less than the carrier signal: your voice quality, your cadence, your laugh, your background, whether you sound relaxed or rehearsed, whether you sound like a person someone would enjoy being in a room with.
      </p>
      <p>
        Most people, when they finally hear a match's voice for the first time, make a small fast judgment. The judgment isn't about content. It's about whether the voice fits the version of the person they'd built in their head from text — and whether they'd want to keep listening.
      </p>

      <h2>The good voice note</h2>
      <p>
        Twenty to forty-five seconds. Not rehearsed. Not the audio-version of a long text. It answers something specific from the conversation and adds one detail you couldn't have texted as easily — a tone shift, an aside, an actual laugh.
      </p>
      <p>
        The sound quality matters more than people think. Sent from a quiet room, no wind, no echo. The brain registers acoustic clarity as confidence.
      </p>
      <p>
        It ends naturally. The worst voice notes peter out into "uhh I guess that's it" because the sender wasn't sure when to stop.
      </p>

      <h2>The bad voice note</h2>
      <p>
        Over a minute long, especially the first one. (Long voice notes from someone you don't yet know feel like an imposition.)
      </p>
      <p>
        Sent from a moving car or a loud street. Bad audio makes a great voice sound bad, and there's no recovering from the first impression.
      </p>
      <p>
        Overly performative. If you sound like you're auditioning, you'll trigger a small wince in the listener that has nothing to do with you and everything to do with feeling like they're being marketed to.
      </p>

      <h2>When to send one and when not to</h2>
      <p>
        Send one when: the text conversation is going well and you've been at it for at least a few exchanges, you'd like to add warmth, and you have something specific to say that benefits from tone.
      </p>
      <p>
        Don't send one when: you're nervous and trying to "make a move," the conversation is fragile and you're trying to revive it, or you're using it as a substitute for actually suggesting a meet-up.
      </p>
      <p>
        Voice notes don't fix bad conversations. They amplify the existing energy — good or bad — by an order of magnitude.
      </p>

      <h2>If you can't bring yourself to send one</h2>
      <p>
        Many people are quietly uncomfortable with how they sound, and avoid voice notes for that reason. Worth knowing: the version of your voice you hear in a recording is not how others hear it, and your aversion is almost always more intense than anyone else's reaction.
      </p>
      <p>
        Record one, listen back, decide if it sounds reasonable, send it. The discomfort fades by the third one — and you've added a tool that lets your matches actually meet you, not the text version of you.
      </p>
    </>
  ),

  "post-date-reflection-questions": (
    <>
      <p>
        Most post-date reflection happens in one of two unhelpful modes. Either you're spiralling — did they like me, why haven't they texted, was that joke too much — or you've already rendered a verdict that closes the case before you've learned anything from it.
      </p>
      <p>
        Neither of those modes makes you better at dating. They just make you tireder.
      </p>
      <p>
        The reflection that actually compounds — date after date, year after year — answers a different set of questions.
      </p>

      <h2>The six questions</h2>
      <p>
        <strong>1. What did I notice about myself tonight?</strong> Not about them. About you — your energy, your nerves, your defaults, the moments you became someone slightly different than usual. The dating context surfaces things about you that don't surface in any other context.
      </p>
      <p>
        <strong>2. When was I most present, and when did I check out?</strong> Most dates have a small inflection point where you either leaned in or leaned out. Knowing where those points are, for you specifically, is the most useful self-knowledge dating produces.
      </p>
      <p>
        <strong>3. What did they say that I want to remember?</strong> Not just because it was funny or interesting — because it told you something about who they actually are. The detail might matter on date three, or it might matter in two months when you're trying to decide something.
      </p>
      <p>
        <strong>4. What did I avoid asking?</strong> There's almost always a question you didn't ask — about their ex, about what they want, about something that came up. The avoidance is informative. Sometimes it's healthy boundaries; sometimes it's a pattern of not wanting to know.
      </p>
      <p>
        <strong>5. What would have to be true for me to want a second date?</strong> Phrasing it this way is more useful than "do I want a second date" — because the conditional reveals what's actually load-bearing for you. The honest answer is often surprising.
      </p>
      <p>
        <strong>6. If they came back six months from now and asked me one question, what would I want them to ask?</strong> A weird question, deliberately. It tests how much of the actual you came out tonight. If you'd want them to ask about something you never mentioned, you weren't showing up as yourself.
      </p>

      <h2>Why these specifically</h2>
      <p>
        These questions don't generate verdicts. They generate signal — about you, about how you date, about what you actually want.
      </p>
      <p>
        Over enough dates, the answers form a pattern. The pattern is more valuable than any individual answer, because it tells you who you become in romantic contexts — which is the most important thing to know if you want any of those contexts to work out long-term.
      </p>

      <h2>How long this should take</h2>
      <p>
        Five minutes. Voice memo, journal entry, notes app — whichever you'll actually do.
      </p>
      <p>
        Done within a few hours of the date, before you've consolidated the night into a single narrative. The point isn't to make the date conclusive. It's to capture what's still ambiguous, because the ambiguous parts are usually where the learning is.
      </p>
    </>
  ),

  "what-your-message-history-reveals": (
    <>
      <p>
        If someone handed you a transcript of every dating app conversation you've had in the last year — every opener, every reply, every fade-out — you'd be looking at the most honest data about how you actually date that exists anywhere in the world.
      </p>
      <p>
        And almost no one ever looks at it.
      </p>

      <h2>The patterns you can only see in aggregate</h2>
      <p>
        Any individual conversation feels unique while you're in it. Across fifty conversations, you'd find the same things happening over and over:
      </p>
      <p>
        <strong>Your initiation default.</strong> You probably open conversations the same way every time — same length, same structure, same approximate tone. That default is doing a huge amount of filtering you weren't aware of.
      </p>
      <p>
        <strong>Your reply latency pattern.</strong> The gap between when you receive a message and when you reply is shockingly consistent per person. It's also one of the strongest signals the other person uses to read your interest, separate from anything you said.
      </p>
      <p>
        <strong>The questions you never ask.</strong> Look at five of your old conversations and count how many times you asked about: their family, their last relationship, what they want in the next year, what their week actually looks like. Patterns of avoidance are visible only when you look at multiple conversations at once.
      </p>
      <p>
        <strong>Where things stall.</strong> Most of your conversations probably die at the same approximate point — message seven, message twelve, the point where someone needs to suggest a meet-up. If you find that point, you've found your highest-leverage thing to change.
      </p>

      <h2>The attachment signature in your messages</h2>
      <p>
        Your attachment style leaves fingerprints all over your text. Anxious-leaning messages tend to be longer than the previous one, include more questions, and trail off with self-deprecating asides. Avoidant-leaning messages tend to be exactly as long as needed, drop emotional content casually, and rarely follow up on something the other person opened up about.
      </p>
      <p>
        These aren't conscious. Which is exactly why they're worth looking at — because the version of you that's writing the messages at 11pm on a Tuesday isn't the version of you that's thinking about your dating life on a Saturday afternoon.
      </p>

      <h2>The thing nobody wants to look at</h2>
      <p>
        The hardest pattern to see is the one where you're consistently the version of yourself you don't actually want to be — too eager, too distant, too performative, too sarcastic, too earnest, too whatever. That pattern is almost always there if you look across enough conversations.
      </p>
      <p>
        Seeing it isn't a judgment. It's the only way to choose differently next time, because you can only change what you can name.
      </p>

      <h2>How to actually look</h2>
      <p>
        Read five of your recent conversations end-to-end. Not skimming. Read them like a stranger would read them — like you're trying to figure out who this person is from how they text.
      </p>
      <p>
        Write down three things you notice. Don't judge them yet — just notice.
      </p>
      <p>
        Those three things are usually the same three things across most of your conversations, and they're usually the leverage points where small changes produce large different outcomes.
      </p>
    </>
  ),

  "love-pace-mismatch": (
    <>
      <p>
        Two people meet, like each other, start dating, and somewhere around week six it quietly falls apart. Nothing dramatic. They both still describe the other person as great. They just stop reaching for each other and one of them eventually puts it into words.
      </p>
      <p>
        If you've had this happen more than twice, you're not unlucky — you're hitting a pattern. The most common version is what we'd call a love-pace mismatch, and the silence about it is what kills more promising relationships than chemistry ever does.
      </p>

      <h2>What love-pace actually means</h2>
      <p>
        Love-pace is the speed at which you naturally develop feelings, escalate contact, and want to integrate someone into your life. It's not the same as how interested you are. Two equally interested people can operate on completely different pacing systems.
      </p>
      <p>
        Fast-pace people feel things early and act on them — they're texting daily by week one, picturing the future by week three, introducing you to friends by month two. Slow-pace people are doing the opposite work: holding the same level of interest but moving it slower because they need evidence, time, and a sense of the real person before opening.
      </p>
      <p>
        Neither is wrong. Both are valid operating systems. The problem is that they don't naturally translate, and most people don't know how to name what's happening.
      </p>

      <h2>How the mismatch actually plays out</h2>
      <p>
        Week one: both people are excited. Week two: the fast-paced person is texting more, suggesting plans more, sharing more. The slow-paced person is into it but feels the asymmetry as pressure, even when nothing is being explicitly asked for. They pull back slightly to find their pace.
      </p>
      <p>
        Week three: the fast-paced person reads the pullback as cooling interest. They get anxious. They either chase harder (worse) or pull back themselves to protect (also worse). Either way, the warmth that was real two weeks ago is now mediated by both people managing each other instead of meeting each other.
      </p>
      <p>
        By week six, both people have built a quiet story: "they're not as into me as I thought" or "they were too much." Neither story is accurate. The pace mismatch was never named, so it became a verdict on the connection itself.
      </p>

      <h2>The one conversation that changes everything</h2>
      <p>
        Naming the pacing difference around week three — kindly, specifically, and without making it a problem — is one of the most underused moves in dating. It sounds like:
      </p>
      <blockquote>
        "I notice I tend to move pretty fast when I like someone. I want to make sure I'm pacing this in a way that works for you too — let me know if I'm too much or too little."
      </blockquote>
      <p>
        Or from the other direction:
      </p>
      <blockquote>
        "I want you to know I'm in this — I just move slower than I sometimes wish I did. If I go quiet for a day it's not because I'm losing interest."
      </blockquote>
      <p>
        Both of those sentences sound vulnerable. They are. They're also what makes the next four weeks possible.
      </p>

      <h2>How to know your own pace</h2>
      <p>
        Most people have never thought explicitly about their own love-pace, which is why the mismatch is so common — you can't communicate something you can't name. Some signals:
      </p>
      <p>
        <strong>You're probably fast-pace</strong> if you can usually tell by date three whether you want to keep seeing someone, if you initiate plans easily, and if the silence between texts feels like content rather than rest.
      </p>
      <p>
        <strong>You're probably slow-pace</strong> if your strongest reactions to people show up in month two rather than week two, if quick escalation feels suffocating even when you like the person, and if you need time alone to register what you actually felt.
      </p>
      <p>
        Both can build something real. Neither is closer to "right." The work is the conversation, not the pace.
      </p>

      <h2>What to do this week</h2>
      <p>
        If you're currently in a promising new connection: name your pace once. Don't apologise for it. Don't make it heavy. Just say it as information, the way you'd mention being a morning person.
      </p>
      <p>
        If you're between connections: write down how the last three ended. If the pattern is "they cooled" or "they pulled back," check whether what actually happened was a pace mismatch that neither of you ever discussed.
      </p>
    </>
  ),

  "conflict-instinct-says-everything": (
    <>
      <p>
        You can read a hundred bios. You can have a great first date. You can spend a month texting someone funny and warm and easy. None of it tells you the thing that matters most about whether the third month is going to happen.
      </p>
      <p>
        The thing that matters is what they do the first time you accidentally hurt each other. And the inverse: what you do.
      </p>

      <h2>The five common conflict instincts</h2>
      <p>
        Most people fall into one of five patterns when tension hits in early dating. Knowing which one is yours — and which one they have — predicts the next six months better than anything else.
      </p>
      <p>
        <strong>The Confronter</strong> brings it up in the moment, directly, without much wrap. Honest, fast, useful — and can read as aggressive to anyone who needs runway.
      </p>
      <p>
        <strong>The Processor</strong> goes quiet, thinks it through, and comes back with something considered. Their delayed responses are the work, not the avoidance — but to a partner who needs reassurance in the moment, the delay can feel like punishment.
      </p>
      <p>
        <strong>The Smoother</strong> protects the connection by shifting the energy. Jokes, redirects, "let's not let this ruin the night." Great in the moment, hazardous over months because the things that didn't get said become resentments wearing a costume.
      </p>
      <p>
        <strong>The Archiver</strong> doesn't make a thing of any individual moment. They track the pattern across weeks. Wise — and quietly devastating when the partner finds out months later that there was a list they were being measured against without knowing.
      </p>
      <p>
        <strong>The Repairer</strong> can name what hurt and restitch the connection in the same conversation. Rarest. The closest thing to a relationship superpower.
      </p>

      <h2>Why early matters more than later</h2>
      <p>
        The pattern you set in the first hard moment becomes the template for every subsequent hard moment. If the first time someone hurt your feelings you went quiet, the third time you'll go quiet faster. If they jokingly deflected, they'll deflect harder next time.
      </p>
      <p>
        The patterns are not destiny — they can be changed, but only when they're seen. And early dating is when they're easiest to see, because the stakes are still low enough to actually look at them.
      </p>

      <h2>The "what would make me trust you more" question</h2>
      <p>
        One of the most useful exercises after any small early-relationship friction is to ask yourself: <em>what would they need to do in this moment to make me trust them more?</em>
      </p>
      <p>
        Most of the time the answer is small and specific. Acknowledge what happened. Say the apology and the change in the same sentence. Not perform repair — just do the actual thing. The people who can do this are rare and worth pacing yourself to find.
      </p>

      <h2>The mismatch nobody talks about</h2>
      <p>
        Confronters with Processors look like a flashpoint pairing — and they are, for the first two months. But they're actually one of the most stable long-term combinations, because both styles are honest. The Confronter learns to give the Processor time. The Processor learns to name the delay rather than disappear into it. It works.
      </p>
      <p>
        Smoothers paired with Smoothers look like the easiest relationship in the world for the first six months. And then the unspoken stuff hits critical mass and the whole thing goes quiet in a month. The pattern that protected the early connection eats it later.
      </p>

      <h2>What to do this week</h2>
      <p>
        Identify your own instinct. Then identify the instinct of the last person you dated. If you can't remember any moment of friction in the first three months, that's information: one or both of you was smoothing.
      </p>
      <p>
        For the next person: pay attention not to the first kiss or the first deep talk, but to the first thing that landed wrong. Watch what they do. Watch what you do. That moment is the data.
      </p>
    </>
  ),

  "soft-boundary-trap": (
    <>
      <p>
        You said no. You said it kindly. You wrapped it in three layers of "but I totally understand if" and "I'm sorry I'm being weird about this" and offered a backdoor in case they wanted to push.
      </p>
      <p>
        They pushed. You partially gave. They pushed again. By the time the conversation ended you had agreed to something you'd already explicitly said no to twice. And you spent the rest of the day quietly furious at yourself, and slightly at them.
      </p>
      <p>
        This is the soft-boundary trap, and it's almost always self-imposed. The person you're with isn't trying to manipulate you. They're responding to the actual signal you sent — which was, "this might be no, but the door's open if you'd like to keep negotiating."
      </p>

      <h2>The math of soft boundaries</h2>
      <p>
        Every boundary you set has two parts: the limit itself, and the wrapper around it. The wrapper is where soft-boundary people put 90% of their effort and 100% of their anxiety.
      </p>
      <p>
        The wrapper is meant to do two things at once: protect the other person from feeling rejected, and protect you from being seen as rigid. The problem is that the wrapper consistently undermines the limit. The more padding you add, the more negotiable your no sounds — even when it isn't.
      </p>

      <h2>Why the wrapper grows</h2>
      <p>
        Soft-boundary patterns usually trace back to one of three places: you learned early that saying no got punished, you learned that being "easy" was your value to people, or you developed an over-tuned sense of how rejection feels and started preemptively cushioning everyone else from it.
      </p>
      <p>
        None of these are personality flaws. They're sophisticated systems built when softness was the right tool. The trap is keeping them on default mode once you're an adult who can actually handle someone being briefly disappointed.
      </p>

      <h2>What clarity actually sounds like</h2>
      <p>
        Clarity isn't bluntness. It's the absence of negotiability. Compare:
      </p>
      <blockquote>
        "Yeah I mean, I might, I think I'm pretty tired tonight and I have a thing tomorrow, but if it's important we can totally figure something out — sorry, I'm being weird, what do you want to do?"
      </blockquote>
      <blockquote>
        "I can't tonight — I'm too tired to be good company. Let's do Saturday."
      </blockquote>
      <p>
        Both are honest. Both are kind. Only one of them ends the negotiation.
      </p>

      <h2>The "and" reframe</h2>
      <p>
        One of the highest-leverage skills in boundary work is replacing "but" with "and." Watch:
      </p>
      <p>
        "I can't do this, <strong>but</strong> I want you to know I really like you" — the "but" makes the second clause feel like consolation, which makes the first clause feel like rejection.
      </p>
      <p>
        "I can't do this, <strong>and</strong> I really like you" — the "and" makes both true at once. The limit doesn't have to mean less interest. Most people have never been taught this.
      </p>

      <h2>The thing your nos do for your yeses</h2>
      <p>
        The reason real boundaries matter is not that they protect you — though they do. It's that they make your yeses mean something. If your no is negotiable, your yes is also conditional. If your no is real, your yes is too.
      </p>
      <p>
        People with real boundaries are easier to be with, not harder, because everyone can stop guessing. Their friends, their dates, their family, themselves.
      </p>

      <h2>What to do this week</h2>
      <p>
        Pick one no you're avoiding. Write it out as a single sentence. Notice every word you added to soften it. Then write the version with just the no and one neutral reason. Practice saying it out loud.
      </p>
      <p>
        Then say it for real, once, this week. Notice that nothing terrible happens. The discomfort fades in 15 minutes. The clarity stays.
      </p>
    </>
  ),

  "second-brain-for-dating": (
    <>
      <p>
        The promise of dating apps is that more options will eventually produce the right one. The reality, ten years in, is that more options produce more noise, more fatigue, and more of the same patterns repeating with different faces.
      </p>
      <p>
        Most people don't need another app. They need a layer on top of the apps they already have — a private space that remembers what they noticed, surfaces the patterns they're not tracking, and tells them what their last six dates have in common.
      </p>
      <p>
        That's what we mean by a second brain for your dating life. It's a quiet, persistent system that does the cognitive work nobody else is doing for you.
      </p>

      <h2>What your dating brain is currently storing</h2>
      <p>
        Right now, your dating life lives in seven places: three apps, your camera roll, three group chats, your memory, and a vague sense of how things have been going. None of these talk to each other. None of them remember the small thing you noticed on date two that you forgot by date five.
      </p>
      <p>
        The cost isn't obvious in any single moment. It shows up in the aggregate — the patterns you don't see, the date you didn't realise was the third "let's grab dinner sometime" that never materialised, the type of person you keep ending up with even though you keep saying you want someone different.
      </p>

      <h2>What a real second brain does</h2>
      <p>
        At minimum, a working second brain for dating does four things:
      </p>
      <p>
        <strong>1. It captures friction-free.</strong> Post-date notes that take 60 seconds. Voice memos that turn into structured signals. Pasted screenshots that become observable patterns. If logging takes effort, you won't do it.
      </p>
      <p>
        <strong>2. It surfaces patterns you can't see.</strong> You can't notice that you've initiated 80% of your conversations because you don't have a count. You can't notice that every date with someone who has a specific energy ends after the third date — until something else counts the dates.
      </p>
      <p>
        <strong>3. It runs the analysis when you ask.</strong> A real read on a new match's profile. A real assessment of how a message will land before you send it. A real summary of how this week was different from last week.
      </p>
      <p>
        <strong>4. It belongs to you.</strong> Not to a dating company optimising for your continued swiping. To you, exportable, deletable, with explicit consent for anything that touches it.
      </p>

      <h2>Why now</h2>
      <p>
        The technology for this has only been good enough for about 18 months. Large language models can finally hold the nuance of a paragraph of text and return something specific instead of generic. OCR can pull a profile out of a screenshot reliably. Storage is cheap enough that capturing every detail is no longer the limit — making sense of it is.
      </p>
      <p>
        The result is that for the first time you can run analysis on your own dating data the way a marketing team would run analysis on their funnel. Not because you're a project — because the patterns are real and worth seeing.
      </p>

      <h2>What this isn't</h2>
      <p>
        It isn't a matchmaker. We don't want to be the third dating app on your phone. The world is full of those.
      </p>
      <p>
        It isn't surveillance. The hard line is consent: nothing gets analysed without you turning it on, you can see exactly what's been processed, and you can wipe it any time.
      </p>
      <p>
        It isn't a replacement for therapy, friends, or your own judgement. It's the layer that makes those other things sharper because it remembers what you actually said you wanted three months ago, before the current crush rewrote the story.
      </p>

      <h2>What to do this week</h2>
      <p>
        Start with one log: write three sentences about your last date or last week of dating. What you noticed, how you felt, what you'd do differently. Don't optimise it. Just capture it.
      </p>
      <p>
        Do it twice more this week. By the end of a month you'll have something you've never had before: an honest record of your own dating life, in your own words, that you can actually read and learn from.
      </p>
      <p>
        Everything else we build for you sits on top of that.
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

  useEffect(() => {
    trackEvent("blog_post_view", { slug: article.slug, category: article.category });
  }, [article.slug, article.category]);

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
              <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: `${withAlpha(article.color, 0.12)}`, color: article.color, border: `1px solid ${withAlpha(article.color, 0.25)}` }}>
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

          {/* CTA — per-article when defined, otherwise generic audit CTA */}
          {(() => {
            const cta = article.cta ?? {
              title: "Get your free Profile Signal Audit",
              body: "Find out exactly what your profile is communicating — Signal Score, bio critique, prompt rewrites, and a 7-day action plan.",
              href: "/start",
              label: "Start free audit — takes 3 minutes",
            };
            const borderColor = withAlpha(article.color, 0.25);
            return (
              <motion.div
                {...fadeUp(0.2)}
                className="mt-14 glass rounded-2xl p-6 text-center"
                style={{ borderColor, borderWidth: "1px", borderStyle: "solid" }}
              >
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50 mb-2">Put this into practice</p>
                <h3 className="font-serif text-xl font-bold text-foreground mb-3">{cta.title}</h3>
                <p className="text-sm text-muted-foreground mb-5 max-w-sm mx-auto">{cta.body}</p>
                <Link
                  href={cta.href}
                  onClick={() => trackEvent("blog_cta_click", { slug: article.slug, cta_href: cta.href, cta_label: cta.label })}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#3D35CC] to-[#FF2D9B] text-white font-semibold rounded-xl hover:opacity-90 transition-opacity text-sm"
                >
                  <Sparkles className="w-4 h-4" /> {cta.label}
                </Link>
              </motion.div>
            );
          })()}

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