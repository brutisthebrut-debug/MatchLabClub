import { useEffect } from "react";
import { withAlpha } from "@/lib/brandColor";
import { Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMeta } from "@/hooks/useMeta";
import { motion } from "framer-motion";
import { Clock, ArrowLeft, ArrowRight, Sparkles, BookOpen } from "lucide-react";
import { ARTICLES } from "@/lib/blogArticles";
import { QUIZ_BY_BLOG_SLUG, getQuizBySlug } from "@/lib/quizzes";
import { trackEvent } from "@/lib/analytics";
import { ShareButton } from "@/components/echo/ShareButton";
import { useAuth } from "@workspace/replit-auth-web";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] as const },
});

// ── Article content ──────────────────────────────────────────────────────────

const ARTICLE_CONTENT: Record<string, React.ReactNode> = {
  "what-actually-predicts-second-dates": (
  <>
  <p>
  I asked a handful of thirty-something friends what they thought predicted a second date. They guessed chemistry. They guessed attractiveness. They guessed whether you laughed. They were wrong about the order.
  </p>
  <p>
  The thing that predicts a second date most reliably is whether both people felt slightly more themselves at the end of the date than at the start.
  </p>
  <p>
  Not impressed. Not entertained. Themselves.
  </p>
  <p>
  That sounds soft. It is not. There is a specific behavioral signature when someone feels more themselves after spending time with you. They make a callback joke to something you said an hour earlier. They text the next day before you do. They are not "interested" in some abstract way. They are uncurled.
  </p>
  <p>
  Most date post-mortems chase the wrong variable. People review what they said, what they wore, whether the conversation flowed. The relevant question is downstream of all of that. Did the person across the table get smaller or larger inside themselves while sitting there.
  </p>
  <p>
  You can usually tell.
  </p>
  <p>
  I had a date in March that I thought was a disaster. I rambled about a podcast for too long. I knocked over a beer. The lighting in the bar was unflattering and I knew it. She texted the next morning. She wanted to see me again. I asked her why later, after we had been seeing each other for a few weeks. She said she had felt allowed to be sarcastic. I had laughed at something dry she said early in the date and from there she stopped editing herself. The beer did not matter. The podcast did not matter. The fact that she did not have to perform did.
  </p>

  <h2>The four micro-signals that actually correlate</h2>
  <p>
  Across the post-date debriefs I have looked at in the Mirror, four signals show up over and over in the dates that lead to second ones. None of them are about chemistry in the way the word usually gets used.
  </p>
  <p>
  <strong>One. Specific recall.</strong> After the date, you can name three things they said, not three things you said. If your post-date narrative is mostly about your own performance, you were on stage. They probably were too.
  </p>
  <p>
  <strong>Two. Unhurried pacing.</strong> Forty-five minutes can feel generous. Two hours can feel pressured. The variable is not duration. It is whether either of you was running an internal clock the whole time.
  </p>
  <p>
  <strong>Three. A surprise turn.</strong> Some part of the conversation went somewhere neither of you planned to go. This is the single best signal that the date had any real contact in it. Predictable conversations almost never lead to second dates.
  </p>
  <p>
  <strong>Four. Self-deprecation that landed safely.</strong> One of you admitted a small thing about yourself, and the other did not make a face that said "noted." Real warmth has a specific shape, and that is the shape.
  </p>

  <h2>What does not predict it</h2>
  <p>
  A lot of what people grade themselves on does not actually matter. Whether you were "funny enough." Whether you had a strong opener. Whether they were obviously attracted to you in the first thirty seconds. These are real, but they predict a first impression. They do not predict the second date.
  </p>
  <p>
  The first impression is the entry fee. The second date is paid for by something else, and that something else is mostly atmospheric. It is the quality of attention each of you brought.
  </p>

  <h2>The thing about attention</h2>
  <p>
  I am suspicious of the word "presence." It has been worn smooth by yoga studios. But there is a real thing it points to.
  </p>
  <p>
  A friend of mine who is a therapist told me once that she can tell within five minutes of a first session whether someone is going to make progress. The signal is not what they say. It is whether they are listening to themselves while they say it. People who land on their own sentences make progress. People who deliver pre-written sentences do not.
  </p>
  <p>
  The same thing applies to dates. You can usually tell whether the person across from you is reaching for something in real time or reciting. Reaching is contagious. Reciting closes a room.
  </p>

  <h2>The follow-up text is downstream</h2>
  <p>
  People obsess about the follow-up text. Whether to send it first. How long to wait. What it should say.
  </p>
  <p>
  In practice the text writes itself when the date had genuine contact in it. You will know what to reference. There will be a callback. The decision will not feel like a strategy problem.
  </p>
  <p>
  If you find yourself drafting and redrafting the next-day text, that itself is information. You are trying to manufacture something the date did not produce. Sometimes the date still leads to a second one. More often it does not.
  </p>

  <h2>How to run a useful post-mortem</h2>
  <p>
  Skip the question "did it go well?" It is too vague to debug. Try these instead.
  </p>
  <p>
  What did they say that I am still thinking about?
  </p>
  <p>
  When did I feel most like myself?
  </p>
  <p>
  When did I feel least like myself?
  </p>
  <p>
  Was there a moment one of us steered the conversation somewhere unexpected? Who steered it?
  </p>
  <p>
  If you can answer those, you will know whether to ask for a second date, and you will have a better sense of whether they will say yes.
  </p>
  <p>
  I keep these in my Mirror because I forget otherwise. Three weeks later you cannot reconstruct the texture of a date from memory. You can reconstruct the headline. The headline is rarely the useful thing.
  </p>
  </>
  ),

  "values-mismatch-shows-up-early": (
  <>
  <p>
  The cliché is that values mismatches reveal themselves over time. In my experience the opposite is true. They show up by date three. The reason people miss them is that values rarely announce themselves in the language of values.
  </p>
  <p>
  They show up as small frictions you talk yourself out of.
  </p>
  <p>
  You suggest splitting the bill. He looks faintly disappointed. You explain to yourself that he is old-fashioned, that this is sweet, that you are being a feminist about something that does not matter. What actually happened: he runs a money script you do not run, and it will become a louder script later.
  </p>
  <p>
  Or. She asks where you grew up and you say "small town in the Midwest" and she says "oh, weird" with a half-smile, and you laugh, and you do not bring it up again. What happened: she has a worldview about geography and class that you have absorbed as a joke. It will not stay a joke.
  </p>

  <h2>The shape of an early values signal</h2>
  <p>
  Values do not show up as positions in a debate. They show up as reflexes.
  </p>
  <p>
  The reflex of who reaches for the bill. The reflex of how someone refers to their family. The reflex of what they say when a barista is rude. The reflex of how they describe their last partner. None of these are conversations. They are the data underneath the conversations.
  </p>
  <p>
  A friend of mine spent four months with someone whose only red flag, in retrospect, was the way he talked about his ex. Not the words. The tone. There was a specific scorn that she registered and dismissed. She told me about it the first week. By month three, the scorn was being aimed at her sister. By month four it was being aimed at her.
  </p>
  <p>
  Reflexes scale. They never stay confined to the people they started with.
  </p>

  <h2>The "I'll figure that out later" voice</h2>
  <p>
  There is a voice that goes off in the third hour of a third date. It says: this is not quite right but it is fine and I will figure it out later.
  </p>
  <p>
  That voice is almost always picking up on a values thing. Logistics and personality you can usually solve. Values you can only accept or leave. The voice knows the difference even when you have not articulated it yet.
  </p>
  <p>
  I would rather you trust that voice early than romance it away and discover it again in eight months, after you have rearranged your apartment.
  </p>

  <h2>Five common early signals</h2>
  <p>
  <strong>One.</strong> How they treat people whose attention they do not need. Servers, drivers, the person at the next table. This is the cleanest values test in dating and it shows up by date one.
  </p>
  <p>
  <strong>Two.</strong> How they describe their own work when it is going badly. Do they take responsibility for outcomes or assign it elsewhere by default? You are listening for the default, not the truth of the specific story.
  </p>
  <p>
  <strong>Three.</strong> What they spend money on without thinking about it. Not big purchases. The small reflexes. The tip. The Uber when they could walk. The bottle of wine that is forty dollars instead of twenty. Money is a values fingerprint.
  </p>
  <p>
  <strong>Four.</strong> How they talk about their parents in a casual aside. Not the formal answer to "how are you with your family." The throwaway sentence in the middle of a different story.
  </p>
  <p>
  <strong>Five.</strong> What they do with silence. Some people fill it because they cannot tolerate it. Some people use it. Some people weaponise it. The relationship with silence is a values relationship even though it does not look like one.
  </p>

  <h2>What is not a values mismatch</h2>
  <p>
  A lot of early friction is not values. It is taste, or mood, or context. He likes loud restaurants and you do not. She thinks brunch is a waste of a Sunday and you do not. These are real and they will create wear over time, but they are negotiable in a way values are not.
  </p>
  <p>
  The test is whether the friction implies a different worldview underneath it. Loud restaurants do not imply a worldview. Loud restaurants because "what is the point of being out if you cannot be heard" is starting to imply one.
  </p>
  <p>
  I keep getting this wrong in both directions. Sometimes I treat a taste difference as a values gap and sabotage something workable. Sometimes I treat a values gap as a taste difference and walk into a wall. The Mirror helps because writing it down forces me to distinguish them.
  </p>

  <h2>The conversation that actually works</h2>
  <p>
  The standard "let us align on values" conversation does not work. Both people present polished, prepared answers. Of course you both want honesty and growth and a partner you can laugh with. Everyone wants those.
  </p>
  <p>
  The conversation that works is much smaller. It is a specific story. "Tell me about a time you and a friend disagreed about money." "What was the last argument you had with your sibling about?" "When was the last time you changed your mind about something important?"
  </p>
  <p>
  The answers are not the point. The texture of the answers is the point. Whether they have an example at all. Whether they take responsibility inside the story. Whether they think their position is interesting or obvious.
  </p>

  <h2>What to do with what you notice</h2>
  <p>
  You do not have to act on every signal immediately. Most early signals are tentative. But you do have to write them down. Otherwise the third one will feel like the first one because you will have forgotten the previous two.
  </p>
  <p>
  I keep a running line in my Mirror for anyone I am seeing more than once. It is not a scorecard. It is a memory aid. Three weeks in, when something starts to bother me, I want to be able to check whether it has been bothering me from the start or whether it is genuinely new.
  </p>
  <p>
  If a signal has been there from the start, that is information about who they are, not about you.
  </p>
  </>
  ),

  "conflict-instinct-is-a-compatibility-signal": (
  <>
  <p>
  Most people audition partners on a calm Tuesday. They go to a wine bar. They tell good stories. They behave. That tells you almost nothing about who they will be in a relationship.
  </p>
  <p>
  What predicts the relationship is what each of you does on the third bad Wednesday in a row. The instinct under pressure is the data. Almost everything else is presentation.
  </p>
  <p>
  I am not talking about whether someone is "good at conflict." That phrasing has been overused into uselessness. I am talking about something more specific. When a small thing goes wrong between you, what is the very first move each of you makes inside your own head, before any words come out.
  </p>

  <h2>The four conflict instincts</h2>
  <p>
  Across the people I have watched up close, I see four reliable defaults. They are not personality types. They are first moves.
  </p>
  <p>
  <strong>Pursue.</strong> When something is off, the pursuer wants to talk about it now. The silence is unbearable. Distance feels like the actual problem. They will keep moving toward the other person until something gives.
  </p>
  <p>
  <strong>Withdraw.</strong> When something is off, the withdrawer needs to be alone in a room to think. Talking about it before they are ready feels like being grabbed. They are not avoiding. They are buffering.
  </p>
  <p>
  <strong>Manage.</strong> When something is off, the manager tries to lower the temperature first and address the thing second. They make food. They change the subject. They are not denying. They are stabilising.
  </p>
  <p>
  <strong>Sharpen.</strong> When something is off, the sharpener gets cooler and more precise. They use exact words. They reach for examples. They are not attacking. They are debugging.
  </p>
  <p>
  None of these is wrong. All of them work with the right partner. The compatibility question is not which instinct each of you has. It is which pairings degrade and which ones strengthen each other.
  </p>

  <h2>The pairings that quietly destroy things</h2>
  <p>
  Pursue plus withdraw is the most documented pairing in couples therapy and the most common in early dating, and it is the one that ends most quietly. The pursuer reads withdrawal as rejection. The withdrawer reads pursuit as suffocation. Both of them are wrong about the other person's intent and both of them keep being right about the experience.
  </p>
  <p>
  It is not unworkable. But it requires both people to learn a second language, and most couples do not realise they need to until they are years in.
  </p>
  <p>
  Sharpen plus manage is the other quiet killer. The sharpener wants to name the thing exactly. The manager wants the room to come down first. The sharpener experiences the manager's de-escalation as deflection. The manager experiences the sharpener's precision as cold. Neither is acting in bad faith.
  </p>

  <h2>What you can actually observe early</h2>
  <p>
  You will not see a real fight on date three. That is fine. You can see something more useful. Watch how they respond to small frictions that are not about you.
  </p>
  <p>
  The waiter brings the wrong drink. The Uber is late. They get a slightly annoying email while sitting across from you. What is the first thing they do.
  </p>
  <p>
  Do they go quiet for a second and then say something measured. Do they make a sharp joke at the situation's expense. Do they get visibly hot and then visibly try to come back down. Do they immediately try to fix it. The default is right there. It is just running on a different target than you.
  </p>
  <p>
  A friend of mine dated a guy for two months. Their first real argument was about a flight booking, and she said the thing that stopped her cold was not the argument itself. It was that he started using a slightly formal voice, the kind you use in a customer service call. She had seen that voice once before, at dinner, when his food had come out wrong. She had not registered it then. She did now.
  </p>

  <h2>The mistake of grading conflict by outcome</h2>
  <p>
  People often grade an early conflict by whether it got resolved. That is the wrong metric. Of course it got resolved. You barely know each other. Nobody has anything serious at stake yet.
  </p>
  <p>
  The better question is: how did each of you feel inside your body twenty minutes after the thing was over. Both calmer. One calmer and one quietly still revved. Both still revved and pretending. The body answer is more honest than the verbal one.
  </p>
  <p>
  I had a relationship that ended in part because every disagreement officially resolved and I officially felt fine, but my shoulders were always a little high for the rest of the day. I treated the resolution as the data. The shoulders were the data.
  </p>

  <h2>What to do with it</h2>
  <p>
  You cannot pick a partner with the same conflict instinct as you. The pool is not that big and the matching is not that clean. What you can do is notice your default, name theirs, and pay attention to which pairings energise both of you and which ones grind.
  </p>
  <p>
  Compatibility is not the absence of friction. It is friction that produces heat instead of wear. Same instinct, different instinct, complementary instinct, it does not matter. What matters is whether your defaults can metabolise each other or whether they cancel each other out.
  </p>
  <p>
  If you have logged a few small conflicts in the Mirror, you can usually tell which one it is by the second month. Before that you are guessing. After that you are choosing.
  </p>
  </>
  ),

  "the-love-pace-conversation": (
  <>
  <p>
  Two people can want the same thing and still tear each other apart because one of them wants it in six months and the other wants it in three years.
  </p>
  <p>
  Pace is a compatibility dimension hiding in plain sight. It rarely gets named because the headline answers seem to match. Both of you want a serious relationship. Both of you want to move in eventually. Both of you want kids, maybe. The shape of what you want lines up. The clock you want it on does not.
  </p>
  <p>
  That clock is the thing that does most of the damage in years one and two.
  </p>

  <h2>Why nobody asks about pace</h2>
  <p>
  Pace feels weird to ask about. Asking "how fast do you want this to move" on date three sounds like a pressure test. So people skip it. They check for the headline match, decide it is a green light, and then discover six months later that their version of "moving forward" and the other person's version of "moving forward" are two completely different things.
  </p>
  <p>
  I have watched this happen four or five times in the last few years to friends I would describe as emotionally literate. The fail mode is consistent. They both said they wanted commitment. They both meant it. They were on completely different timelines and neither of them said so out loud.
  </p>

  <h2>The three pace signals you can see early</h2>
  <p>
  You do not need to interview anyone. You can read it from three small signals.
  </p>
  <p>
  <strong>The lag between dates.</strong> Not the calendar number. The energy. If two weeks pass and neither of you feels weird, that is a pace tell. If three days pass and one of you is climbing the walls, that is a different pace tell. Neither is wrong. They are just different rhythms.
  </p>
  <p>
  <strong>What "soon" means in their sentences.</strong> Listen to how they use the word "soon" when they talk about their own life. "I want to move soon" from a person who has been thinking about moving for three years means something different than "I want to move soon" from someone who applied for an apartment yesterday. Their personal pace bleeds into their relationship pace.
  </p>
  <p>
  <strong>How they describe their last relationship's arc.</strong> Did it move fast and they thought it was perfect and then it imploded. Did it crawl for two years and then settle. The pattern they describe is usually the pattern they are about to repeat with you, unless they have done specific work to change it.
  </p>

  <h2>The conversation, in plain language</h2>
  <p>
  Once the relationship has shape, somewhere between week four and week eight, you can have a version of the pace conversation that does not feel like an interrogation.
  </p>
  <p>
  Try something like: "I notice we have been doing this thing for about six weeks. I am happy with it. Out of curiosity, when you imagine us in three months, what does that picture look like to you, just roughly."
  </p>
  <p>
  The point is not to lock anything in. The point is to surface the mental model. Their three-month picture and yours might be remarkably aligned. Or one of you might be picturing weekend trips and the other might be picturing apartment hunting. Either is fine. Not knowing is what causes the damage.
  </p>
  <p>
  A friend of mine had this conversation in week seven of seeing someone, expecting alignment. Her picture: still casually dating, maybe a label by month four. His picture: meeting her parents the next month. They worked it out. The point is, they would not have worked it out if they had assumed the headline match was the whole story.
  </p>

  <h2>The three common pace mismatches</h2>
  <p>
  <strong>Fast and slow.</strong> One of you is ready to define things by week three. The other gets visibly tight at any version of the "what are we" conversation before month four. Both versions can be healthy. They cannot coexist by accident.
  </p>
  <p>
  <strong>Bursty and steady.</strong> One of you wants intense weekends and long stretches apart. The other wants four evenings a week of low-key time together. Same total time, different distribution. This one looks like a logistical disagreement and is actually a temperament gap.
  </p>
  <p>
  <strong>Front-loaded and back-loaded.</strong> One of you treats the first six months as the time to "build" the relationship and expects to coast on that foundation later. The other treats the early months as casual and expects the relationship to deepen mostly in years two and three. Both are real patterns. They are not compatible without an explicit deal.
  </p>

  <h2>What pace is not</h2>
  <p>
  Pace is not the same thing as readiness. Someone who has just gotten out of a long relationship may genuinely want commitment and still need a slower pace. Someone who has been single for three years may want to take their time and still want to see you four times a week. Do not confuse the speed of the rhythm with the depth of the intent.
  </p>
  <p>
  Pace is also not the same thing as effort. A slower pace does not mean someone cares less. A faster pace does not mean someone cares more. Both of these things get treated as effort signals when they are actually just personal cadence.
  </p>

  <h2>The check-in nobody does</h2>
  <p>
  The thing that prevents most pace blowups is a single recurring conversation. Once a month, roughly: "Are we moving at a pace that feels right to both of us, or is one of us pulling and the other one drag-footing."
  </p>
  <p>
  Most couples never ask this question because it sounds clinical. It is not. It is the closest thing to a single-question compatibility tune-up that exists. Skip it and the rate at which the relationship deepens becomes an invisible negotiation. Ask it and it becomes a conversation. Conversations are recoverable. Invisible negotiations rarely are.
  </p>
  </>
  ),

  "chemistry-is-not-compatibility": (
  <>
  <p>
  Chemistry is what makes the first three dates feel like a movie. Compatibility is what determines whether you are still in the same room on a Wednesday in February two years later.
  </p>
  <p>
  They feel similar from the inside. They are not the same thing. Confusing them is, by some distance, the single most expensive mistake people make in their dating lives. It costs years.
  </p>

  <h2>What chemistry actually is</h2>
  <p>
  Chemistry is a nervous-system response. It is the specific feeling of a new pattern hitting your defaults in a way that produces alertness. Your heart rate is up. Your jokes are sharper. Your apartment looks nicer. You can feel where they are in a room without looking.
  </p>
  <p>
  This is a real signal. It is not nothing. But it is a signal about the contact itself, not about the long-term viability of the situation.
  </p>
  <p>
  Some of the strongest chemistry I have personally felt has been with people I would not be remotely compatible with on a sustained basis. Some of the most sustainable relationships I have watched friends build started with chemistry that they described as "warm" rather than "electric."
  </p>

  <h2>What compatibility actually is</h2>
  <p>
  Compatibility is whether your defaults rest comfortably against each other when neither of you is performing.
  </p>
  <p>
  Do you fight in similar tempos. Do you spend money in similar ways. Do you handle other people's feelings the same way. Do you have similar relationships to sleep, to alcohol, to your phones, to your families, to ambition, to risk. Do you laugh at the same kind of thing without trying.
  </p>
  <p>
  Compatibility is a hundred small overlaps in autopilot. It is not loud and it is not the thing you notice on a date. It is the thing you notice in month four, when one of you is mildly sick and the other has to be near you for three days, and either it is fine or you both want to crawl out of your skin.
  </p>

  <h2>Why the confusion is so common</h2>
  <p>
  Chemistry produces a vivid memory. Compatibility produces an absence of friction, which produces no memory at all. The brain can describe a charged dinner from two years ago in clear detail. It cannot describe the texture of a calm Sunday because there was nothing to describe.
  </p>
  <p>
  This means people audit their relationships using chemistry as the metric because chemistry is what they can see. They do not see compatibility. They feel its absence as boredom and they feel its presence as nothing in particular.
  </p>
  <p>
  I have a friend who broke up with a man she described as "boring" and then spent four years dating people she described as "electric" and ended each of those relationships when the electricity blew up the wiring. She is now back with the "boring" one. She told me he was never boring. He was just compatible, and she had not learned the difference yet.
  </p>

  <h2>How to tell which you have</h2>
  <p>
  Three rough tests, none of them clean but all of them useful.
  </p>
  <p>
  <strong>The empty Sunday test.</strong> Spend a full day with the person where nothing is planned. Do not curate it. Do not perform. If most of the day feels light and easy, that is compatibility. If most of the day feels like work and the spark only re-ignites at dinner, that is chemistry without compatibility.
  </p>
  <p>
  <strong>The bad mood test.</strong> When one of you is in a quiet bad mood that is not about the other person, what happens. Do you get more careful with each other, more tender, more matter-of-fact. Or does the bad mood become a fight by 9pm. Compatibility absorbs bad moods. Chemistry tends to amplify them.
  </p>
  <p>
  <strong>The third-party test.</strong> Watch how they interact with the people you have known longest. Not whether your friends "approve." Whether the interaction is low-friction. Compatible partners tend to slot into the existing rhythm of your life. Chemistry-driven partners often require everyone around you to adjust.
  </p>

  <h2>Can you have both</h2>
  <p>
  Yes, and that is the actual goal. But the order matters.
  </p>
  <p>
  If you start with chemistry, you have to test for compatibility before you commit. The pull of chemistry will make you minimise structural mismatches because the body wants what it wants. People marry chemistry-first partners they were never compatible with, every day.
  </p>
  <p>
  If you start with compatibility, you have to give chemistry time to build. It often does. The "warm" feeling can become the "electric" feeling at month six, once trust has done its work. People walk away from compatibility-first partners because they expected chemistry to be there on date one. Sometimes it just was not there yet.
  </p>

  <h2>The trap of "settling"</h2>
  <p>
  Choosing compatibility over chemistry is not "settling." That word has done immense damage. Settling is choosing someone you do not respect. Choosing someone whose defaults match yours, even if the first three dates were not a movie, is not settling. It is selection.
  </p>
  <p>
  The flip side is also true. Walking away from a partner who is compatible but chemistry-free is not always shallow. Sometimes the body knows something the head has not articulated yet. The point is not to override either signal. The point is to know which one you are reading.
  </p>

  <h2>What to do with this</h2>
  <p>
  For the next three people you see more than twice, write down two things. What does the chemistry feel like. What does the compatibility feel like. Use different words for the two.
  </p>
  <p>
  After a few months you will notice the words you keep using. The pattern is almost always more revealing than any single relationship. You will see whether you have been chasing chemistry and calling it compatibility, or coasting on compatibility and calling it chemistry. Both happen. Both are fixable, but only if you are willing to call them by their right names.
  </p>
  </>
  ),

  "money-family-kids-the-conversations-everyone-delays": (
  <>
  <p>
  The four heavy topics are money, family, kids, and ambition. Almost nobody brings them up in the first two months because doing so feels intense, presumptuous, or unromantic. So they get deferred. They get deferred until both people are already attached, at which point the answers feel like betrayals instead of information.
  </p>
  <p>
  Earlier is kinder. Earlier is also more honest. And earlier does not have to mean "interview-style on date two." It just means not waiting until you are six months in to find out that they want three kids and you want zero.
  </p>

  <h2>Why people delay</h2>
  <p>
  Three reasons, in roughly this order.
  </p>
  <p>
  One. They are afraid the other person will leave if the answers do not match. So they bank attachment first and hope the answers will quietly evolve. They almost never do.
  </p>
  <p>
  Two. They have not actually answered the questions for themselves yet. Asking the other person forces them to answer. They are not ready.
  </p>
  <p>
  Three. They believe romantic chemistry will solve the underlying mismatch later. It will not. Romantic chemistry has never solved a money difference, a family expectation, or a child question. It just delays the bill.
  </p>

  <h2>Money</h2>
  <p>
  The conversation people imagine: "how much do you earn, how much do you save, what are your investments." This is the wrong conversation. Numbers are downstream of the actual variable.
  </p>
  <p>
  The actual variable is your relationship to money. What it means to you. What it represents. Whether it is for security or for freedom or for status or for experience. What you feel when you spend it. What you feel when you do not have enough of it.
  </p>
  <p>
  Two people on very different incomes can be deeply money-compatible if they share a relationship to money. Two people on the same income can be money-incompatible if one of them treats it as oxygen and the other treats it as fuel.
  </p>
  <p>
  Useful questions to surface this, by month two: "What did money feel like in your house growing up." "What is the most ridiculous thing you have ever spent money on, and do you regret it." "If you got a thirty percent raise tomorrow, where would the money actually go in your life."
  </p>

  <h2>Family</h2>
  <p>
  Family is the conversation people are most afraid to have because the answers feel non-negotiable. They are right that the answers are non-negotiable. They are wrong that this means the conversation is risky.
  </p>
  <p>
  The risky thing is not knowing. Finding out at month nine that they call their mother three times a day and you call yours twice a year is not a logistical problem. It is a worldview gap that will sit at every holiday for the rest of your relationship.
  </p>
  <p>
  The conversation is not "tell me about your family." That gets you a polished answer. The conversation is more like: "What role do you imagine your family playing in your life in five years." "How often do you want to see them, realistically, not aspirationally." "If your parents and I ever disagreed about something important, what does that scenario look like to you."
  </p>
  <p>
  A friend of mine spent two years with a guy whose mother had a key to his apartment. She thought she could solve this by being patient. She could not. The structure was the structure. He liked it that way. She found that out at month four. She left at month twenty-six. Eighteen months were spent trying to negotiate a thing that was not negotiable.
  </p>

  <h2>Kids</h2>
  <p>
  The kids conversation is the one people defer the longest and pay for the most.
  </p>
  <p>
  The "I want kids" / "I do not want kids" headline is just the beginning. The harder questions are downstream of that. When. How many. With how much help. With what division of labour. With what life sacrifices. Most kids-related breakups are not "yes" versus "no." They are different "yes" answers that turned out to be incompatible.
  </p>
  <p>
  You do not have to lock anything in. You do have to know what each of you currently thinks. By month three, ideally. Not on date one, which is performative. Not at month nine, which is too late to walk away from cheaply.
  </p>
  <p>
  A useful frame: "If I asked you to describe your ideal life at forty-five, in two sentences, what would those two sentences include." The answer reveals more than any direct question. People do not lie about the picture in their head when you ask it like that.
  </p>

  <h2>Ambition</h2>
  <p>
  Ambition is the most underrated of the four. People think of it as a career topic. It is not. It is a worldview topic.
  </p>
  <p>
  Two people with mismatched ambition will burn each other out. Not because one is "trying harder." Because one of them organises their life around a project and the other organises their life around presence, and these are different relationships to time. They show up in how each of you treats weekends, how each of you treats free hours, how each of you treats your phone after 7pm.
  </p>
  <p>
  Ambition does not have to match. It has to fit. Two ambitious people can build a working relationship if they have a shared understanding of how the ambition is going to feel in the room. One ambitious and one present-oriented can work if both of them name what is happening and what each will give up. The pairings that explode are the ones where neither person admits which side they are on.
  </p>

  <h2>How to actually have these conversations</h2>
  <p>
  Not all at once. Not as a syllabus. One topic per dinner across two or three months, woven into conversations that are already happening. The trigger sentence is almost always something the other person said first.
  </p>
  <p>
  They mention an annoying family text. You ask the family question. They mention a coworker getting promoted. You ask the ambition question. They mention a friend who just had a baby. You ask the kids question. Anchor each conversation to something real, not a calendar.
  </p>
  <p>
  And write down what they say. Not as evidence. As memory. Three months later you will not remember the texture of what they said about their mother. You will remember the headline. The headline is rarely the useful thing.
  </p>
  </>
  ),

  "fixable-vs-structural-mismatch": (
  <>
  <p>
  Some incompatibilities resolve. Some never do. Most people cannot tell the difference in the moment, so they either bail on workable problems or grind for years against unworkable ones. Both errors cost about the same amount of life.
  </p>
  <p>
  The categories are clearer than they look from the inside.
  </p>

  <h2>The two-axis test</h2>
  <p>
  Ask two questions about any given mismatch.
  </p>
  <p>
  One. Is the underlying thing about a skill or about a structure. Skills can be learned. Structures cannot, or at least not without rebuilding the person.
  </p>
  <p>
  Two. Does the person treat it as their thing to work on, or as something they expect the world to accommodate. People who own their patterns can usually shift them. People who treat their patterns as identity rarely do.
  </p>
  <p>
  Most "is this fixable" questions answer themselves once you separate skill from structure and ownership from expectation.
  </p>

  <h2>What is almost always fixable</h2>
  <p>
  <strong>Communication habits.</strong> Most early communication problems are skill problems. He does not initiate text threads. She gets defensive when asked direct questions. He goes quiet for hours when stressed. These look like personality. They are usually muscle memory from previous relationships, and muscle memory rebuilds in months, not years, if both people are working at it.
  </p>
  <p>
  <strong>Logistical wiring.</strong> One of you runs five minutes late to everything. One of you needs everything calendared. One of you cannot fall asleep with the bedroom warmer than 18 degrees. These create wear but they are negotiable. Couples build operating systems around them all the time.
  </p>
  <p>
  <strong>Sex frequency and shape.</strong> This is the one people are most afraid is structural. It mostly is not, in year one. It is often a stress, sleep, novelty, or context problem that responds to conversation. Real structural sex mismatches exist, but they take longer to confirm than people think and most early gaps are not them.
  </p>
  <p>
  <strong>Most aesthetic differences.</strong> She likes the apartment minimalist. He has framed concert posters. This is preference. It is not load-bearing. Couples solve it.
  </p>

  <h2>What is almost never fixable</h2>
  <p>
  <strong>Different fundamental relationships to honesty.</strong> If one of you considers omission a tool and the other considers it a wound, this does not converge. You can patch over it for a long time. It will still be true at year five.
  </p>
  <p>
  <strong>Different definitions of monogamy or commitment.</strong> Not "do we want commitment." That is mostly a pace question. The structural version is: what does loyalty actually look like to you in practice. If your two answers differ at the level of definition, no amount of conversation merges them.
  </p>
  <p>
  <strong>Different baselines for emotional regulation.</strong> If one of you can sit with a feeling for twelve hours and the other cannot tolerate fifteen minutes of discomfort without making it the room's problem, this is not a skill gap. It is a wiring gap. It can be partially managed. It does not disappear.
  </p>
  <p>
  <strong>Different relationships to growth.</strong> One of you treats your life as something to keep editing. The other treats their life as something to defend from edits. This is structural. People who do not want to change do not change.
  </p>
  <p>
  <strong>Kids, location, and core lifestyle.</strong> The big logistical "yes / no" answers. Not because the topics are sacred. Because the costs of accommodating someone else's "yes" or "no" on these are too high to fake.
  </p>

  <h2>The "if only" trap</h2>
  <p>
  The clearest sign you are facing a structural mismatch is the recurrence of the sentence "this would be perfect if only X." If you have been thinking that sentence about the same X for more than three months, X is structural.
  </p>
  <p>
  Fixable problems get smaller as you both work on them. Structural problems stay the same size or get bigger. They get bigger because tolerance for them erodes over time, not because the thing itself is changing.
  </p>
  <p>
  I had a relationship where the recurring "if only" was about a specific kind of withdrawal during stress. I told myself this was a skill problem for a year. It was not. He had been doing that since he was nine. He was not interested in changing it. The thing did not need to be fixable. He needed to want to fix it. He did not. That was the actual data.
  </p>

  <h2>The other trap</h2>
  <p>
  Treating fixable things as structural is the other failure mode and it costs about the same. People walk away from genuinely workable relationships because they confuse early friction with destiny.
  </p>
  <p>
  Skills look like personality early. He is "bad at conflict." She is "emotionally unavailable." He "cannot communicate." These descriptions feel like they are pointing at structure. Usually they are pointing at habits that no one ever required either person to update.
  </p>
  <p>
  The test is whether the person, given specific feedback, takes the feedback seriously without making the feedback itself a fight. If yes, almost certainly fixable. If no, almost certainly structural.
  </p>

  <h2>The conversation that tells you which one you have</h2>
  <p>
  At the three-month mark, take the single mismatch that is bothering you most. Describe it once, clearly, in a single sentence. Not a list. One sentence.
  </p>
  <p>
  Watch what they do with it. Do they get curious. Do they get defensive. Do they say "yeah, I know, I have been working on that." Do they say "well, you do X" before you have finished talking.
  </p>
  <p>
  Their response, more than the content of the mismatch itself, is the data. It will tell you whether you are looking at something that has six months of work in it or twenty years.
  </p>
  <p>
  You can love someone deeply and still owe yourself the truth about which one it is.
  </p>
  </>
  ),

  "compatibility-is-mostly-about-defaults": (
  <>
  <p>
  When people talk about compatibility they usually describe shared interests. We both love hiking. We both watch the same shows. We both grew up in similar towns. This is the version of compatibility that fits on a dating app.
  </p>
  <p>
  It is also not the version that predicts whether a relationship lasts.
  </p>
  <p>
  The thing that actually predicts whether a couple stays a couple is whether their unconscious defaults line up. What each of you does on autopilot is most of the relationship. The interests are decoration on top.
  </p>

  <h2>What I mean by defaults</h2>
  <p>
  Defaults are the things you do without choosing to do them.
  </p>
  <p>
  What you do when you get home and the apartment is empty. What you do when you have forty unstructured minutes. What you do when someone you love is upset. What you do when you are upset. What you do when a stranger is rude. What you do when you are bored. What you do at 11pm on a weeknight. What you do when you are happy.
  </p>
  <p>
  Most of life is defaults. Big choices are rare. The shape of an ordinary Tuesday is almost entirely default behavior, and the shape of an ordinary Tuesday is the actual texture of a relationship.
  </p>

  <h2>The default categories that matter most</h2>
  <p>
  <strong>The decompression default.</strong> How does each of you wind down after a hard day. Some people need quiet alone time. Some need to talk it out. Some need a walk. Some need a screen. Two partners with very different decompression defaults can spend years feeling subtly let down by each other without ever being able to name why.
  </p>
  <p>
  <strong>The hospitality default.</strong> How do you each treat people who come into your shared space. One of you may treat hosting as a small event that requires preparation. The other may treat it as an extension of normal life. Neither is wrong. They are completely different operating systems and they will not auto-merge.
  </p>
  <p>
  <strong>The repair default.</strong> When something has gone wrong between you, what is the first move each of you makes to make it less wrong. Some people apologise immediately. Some need to think before they can apologise honestly. Some make food. Some make jokes. Some get quiet and tender. The repair default is the single best predictor of recovery time after conflict.
  </p>
  <p>
  <strong>The Sunday default.</strong> How does each of you treat unstructured time. One of you may default to productivity. One to social contact. One to rest. One to long projects that have no deadline. This is a values default disguised as a logistical one.
  </p>
  <p>
  <strong>The information default.</strong> When something happens in your life, how soon does the person you are with hear about it, and at what level of detail. Some people share by reflex. Some share by request. Some share late and edited. Mismatched information defaults create a slow asymmetry that looks like the more-sharing person caring more. Often they just default differently.
  </p>

  <h2>Why defaults are hard to read early</h2>
  <p>
  On dates, almost nobody is on default. They are dressed, they are performing some version of themselves, they are running a higher-effort program than they will run at month nine. You cannot read someone's defaults from a date.
  </p>
  <p>
  You can read them from texture moments. The morning after a late night. A long car ride. An afternoon at someone else's house. A small inconvenience that they did not see coming. These are the moments where the default leaks out around the performance.
  </p>
  <p>
  I noticed once, on a fourth date, that my date stood up to greet a friend's parent when the parent walked into the room. He did it without thinking. That was a default. I had spent the previous three dates trying to read his personality. I had not learned anything as useful as that one unconscious half-second of standing up.
  </p>

  <h2>How to test for default alignment</h2>
  <p>
  Spend a weekend with the person without a plan. No tickets, no reservations, no agenda. Just two days of empty time in proximity.
  </p>
  <p>
  Pay attention to what each of you reaches for. Who suggests food first. Who needs to go for a walk. Who wants the TV on. Who wants quiet. Who picks up the phone. Who puts it down. Who suggests something and who responds. By Sunday night you will know more about your default compatibility than you would learn in six months of curated dates.
  </p>
  <p>
  You can also do this with a smaller experiment. The first time you are at their apartment when neither of you is feeling great. Watch what they do. Watch what you do. Watch what happens between you. The data is right there and most of it is unconscious.
  </p>

  <h2>What to do when the defaults do not match</h2>
  <p>
  Defaults can be adjusted at the margins, by both partners, with conscious effort. Defaults cannot be replaced. Knowing the difference is the entire game.
  </p>
  <p>
  Two people with different decompression defaults can build a workable arrangement where one of them gets thirty minutes of quiet on arrival home before any conversation happens. That is an adjustment. Asking the alone-time person to switch to being a talk-it-out person is a replacement, and replacements do not work.
  </p>
  <p>
  Most "we just want different things" breakups are actually "we have different defaults and neither of us was willing to adjust at the margins." The defaults themselves were not the problem. The unwillingness to design around them was.
  </p>

  <h2>The point</h2>
  <p>
  You are not looking for someone whose interests overlap with yours. You can find someone interesting in five minutes. You are looking for someone whose unconscious autopilot fits next to yours without grinding.
  </p>
  <p>
  That is not a romantic-sounding sentence. It is the truer one. The relationships that last are the ones where, on the most ordinary Tuesday, two sets of defaults sit comfortably in the same room and neither person notices they are doing it. That non-noticing is the thing.
  </p>
  </>
  ),

  "what-your-dating-profile-is-actually-communicating": (
  <>
  <p>
  There's a version of your dating profile that you wrote. And then there's the version someone reads when they see it for the first time, with no context, in three seconds, while swiping through forty other people.
  </p>
  <p>
  Those two versions are almost never the same, and the gap between them is the most important thing to understand about online dating.
  </p>

  <h2>The signal problem</h2>
  <p>
  Every element of your profile, your bio, your photo lineup, your answers to prompts, communicates something. But what it communicates isn't necessarily what you intended to say.
  </p>
  <p>
  When you write "I love hiking and good coffee," you're thinking about who you actually are: someone who values being active, who appreciates small pleasures, who's low-maintenance and easy to be around. But the person reading it sees the forty-seventh profile today that says exactly the same thing.
  </p>
  <p>
  This isn't a judgment on your personality. It's a signal problem. The words are accurate but generic, they communicate nothing specific that would make someone feel like they'd be getting something different with you versus anyone else.
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
  Every dating profile communicates on three channels simultaneously, whether you're aware of it or not:
  </p>
  <p>
  <strong>The content signal:</strong> The literal facts and details you share. What you do, where you've been, what you care about. This is what most people focus on.
  </p>
  <p>
  <strong>The character signal:</strong> What the way you write those facts implies about your personality. Are you self-aware? Do you have a sense of humour? Do you take yourself too seriously, or not seriously enough?
  </p>
  <p>
  <strong>The effort signal:</strong> What your profile communicates about how much thought you put into it. A profile that looks like it took three minutes to write communicates something specific, even if everything in it is true.
  </p>
  <p>
  Most people only think about the content signal. The character and effort signals are what actually drive decisions.
  </p>

  <h2>Why the photos are doing more work than you think</h2>
  <p>
  Studies consistently show that photo selection accounts for a disproportionate share of swipe decisions, but not for the reason most people assume. It's not purely about attractiveness. It's about the story the photo lineup tells.
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
  That feedback, the three-second impression a stranger forms, is worth more than any amount of self-analysis, because it's what's actually happening every time someone lands on your profile.
  </p>

  <h2>What to do with this</h2>
  <p>
  Read your bio as if you've never met yourself. Not as the person who lived those experiences, as someone who's seeing this for the first time, scanning for a reason to feel something.
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
  The shortest possible message, "hey," "hi," "hello", gets a reply rate that's meaningfully above zero. This surprises people, because it provides nothing for the recipient to work with. But it does one thing right: it's low-friction. There's nothing to disagree with, nothing to respond to awkwardly, nothing that could go wrong.
  </p>
  <p>
  The problem is that the reply rate, while not zero, is also not good. And the conversations it generates tend to stall quickly because neither person has given the other much to build on.
  </p>

  <h2>The anatomy of a message that gets a response</h2>
  <p>
  Across multiple studies, the messages with the highest response rates share a consistent structure:
  </p>
  <p>
  <strong>They reference something specific.</strong> Not "your photos are great", something in the bio, a prompt answer, a specific detail. This signals that you actually read their profile, which is a higher bar than most people clear.
  </p>
  <p>
  <strong>They include an open question.</strong> Not "what do you do for fun?", that requires the other person to do all the work. A question tied to the specific detail you referenced: "I saw you mentioned the Amalfi Coast, was that as chaotic as it looks, or does it somehow work?"
  </p>
  <p>
  <strong>They're short.</strong> Long first messages, however thoughtful, create pressure. They feel like they require a proportional response, which raises the perceived cost of replying. The sweet spot in most studies is 2–4 sentences.
  </p>
  <p>
  <strong>They don't lead with a compliment on appearance.</strong> Complimenting someone's smile or photos in the first message has a significantly lower reply rate than messages that don't mention appearance at all. The leading theory is that appearance-based compliments signal that you didn't read the profile, that you're responding to a photo, not a person.
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
  The practical approach: read the energy of their last message, then ask, does my response feel like a natural continuation of that energy, or a jarring shift?
  </p>

  <h2>What this means practically</h2>
  <p>
  The best first message isn't the wittiest one or the most confident one. It's the one that makes the person reading it feel like you were actually paying attention to them, and gives them something easy to grab onto and respond to.
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
  Fewer people have sat with the harder question: what red flags are in my own profile, and why can't I see them?
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
  "I work hard and I play hard. Love exploring new restaurants, hiking, travel, yoga, good wine, live music, brunches with friends." A list that covers every popular hobby is not a personality. It's a résumé of safe answers designed to appeal to everyone, which means it connects with no one.
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
  When someone reads your profile, they're trying to imagine spending time with you. If your profile gives no sense of what your actual life looks like, what you do, what matters to you, what a typical week involves, they have nothing to imagine.
  </p>
  <p>
  Vagueness is often mistaken for mystery. It's not. Mystery is when you reveal something intriguing and leave the rest unexplained. Vagueness is when you reveal nothing, which just feels like absence.
  </p>

  <h2>6. The goal mismatch</h2>
  <p>
  Saying you're "open to whatever" when you actually have a preference is a strategy that tends to attract the wrong people and repel the right ones. The people who are also clear about what they want will move on to someone who matches. The people who are unclear will fill in their own projections.
  </p>
  <p>
  Being honest about what you're actually looking for filters your matches, and that's a feature, not a bug.
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
  Dating app photos are not just visual evidence. They're a communication medium, one that operates faster than language and carries information the person viewing them often can't fully articulate.
  </p>
  <p>
  When someone swipes left on your profile in under two seconds, they're not making a conscious aesthetic judgment. They're responding to a feeling, and that feeling is generated by the combined signal of everything in the frame.
  </p>

  <h2>What the research actually says</h2>
  <p>
  Studies on dating photo selection have found consistent patterns across demographic groups. The photos that perform best are not necessarily the ones that show the most attractive version of the person, they're the ones that communicate the most clearly about who the person is.
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
  <li>A genuine smile, crow's feet, crinkled eyes, rather than a posed smile</li>
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
  <strong>Photo 2–3:</strong> Add dimension. This is where you show context, an activity, a place, a setting that reveals something about your life. The goal is to give the viewer a mental image of what spending time with you might look like.
  </p>
  <p>
  <strong>Photo 4–5:</strong> Add evidence. Social proof (you with friends, laughing), range (you in a different context than photo 1), or a memorable specific (the obscure location, the unusual hobby, the thing that makes you you).
  </p>

  <h2>The solo vs. group photo question</h2>
  <p>
  Group photos are valuable, they signal that you have real social connections, which is a genuinely important signal to people looking for a partner. But they work best in positions 3–5, not position 1.
  </p>
  <p>
  When you do include group photos, make sure you're clearly identifiable and ideally positioned as the natural focal point of the image. The viewer should never have to wonder.
  </p>

  <h2>The "trying too hard" signal</h2>
  <p>
  Heavily edited photos, dramatically lit photos, or photos that look professionally staged sometimes backfire, not because people don't appreciate the effort, but because they create a gap between the profile and the expectation. If someone meets you and you look noticeably different from your photos, the mismatch creates distrust before the conversation even starts.
  </p>
  <p>
  The most effective photos look like your best natural self, not a curated version of what you wish you looked like.
  </p>

  <h2>What your photos are missing</h2>
  <p>
  The most common photo lineup failure isn't having bad photos. It's having five versions of the same photo, same expression, same context, same pose, slightly different location. A lineup that doesn't change across five photos gives the viewer nothing new after the first one.
  </p>
  <p>
  Each photo should add a piece of information that the others don't. If you can swap two photos in your lineup without losing anything, one of them isn't doing its job.
  </p>

  <h2>The practical audit</h2>
  <p>
  Print out your five photos (or lay them out side by side on screen). For each one, write one sentence describing what a stranger would learn about you from that photo alone, not who you are in the context of your full profile, but what that single image tells someone who knows nothing about you.
  </p>
  <p>
  If any photo doesn't add something new, replace it with one that does.
  </p>
  <p>
  If more than two photos give the same impression, you're repeating yourself instead of building a picture.
  </p>
  <p>
  That's the audit. It's not about being more attractive, it's about being more legible.
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
  Most people swipe based on a fast feeling: this person is attractive, this person seems fun, this person is "my type." That fast feeling is built from years of associations, what your last good relationship looked like, what felt safe growing up, what your friends approve of, what you're proving to your ex.
  </p>
  <p>
  None of those filters are necessarily wrong. The problem is they're invisible. You don't see yourself filtering. You just see the matches you ended up with, and conclude the dating pool is broken.
  </p>

  <h2>The three patterns that produce wrong matches</h2>
  <p>
  <strong>Pattern one: the familiar.</strong> You're swiping right on people who feel familiar, because familiar feels safe, and familiar is often a version of the dynamic you said you wanted to leave. The signal you're tuning into isn't "compatible." It's "recognisable."
  </p>
  <p>
  <strong>Pattern two: the proof.</strong> You're swiping right on people who would prove something, to yourself, to an ex, to a friend group. Their profile is doing the job of a trophy more than a partner. Whatever it's proving, it's not actually about them.
  </p>
  <p>
  <strong>Pattern three: the avoidance.</strong> You're swiping right on people who give you cover for not actually committing, they live far away, they're recently single, they're "complicated." The match exists, but the relationship can't, and that's the unspoken reason it felt safe to swipe.
  </p>

  <h2>How to actually see the pattern</h2>
  <p>
  Write down the last five people you matched with and at least one detail about each: their job, their stated relationship goal, how the conversation ended. Then write down the last five people you went on a date with from the apps.
  </p>
  <p>
  Read both lists back. Look for what's the same. Not in their personalities, in the dynamic. Who initiated. Who kept the energy going. Who you were performing for. What ended each one.
  </p>
  <p>
  The pattern is almost always there. It's usually quieter than you'd expect.
  </p>

  <h2>The reset isn't "try harder"</h2>
  <p>
  Once you can see the pattern, the move isn't to white-knuckle different choices. It's to slow the swipe down enough that you're actually choosing instead of pattern-matching.
  </p>
  <p>
  Before the next right-swipe: read the bio twice, read the prompts, look at every photo, and ask the awkward question, what is this person's actual life going to ask of me? If the answer makes you feel something honest, swipe. If the answer makes you feel nothing, the swipe is your filter talking, not you.
  </p>
  </>
  ),

  "attachment-styles-on-dating-apps": (
  <>
  <p>
  Attachment theory is having a moment, and most of how it's used in dating discourse is wrong, flattened into four boxes, used to label other people, deployed mostly as a reason to stop trying with someone.
  </p>
  <p>
  Used honestly, it does something more useful: it gives you a frame for noticing how you actually behave in the first three weeks of any new dating connection. Because that's where attachment style does most of its damage, and it does most of it through behaviours you wouldn't have called "attachment" at all.
  </p>

  <h2>What each style looks like on a dating app specifically</h2>
  <p>
  <strong>Secure</strong> shows up on a dating app as steady pace. You match, you have a real conversation, you ask them out within a reasonable window, you don't catastrophise the gaps between replies. None of this feels effortful, it feels like baseline.
  </p>
  <p>
  <strong>Anxious</strong> shows up as the read-receipt spiral. You check whether they opened it. You re-read your last message looking for what was wrong with it. You draft and redraft. You sometimes send a follow-up to fill the silence. You feel relief, then a fresh wave of needing, every time they reply.
  </p>
  <p>
  <strong>Avoidant</strong> shows up as the slow fade-out. You match, the conversation is good, then on day three you can't bring yourself to open the app. You see they replied and you tell yourself you'll respond later. By the time you do, the energy is gone, and your nervous system registers that as relief.
  </p>
  <p>
  <strong>Disorganised</strong> looks like both of the above on alternate days, intense pursuit followed by total withdrawal, often without an obvious external trigger.
  </p>

  <h2>The signal you're sending without knowing</h2>
  <p>
  Here's the part nobody talks about: the person on the other end can feel your attachment style through the cadence and shape of your messages, even if they couldn't name what they're feeling.
  </p>
  <p>
  Anxious cadence, replies that come too fast, that are too long for the moment, that include three follow-up questions, feels like pressure to the reader, even if every word is fine. Avoidant cadence, multi-day gaps, replies that match the literal content but drop all the warmth, feels like rejection, even when no rejection was intended.
  </p>
  <p>
  Both of those feelings get attributed to chemistry, not to attachment. So when someone "loses interest," your read on what happened is almost always slightly off.
  </p>

  <h2>What to actually do about your own style</h2>
  <p>
  You can't change your attachment style in a week. You can change the behaviour it produces on a specific dating app, this week.
  </p>
  <p>
  If you're anxious-leaning, the move is delay-without-disappearing, match the cadence of their messages instead of beating them to the reply, and resist the urge to follow up on your own follow-up.
  </p>
  <p>
  If you're avoidant-leaning, the move is small consistent contact instead of intense bursts, reply within the day every day, even if briefly, instead of going dark for three days and coming back with a paragraph.
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
  There's one question that does, and whether someone can answer it is the strongest in-conversation predictor that you'll want a second date.
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
  Second, it tests vulnerability. Admitting you were wrong about something, even something small, is a low-stakes vulnerability test. People who can do it casually on a first date have a baseline emotional security. People who can't, often can't in higher-stakes situations either.
  </p>
  <p>
  Third, it gives you something specific to talk about for the next twenty minutes. Whatever they changed their mind about becomes the next conversation, and it'll be a real one, not a script.
  </p>

  <h2>The bad versions to avoid</h2>
  <p>
  Don't ask it like a job interview question. "So, tell me about a time you changed your mind." That collapses it.
  </p>
  <p>
  Ask it like you're genuinely curious. Lead with one of your own. "I used to think X about Y, and I've been thinking lately I had it backwards. Anything like that for you recently?"
  </p>
  <p>
  That reframing does the work, it makes it a conversation, not a test.
  </p>

  <h2>What the answers tell you</h2>
  <p>
  The content of the answer matters less than the shape. Watch for: do they engage the question or deflect it? Do they give you something concrete or stay abstract? Does the example reveal something about how they think, or just what they think?
  </p>
  <p>
  Someone who says "I used to be really judgmental about people who drink alcohol and I realised I was projecting" is giving you a window into a real internal process. Someone who says "I don't really change my mind about much" is also giving you a window, into something else entirely.
  </p>

  <h2>Why it predicts the second date</h2>
  <p>
  Because by the time you've both answered it, you've had something approximating an actual conversation, not an interview. And the felt sense of "this person is interesting" is built almost entirely from moments like that.
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
  These phrases are written constantly because they feel safe. They're warm-sounding, non-committal, broadly agreeable. They are also the single most reliable signal that the writer didn't think carefully about their profile, and the reader picks that up immediately, even when they couldn't tell you why they swiped left.
  </p>

  <h2>What 'good vibes' actually communicates</h2>
  <p>
  On the surface: "I'm a positive person." Below the surface: "I haven't thought about what I want from this." And below that: "I'd like to seem fun without taking the risk of saying anything specific."
  </p>
  <p>
  Generic positivity does almost no filtering work. Everyone is "fun" in their profile. Everyone has "good vibes." If your bio applies equally well to half the platform, it's not telling someone why to choose you, and reading it produces nothing.
  </p>

  <h2>The mathematics of selection</h2>
  <p>
  Someone scrolling through dating profiles is performing a fast selection task. Their goal is not to find someone they like; their goal is to filter out people they don't want to think about further so they can focus on the small number worth a real swipe.
  </p>
  <p>
  Generic bios are easy to filter out, not because they're bad, but because they give no reason to stop. Specific bios are harder to filter out, because the reader has to actually engage with whether the specific thing is interesting to them.
  </p>
  <p>
  That brief moment of engagement is what you're competing for. Generic copy never earns it.
  </p>

  <h2>What to write instead</h2>
  <p>
  Pick a thing you actually do, a habit, a hobby, a recent obsession, an opinion, and describe it concretely enough that someone could form a mental picture.
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
  Specificity feels risky because it's filtering. Some people read your xiao long bao bio and think "weird obsession." Good, they were never going to be a match.
  </p>
  <p>
  Some people read it and think "I'd actually want to meet that person." That's the entire point of a dating profile. You don't need every reader to want to meet you. You need the right ones to feel something specific.
  </p>
  </>
  ),

  "three-message-test": (
  <>
  <p>
  Most dating app conversations die quietly. Not in a fight, not from rejection, they just thin out. Reply gaps stretch. Energy fades. By message five or six, someone stops responding and neither of you mentions it.
  </p>
  <p>
  The reason is almost always something that happened at message three.
  </p>

  <h2>The three-message structure</h2>
  <p>
  Look at any healthy early dating app conversation and the first three messages tend to do specific work:
  </p>
  <p>
  <strong>Message one</strong> opens, usually a reference to something specific in their profile plus a real question.
  </p>
  <p>
  <strong>Message two</strong> answers the question and asks one back. Reciprocity.
  </p>
  <p>
  <strong>Message three</strong> is where the conversation either deepens or coasts. This is the inflection point. The third message either takes the topic somewhere more interesting, opens a new thread, or makes the leap toward suggesting a call or meeting up.
  </p>
  <p>
  When message three just answers the previous one without adding anything new, you've entered Q&A mode, and Q&A mode has a short shelf life.
  </p>

  <h2>Why this happens</h2>
  <p>
  Most people are so relieved to be in a working conversation that they keep doing the thing that's working, answering questions, sharing details, being nice. None of that is wrong. But all of it is reactive.
  </p>
  <p>
  Reactive conversations on dating apps stall because there's no momentum being generated. You're both just maintaining. Without someone driving, adding a new angle, sharing something unprompted, suggesting a next step, the energy slowly bleeds out.
  </p>

  <h2>How to handle message three</h2>
  <p>
  The simplest move: answer their question, then add something they didn't ask for. A connected story, an opinion, a tangent, a small piece of vulnerability.
  </p>
  <p>
  Instead of: "Yeah, I really liked Lisbon, the food was great." (Q&A loop.)
  </p>
  <p>
  Try: "Yeah, Lisbon was great, the actual highlight was getting completely lost in Alfama on the third night and ending up at this tiny fado bar with maybe ten people in it. I've been trying to replicate that 'accidentally found something real' feeling on trips ever since." (Story + signal + ongoing thread.)
  </p>
  <p>
  The second version gives them five things they could respond to. The first gives them one.
  </p>

  <h2>The other move: name what's happening</h2>
  <p>
  Sometimes the right message three move is to call the moment. "I'm enjoying this, want to keep going over a drink this week?" By message three, you've established enough of a baseline that suggesting meeting up doesn't feel like a leap.
  </p>
  <p>
  Conversations that drag on for forty messages before someone suggests a date almost always die before the date happens. The energy needs somewhere to go.
  </p>

  <h2>The bigger principle</h2>
  <p>
  Healthy early conversations have a small forward-motion vector on each message. The motion can come from depth, from humour, from a new topic, or from suggesting a next step, but something has to move.
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
  <strong>Energy.</strong> Read for whether this person sounds high-output or low-output, social or solitary, ambitious or content. None of these are good or bad, but pairing high-output with someone who needs a slow domestic life rarely works, no matter how much you like them in conversation.
  </p>
  <p>
  <strong>Communication style.</strong> Their bio and prompts are a writing sample. Do they explain things, do they joke, do they hedge, do they use sarcasm, do they over-explain, do they leave things implied? You're going to be communicating with them constantly if this works. Notice how the communication feels to read.
  </p>
  <p>
  <strong>What's not said.</strong> Almost every profile has a noticeable absence, no mention of work, no mention of friends, no mention of family, no mention of where they live. Absences are signals. They're not necessarily problems, but they're worth noting.
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
  Reading a profile this way also generates better first messages. Instead of complimenting a photo, you can reference something the profile suggested about how they live, "Your bio reads like someone who's recently moved cities and is figuring out their footing, true, or am I reading too much into it?", and the conversation starts at a different depth than 99% of openers.
  </p>
  <p>
  That depth is what makes it possible to know, by message five, whether to actually go on a date.
  </p>
  </>
  ),

  "dating-app-burnout-reset": (
  <>
  <p>
  Dating app burnout doesn't announce itself. It arrives slowly, as a flatness, swipes that feel mechanical, matches that feel like obligations, conversations that feel like work you didn't ask for.
  </p>
  <p>
  And the standard advice, take a break, delete the apps, focus on yourself, almost never actually addresses what's causing the burnout, because the burnout isn't really about the apps.
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
  Two weeks off and you'll feel better. Then you'll reinstall, and within four days you'll be in the same loop, because the loop wasn't caused by the apps, it was caused by how you were using them.
  </p>
  <p>
  The break gives your nervous system a rest, but it doesn't change the patterns you'll resume the moment you re-engage.
  </p>

  <h2>The reset that actually works</h2>
  <p>
  Three changes, in order:
  </p>
  <p>
  <strong>First, cap your swipe sessions.</strong> Not an absolute swipe count, a time cap. Ten minutes, twice a day, maximum. The burnout is largely produced by the volume, and capping the time is the cleanest intervention.
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
  You'll know the reset has worked when a match arrives and you feel something specific about that match, not the generic "okay let me reply" flatness. That specific feeling is what you used to have before the burnout. The goal isn't to feel that about every match, it's to be able to feel it about any match at all.
  </p>
  </>
  ),

  "voice-notes-on-dating-apps": (
  <>
  <p>
  Voice notes on dating apps started as a Hinge novelty and have become a small ritual: the moment in a conversation where the energy is good enough to feel like text isn't quite enough, but a phone call would be too much.
  </p>
  <p>
  They're also one of the highest-leverage moves on a dating app, because a voice note carries information that text physically can't, and people read that information faster than they realise.
  </p>

  <h2>What a voice note actually transmits</h2>
  <p>
  The literal content of a voice note often matters less than the carrier signal: your voice quality, your cadence, your laugh, your background, whether you sound relaxed or rehearsed, whether you sound like a person someone would enjoy being in a room with.
  </p>
  <p>
  Most people, when they finally hear a match's voice for the first time, make a small fast judgment. The judgment isn't about content. It's about whether the voice fits the version of the person they'd built in their head from text, and whether they'd want to keep listening.
  </p>

  <h2>The good voice note</h2>
  <p>
  Twenty to forty-five seconds. Not rehearsed. Not the audio-version of a long text. It answers something specific from the conversation and adds one detail you couldn't have texted as easily, a tone shift, an aside, an actual laugh.
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
  Voice notes don't fix bad conversations. They amplify the existing energy, good or bad, by an order of magnitude.
  </p>

  <h2>If you can't bring yourself to send one</h2>
  <p>
  Many people are quietly uncomfortable with how they sound, and avoid voice notes for that reason. Worth knowing: the version of your voice you hear in a recording is not how others hear it, and your aversion is almost always more intense than anyone else's reaction.
  </p>
  <p>
  Record one, listen back, decide if it sounds reasonable, send it. The discomfort fades by the third one, and you've added a tool that lets your matches actually meet you, not the text version of you.
  </p>
  </>
  ),

  "post-date-reflection-questions": (
  <>
  <p>
  Most post-date reflection happens in one of two unhelpful modes. Either you're spiralling, did they like me, why haven't they texted, was that joke too much, or you've already rendered a verdict that closes the case before you've learned anything from it.
  </p>
  <p>
  Neither of those modes makes you better at dating. They just make you tireder.
  </p>
  <p>
  The reflection that actually compounds, date after date, year after year, answers a different set of questions.
  </p>

  <h2>The six questions</h2>
  <p>
  <strong>1. What did I notice about myself tonight?</strong> Not about them. About you, your energy, your nerves, your defaults, the moments you became someone slightly different than usual. The dating context surfaces things about you that don't surface in any other context.
  </p>
  <p>
  <strong>2. When was I most present, and when did I check out?</strong> Most dates have a small inflection point where you either leaned in or leaned out. Knowing where those points are, for you specifically, is the most useful self-knowledge dating produces.
  </p>
  <p>
  <strong>3. What did they say that I want to remember?</strong> Not just because it was funny or interesting, because it told you something about who they actually are. The detail might matter on date three, or it might matter in two months when you're trying to decide something.
  </p>
  <p>
  <strong>4. What did I avoid asking?</strong> There's almost always a question you didn't ask, about their ex, about what they want, about something that came up. The avoidance is informative. Sometimes it's healthy boundaries; sometimes it's a pattern of not wanting to know.
  </p>
  <p>
  <strong>5. What would have to be true for me to want a second date?</strong> Phrasing it this way is more useful than "do I want a second date", because the conditional reveals what's actually load-bearing for you. The honest answer is often surprising.
  </p>
  <p>
  <strong>6. If they came back six months from now and asked me one question, what would I want them to ask?</strong> A weird question, deliberately. It tests how much of the actual you came out tonight. If you'd want them to ask about something you never mentioned, you weren't showing up as yourself.
  </p>

  <h2>Why these specifically</h2>
  <p>
  These questions don't generate verdicts. They generate signal, about you, about how you date, about what you actually want.
  </p>
  <p>
  Over enough dates, the answers form a pattern. The pattern is more valuable than any individual answer, because it tells you who you become in romantic contexts, which is the most important thing to know if you want any of those contexts to work out long-term.
  </p>

  <h2>How long this should take</h2>
  <p>
  Five minutes. Voice memo, journal entry, notes app, whichever you'll actually do.
  </p>
  <p>
  Done within a few hours of the date, before you've consolidated the night into a single narrative. The point isn't to make the date conclusive. It's to capture what's still ambiguous, because the ambiguous parts are usually where the learning is.
  </p>
  </>
  ),

  "what-your-message-history-reveals": (
  <>
  <p>
  If someone handed you a transcript of every dating app conversation you've had in the last year, every opener, every reply, every fade-out, you'd be looking at the most honest data about how you actually date that exists anywhere in the world.
  </p>
  <p>
  And almost no one ever looks at it.
  </p>

  <h2>The patterns you can only see in aggregate</h2>
  <p>
  Any individual conversation feels unique while you're in it. Across fifty conversations, you'd find the same things happening over and over:
  </p>
  <p>
  <strong>Your initiation default.</strong> You probably open conversations the same way every time, same length, same structure, same approximate tone. That default is doing a huge amount of filtering you weren't aware of.
  </p>
  <p>
  <strong>Your reply latency pattern.</strong> The gap between when you receive a message and when you reply is shockingly consistent per person. It's also one of the strongest signals the other person uses to read your interest, separate from anything you said.
  </p>
  <p>
  <strong>The questions you never ask.</strong> Look at five of your old conversations and count how many times you asked about: their family, their last relationship, what they want in the next year, what their week actually looks like. Patterns of avoidance are visible only when you look at multiple conversations at once.
  </p>
  <p>
  <strong>Where things stall.</strong> Most of your conversations probably die at the same approximate point, message seven, message twelve, the point where someone needs to suggest a meet-up. If you find that point, you've found your highest-leverage thing to change.
  </p>

  <h2>The attachment signature in your messages</h2>
  <p>
  Your attachment style leaves fingerprints all over your text. Anxious-leaning messages tend to be longer than the previous one, include more questions, and trail off with self-deprecating asides. Avoidant-leaning messages tend to be exactly as long as needed, drop emotional content casually, and rarely follow up on something the other person opened up about.
  </p>
  <p>
  These aren't conscious. Which is exactly why they're worth looking at, because the version of you that's writing the messages at 11pm on a Tuesday isn't the version of you that's thinking about your dating life on a Saturday afternoon.
  </p>

  <h2>The thing nobody wants to look at</h2>
  <p>
  The hardest pattern to see is the one where you're consistently the version of yourself you don't actually want to be, too eager, too distant, too performative, too sarcastic, too earnest, too whatever. That pattern is almost always there if you look across enough conversations.
  </p>
  <p>
  Seeing it isn't a judgment. It's the only way to choose differently next time, because you can only change what you can name.
  </p>

  <h2>How to actually look</h2>
  <p>
  Read five of your recent conversations end-to-end. Not skimming. Read them like a stranger would read them, like you're trying to figure out who this person is from how they text.
  </p>
  <p>
  Write down three things you notice. Don't judge them yet, just notice.
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
  If you've had this happen more than twice, you're not unlucky, you're hitting a pattern. The most common version is what we'd call a love-pace mismatch, and the silence about it is what kills more promising relationships than chemistry ever does.
  </p>

  <h2>What love-pace actually means</h2>
  <p>
  Love-pace is the speed at which you naturally develop feelings, escalate contact, and want to integrate someone into your life. It's not the same as how interested you are. Two equally interested people can operate on completely different pacing systems.
  </p>
  <p>
  Fast-pace people feel things early and act on them, they're texting daily by week one, picturing the future by week three, introducing you to friends by month two. Slow-pace people are doing the opposite work: holding the same level of interest but moving it slower because they need evidence, time, and a sense of the real person before opening.
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
  Naming the pacing difference around week three, kindly, specifically, and without making it a problem, is one of the most underused moves in dating. It sounds like:
  </p>
  <blockquote>
  "I notice I tend to move pretty fast when I like someone. I want to make sure I'm pacing this in a way that works for you too, let me know if I'm too much or too little."
  </blockquote>
  <p>
  Or from the other direction:
  </p>
  <blockquote>
  "I want you to know I'm in this. I just move slower than I sometimes wish I did. If I go quiet for a day it's not because I'm losing interest."
  </blockquote>
  <p>
  Both of those sentences sound vulnerable. They are. They're also what makes the next four weeks possible.
  </p>

  <h2>How to know your own pace</h2>
  <p>
  Most people have never thought explicitly about their own love-pace, which is why the mismatch is so common, you can't communicate something you can't name. Some signals:
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
  Most people fall into one of five patterns when tension hits in early dating. Knowing which one is yours, and which one they have, predicts the next six months better than anything else.
  </p>
  <p>
  <strong>The Confronter</strong> brings it up in the moment, directly, without much wrap. Honest, fast, useful, and can read as aggressive to anyone who needs runway.
  </p>
  <p>
  <strong>The Processor</strong> goes quiet, thinks it through, and comes back with something considered. Their delayed responses are the work, not the avoidance, but to a partner who needs reassurance in the moment, the delay can feel like punishment.
  </p>
  <p>
  <strong>The Smoother</strong> protects the connection by shifting the energy. Jokes, redirects, "let's not let this ruin the night." Great in the moment, hazardous over months because the things that didn't get said become resentments wearing a costume.
  </p>
  <p>
  <strong>The Archiver</strong> doesn't make a thing of any individual moment. They track the pattern across weeks. Wise, and quietly devastating when the partner finds out months later that there was a list they were being measured against without knowing.
  </p>
  <p>
  <strong>The Repairer</strong> can name what hurt and restitch the connection in the same conversation. Rarest. The closest thing to a relationship superpower.
  </p>

  <h2>Why early matters more than later</h2>
  <p>
  The pattern you set in the first hard moment becomes the template for every subsequent hard moment. If the first time someone hurt your feelings you went quiet, the third time you'll go quiet faster. If they jokingly deflected, they'll deflect harder next time.
  </p>
  <p>
  The patterns are not destiny, they can be changed, but only when they're seen. And early dating is when they're easiest to see, because the stakes are still low enough to actually look at them.
  </p>

  <h2>The "what would make me trust you more" question</h2>
  <p>
  One of the most useful exercises after any small early-relationship friction is to ask yourself: <em>what would they need to do in this moment to make me trust them more?</em>
  </p>
  <p>
  Most of the time the answer is small and specific. Acknowledge what happened. Say the apology and the change in the same sentence. Not perform repair, just do the actual thing. The people who can do this are rare and worth pacing yourself to find.
  </p>

  <h2>The mismatch nobody talks about</h2>
  <p>
  Confronters with Processors look like a flashpoint pairing, and they are, for the first two months. But they're actually one of the most stable long-term combinations, because both styles are honest. The Confronter learns to give the Processor time. The Processor learns to name the delay rather than disappear into it. It works.
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
  This is the soft-boundary trap, and it's almost always self-imposed. The person you're with isn't trying to manipulate you. They're responding to the actual signal you sent, which was, "this might be no, but the door's open if you'd like to keep negotiating."
  </p>

  <h2>The math of soft boundaries</h2>
  <p>
  Every boundary you set has two parts: the limit itself, and the wrapper around it. The wrapper is where soft-boundary people put 90% of their effort and 100% of their anxiety.
  </p>
  <p>
  The wrapper is meant to do two things at once: protect the other person from feeling rejected, and protect you from being seen as rigid. The problem is that the wrapper consistently undermines the limit. The more padding you add, the more negotiable your no sounds, even when it isn't.
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
  "Yeah I mean, I might, I think I'm pretty tired tonight and I have a thing tomorrow, but if it's important we can totally figure something out, sorry, I'm being weird, what do you want to do?"
  </blockquote>
  <blockquote>
  "I can't tonight. I'm too tired to be good company. Let's do Saturday."
  </blockquote>
  <p>
  Both are honest. Both are kind. Only one of them ends the negotiation.
  </p>

  <h2>The "and" reframe</h2>
  <p>
  One of the highest-leverage skills in boundary work is replacing "but" with "and." Watch:
  </p>
  <p>
  "I can't do this, <strong>but</strong> I want you to know I really like you", the "but" makes the second clause feel like consolation, which makes the first clause feel like rejection.
  </p>
  <p>
  "I can't do this, <strong>and</strong> I really like you", the "and" makes both true at once. The limit doesn't have to mean less interest. Most people have never been taught this.
  </p>

  <h2>The thing your nos do for your yeses</h2>
  <p>
  The reason real boundaries matter is not that they protect you, though they do. It's that they make your yeses mean something. If your no is negotiable, your yes is also conditional. If your no is real, your yes is too.
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
  Most people don't need another app. They need a layer on top of the apps they already have, a private space that remembers what they noticed, surfaces the patterns they're not tracking, and tells them what their last six dates have in common.
  </p>
  <p>
  That's what we mean by a second brain for your dating life. It's a quiet, persistent system that does the cognitive work nobody else is doing for you.
  </p>

  <h2>What your dating brain is currently storing</h2>
  <p>
  Right now, your dating life lives in seven places: three apps, your camera roll, three group chats, your memory, and a vague sense of how things have been going. None of these talk to each other. None of them remember the small thing you noticed on date two that you forgot by date five.
  </p>
  <p>
  The cost isn't obvious in any single moment. It shows up in the aggregate, the patterns you don't see, the date you didn't realise was the third "let's grab dinner sometime" that never materialised, the type of person you keep ending up with even though you keep saying you want someone different.
  </p>

  <h2>What a real second brain does</h2>
  <p>
  At minimum, a working second brain for dating does four things:
  </p>
  <p>
  <strong>1. It captures friction-free.</strong> Post-date notes that take 60 seconds. Voice memos that turn into structured signals. Pasted screenshots that become observable patterns. If logging takes effort, you won't do it.
  </p>
  <p>
  <strong>2. It surfaces patterns you can't see.</strong> You can't notice that you've initiated 80% of your conversations because you don't have a count. You can't notice that every date with someone who has a specific energy ends after the third date, until something else counts the dates.
  </p>
  <p>
  <strong>3. It runs the analysis when you ask.</strong> A real read on a new match's profile. A real assessment of how a message will land before you send it. A real summary of how this week was different from last week.
  </p>
  <p>
  <strong>4. It belongs to you.</strong> Not to a dating company optimising for your continued swiping. To you, exportable, deletable, with explicit consent for anything that touches it.
  </p>

  <h2>Why now</h2>
  <p>
  The technology for this has only been good enough for about 18 months. Large language models can finally hold the nuance of a paragraph of text and return something specific instead of generic. OCR can pull a profile out of a screenshot reliably. Storage is cheap enough that capturing every detail is no longer the limit, making sense of it is.
  </p>
  <p>
  The result is that for the first time you can run analysis on your own dating data the way a marketing team would run analysis on their funnel. Not because you're a project, because the patterns are real and worth seeing.
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

  "specificity-beats-clever": (
  <>
  <p>
  A friend of mine spent four hours last winter rewriting her Hinge bio so it would be funny. She workshopped it with two people. Tested three variations. Landed on a tight little joke about being the kind of person who alphabetizes her spice rack but loses her keys twice a week.
  </p>
  <p>
  It got her nothing. Three matches in a week, all from men who said some version of "haha cool bio." None of them led anywhere. She asked me what was wrong with it.
  </p>
  <p>
  Nothing was wrong with it. It was a perfectly fine joke. It just was not a person.
  </p>

  <h2>Clever is a defense mechanism</h2>
  <p>
  Clever bios feel like effort because they are effort. You have to think about them. You have to test them. You have to file off the rough edges until the line sits clean. That work is real. It is also, often, work in the wrong direction.
  </p>
  <p>
  The thing clever bios accomplish, almost without fail, is distance. A clever line lets you show up without quite showing up. You point at yourself sideways. You make the reader laugh, which feels like a connection, but the only thing you have told them is that you can write a joke. Which is not nothing. But it is not enough to start a conversation that goes anywhere real.
  </p>
  <p>
  I have read a lot of these. Bios about being the friend who plans the trip. Bios about how the writer is 30% golden retriever and 70% goblin. Bios that open with "warning: I will steal your fries." They are all small, contained pieces of performance. None of them tell me what you are actually like at brunch on a Sunday in October.
  </p>

  <h2>Specific is not the same as long</h2>
  <p>
  People hear "be more specific" and think "write more." Then they panic, because they already feel like they are writing too much. So they delete a sentence and call it done.
  </p>
  <p>
  Specific is not a length problem. It is a content problem. One specific sentence beats a paragraph of vague ones. Compare:
  </p>
  <blockquote>"I love trying new restaurants and exploring the city on weekends."</blockquote>
  <blockquote>"I have been going to the same Vietnamese place in Marrickville every Sunday for two years and they no longer ask what I want."</blockquote>
  <p>
  The second one is the same length. The second one tells me where you live, what you do on Sundays, how loyal you are to the things you like, and that you might be the kind of person who has a regular order somewhere. Which is a lot of information for one sentence.
  </p>
  <p>
  The first sentence tells me nothing. It is true of about 40 million people. If I screenshotted it and texted it to four of your friends, none of them would recognize you in it.
  </p>

  <h2>The screenshot test</h2>
  <p>
  This is the test I run on my own writing and the test I run on bios people send me. Take any line from the bio. Imagine you screenshotted it and sent it to three of the writer's close friends, with no context. If those friends would respond "yeah, that sounds like her," the line is doing work. If they would respond "could be anybody," the line is filler.
  </p>
  <p>
  Most clever bios fail the screenshot test. Most specific bios pass it easily. The cleverness lives in your head. The specifics live in your actual life, which is the thing the reader is trying to figure out.
  </p>

  <h2>What specificity does to the reader</h2>
  <p>
  When someone reads a specific bio, two things happen in their head that do not happen with a clever one.
  </p>
  <p>
  First, they form a picture. Not of your face, of your life. They see the Vietnamese place. They see the Sunday. They see the woman who walks in and the owner already turning toward the kitchen. Their brain has now done unpaid work building a small movie of you, which means they are slightly invested before they even decide whether to swipe.
  </p>
  <p>
  Second, they get a hook. They can message you about Marrickville. About what the regular order is. About whether you have tried the place two doors down. Specific bios hand the reader a reason to type something. Clever bios usually do not, because the joke is closed. There is nowhere to go after "haha that is great."
  </p>

  <h2>Why specific feels riskier (and why it is not)</h2>
  <p>
  Most people resist specificity because it feels exposing. If I say I go to a specific Vietnamese place every Sunday, what if the person reading it thinks that is sad? What if they think I am boring? What if they Google the place and decide they hate it?
  </p>
  <p>
  I get it. The fear is real. The math is not.
  </p>
  <p>
  The people who would be turned off by a specific honest thing about your life were never going to be a good match. The people who are drawn in by it are exactly who you want. Specificity is a filter, not an exposure problem. The exposure is the filter working.
  </p>
  <p>
  Clever bios, by contrast, attract a broad audience of people who like clever bios. That sounds good until you have spent six months going on dates with people who turned out to share none of your actual values, only your taste in punchlines.
  </p>

  <h2>Three swaps to try this week</h2>
  <p>
  If your bio is doing the clever thing right now, try three swaps. You do not have to delete the joke. You just have to add some weight to it.
  </p>
  <p>
  Swap a job title for a sentence about what you actually do at work that you like. "I'm a product manager" becomes "I'm a product manager and my favorite part of the week is the Tuesday meeting where we look at last week's user research and argue about what it means." Different reader. Different conversation.
  </p>
  <p>
  Swap a hobby word for the smallest concrete version of it. "I love reading" becomes "I am 80 pages into the new Sally Rooney and not sure yet." Now I know when this bio was last edited, what you are reading, and that you are willing to say a book might not be a hit. That is three signals in twelve words.
  </p>
  <p>
  Swap an aspiration for a regular routine. "Looking for someone to travel with" becomes "Going to Lisbon in October by myself, would also do it with the right person." Now you are a person with a plan. Now I can ask about Lisbon. Now there is a conversation.
  </p>
  <p>
  You will know it is working when the messages you get start referencing things in the bio instead of the photos.
  </p>
  </>
  ),

  "photo-order-on-hinge": (
  <>
  <p>
  On Hinge, you get six photos. Most people upload them in the order their phone hands the photos to them. Maybe they swap one or two. Then they call it done and move on.
  </p>
  <p>
  That sequence is doing more work than your bio. By a wide margin. And almost nobody touches it after the first afternoon they set up the profile.
  </p>

  <h2>The first photo is not the photo you think</h2>
  <p>
  The first photo is not the "best" photo. It is the photo that decides whether anyone scrolls to the second one.
  </p>
  <p>
  Those are different jobs. The "best" photo, the one your friends helped you pick because you look amazing in it, is often a tight portrait at golden hour. Great photo. Bad opener. Because a tight portrait gives the viewer nowhere to go. They have already seen your face. There is no reason to swipe through the rest.
  </p>
  <p>
  The first photo should give a clear, fast read on who you are, with one piece of context the next photo can build on. A wider shot of you doing something specific is almost always stronger than a tighter shot of you looking great. The face you can do anywhere in the lineup. The first slot has a different job.
  </p>

  <h2>Photos 2 through 4 are a tiny film</h2>
  <p>
  This is the part most people miss. Hinge users do not see your photos as a grid. They see them one at a time, in order, with a little tap or swipe between each one. That sequence is a film. A very short film about who you are.
  </p>
  <p>
  If your photos go: clear face shot, group photo at a wedding, photo of you on a mountain, mirror selfie at the gym, photo of your dog, blurry photo from a concert, the film looks like this. Person. Friends. Outdoorsy. Cares about body. Has dog. Goes out. That is a fine little stack of signals. It also tells the viewer nothing they have not already seen on 200 other profiles this week.
  </p>
  <p>
  If your photos go: clear wide shot of you on a kitchen island holding a bowl of pasta, then a close-up of the pasta, then you laughing with a friend in the same kitchen, then a different night at a restaurant in what looks like the same neighborhood, the film is a story. This person cooks. This person feeds people. This person has a Saturday night life that revolves around tables and friends. That is a much stronger lineup with the exact same elements rearranged and trimmed.
  </p>

  <h2>The third photo rule</h2>
  <p>
  People decide whether to keep reading at the third photo. That is roughly when the brain decides the profile is worth the cognitive cost of finishing.
  </p>
  <p>
  If photo three is a repeat of photo two in spirit, energy drops. Another solo shot, slightly different angle, similar lighting, similar background. The viewer's brain quietly tags the profile as "I have seen what this person has to offer" and starts looking for an exit.
  </p>
  <p>
  Photo three should be the photo that surprises them. A different setting. A different version of you. The pasta person is at a friend's wedding looking unrecognizable in formal wear. The wedding person is suddenly muddy after a hike. The hike person is now sitting on the floor with a guitar. The contrast does not have to be dramatic. It just has to be a turn.
  </p>

  <h2>Group photos kill more profiles than they help</h2>
  <p>
  Almost everyone is told to have one group photo "to show you have friends." This advice has aged badly. The problem is not that group photos are bad. The problem is where people put them.
  </p>
  <p>
  A group photo in slot two is a small disaster. The viewer just saw your face in slot one. Now they have to find you again in a crowd. They do not want to. They will not bother. They swipe.
  </p>
  <p>
  If you must include a group photo, put it in slot four or later, after the viewer already knows your face cold. And it should be a group of four people max. Five faces in a photo on a 6-inch phone screen is a face you cannot see.
  </p>

  <h2>The last photo is the close, not the leftover</h2>
  <p>
  The last photo is the one that decides whether they message after they have already decided to like the profile. It is also the photo people treat as a dumping ground for the one they like that did not fit anywhere else.
  </p>
  <p>
  I would put your most specific, most warm, most "this is what hanging out with me feels like" photo here. The one where you are clearly mid-laugh. The one where you are clearly comfortable. The one that closes the door behind them so they want to write something instead of just tapping the heart.
  </p>

  <h2>The slot-six trap</h2>
  <p>
  The other lineup mistake I see constantly. Slot six is treated as either a throwaway or, worse, a "fun" photo that does not look like you. A heavily filtered shot. A photo from 2019 with significantly different hair. A wide landscape from a hike that does not have you in it at all.
  </p>
  <p>
  A reader who has tapped through five photos and made it to the last one is the most invested they are going to get before deciding whether to message. Showing them a photo where you are hard to identify, or a photo with no face, or a meme of your dog, breaks the moment. They were about to commit. The last photo handed them an exit.
  </p>
  <p>
  Put your second-clearest face shot here if you have nothing else. A clear face the reader can carry into the message they are about to write is worth more than a clever close.
  </p>

  <h2>A small experiment to run this week</h2>
  <p>
  Do not change your photos. Just reorder them. Try this sequence.
  </p>
  <p>
  Slot one: wider context shot, clear face, doing something specific. Slot two: tighter portrait that confirms what they saw in slot one is really what you look like. Slot three: a turn. Different setting, different energy. Slot four: social proof, ideally not a wedding. Slot five: a hobby or place you spend real time in. Slot six: a warm "what hanging out with me feels like" close.
  </p>
  <p>
  Leave it for two weeks. Watch what shifts. If you are like most of the profiles I have looked at, the message quality changes before the match volume does. That is a good sign. It means the people writing now are the ones who actually finished the lineup.
  </p>
  </>
  ),

  "what-your-prompts-actually-say": (
  <>
  <p>
  Hinge gives you three prompt slots. Most people treat them like a quiz with right and wrong answers. You pick the prompt that has an answer you can think of. You type the answer. You move on.
  </p>
  <p>
  This is the wrong frame. Prompts are not a quiz. They are a tone of voice. The viewer is not grading the answer. They are listening to how you talk.
  </p>

  <h2>The voice is the message</h2>
  <p>
  If your three prompts are, in order: a punchline about being too tall for compact cars, a list of three travel destinations, and a sentence about how you want a partner who will challenge you, your voice is doing three different things at once. Funny. Lifestyle bullet list. Earnest dating-app cliche. The reader's brain has to switch register three times in 90 seconds.
  </p>
  <p>
  What they take away is not the content of any of the three answers. It is that they do not quite know who they were just reading.
  </p>
  <p>
  Tone consistency across the three prompts is more important than the cleverness of any single one. Pick a register. Stay there. Let the three answers feel like the same person talking on three different days.
  </p>

  <h2>What the three most common answers actually communicate</h2>
  <p>
  I read a lot of profiles. Here are three answers I see roughly once a day, with what they actually communicate to a careful reader.
  </p>
  <p>
  <strong>"Two truths and a lie: I've been skydiving, I speak three languages, I hate cilantro."</strong> This communicates: I have not thought about this for more than 30 seconds. The three items are unrelated in a way that feels generic. The reader cannot do anything with them. There is no story to follow up on. The skydive happened seven years ago and you have not done it since. The languages turn out to be high school French and a tourist amount of Italian. The cilantro thing is a Twitter-meme position, not yours.
  </p>
  <p>
  <strong>"The way to win me over is: good food, good wine, good conversation."</strong> This communicates: I am describing literally any acceptable date. The viewer learns nothing about your specific taste. Worse, the structure of the answer, the rule of three with a parallel adjective, signals that you reached for the safest possible shape. Which they then read into your personality.
  </p>
  <p>
  <strong>"I geek out on: history podcasts, cooking, and travel."</strong> This communicates: a list of three things, none of which I am going to elaborate on. "I geek out on" implies depth. Three generic nouns refuse to deliver any. So the answer collapses on itself. The reader leaves with no specific image to grab onto.
  </p>

  <h2>The say-it-out-loud test</h2>
  <p>
  Read your prompt answers out loud. Not in your head. Out loud, in your normal speaking voice, in a room by yourself.
  </p>
  <p>
  If you sound like a person, the answer is probably working. If you sound like the back of a wine bottle, the answer is not.
  </p>
  <p>
  The reason this test works is that your speaking voice has rhythm. It has the small ums and qualifiers and turns of phrase that make you, you. Most prompt answers strip that out in the name of being concise, then accidentally end up sounding like marketing copy for a person who does not exist.
  </p>

  <h2>One prompt should do the actual work</h2>
  <p>
  You only need one of your three prompts to be doing real work. The other two can be lighter. They can be jokes, they can be small specific things, they can be a one-line preference.
  </p>
  <p>
  The "real work" prompt is the one where you say something that gives a reader a clear picture of how you actually live. Not what you value. Not what you are looking for. How you live.
  </p>
  <p>
  "My ideal Sunday" is a good slot for this if you actually describe a Sunday, in order, with at least one detail that is true and slightly weird. "Wake up too late, take a long walk to the cafe on Crown that does the egg sandwich, get back to the apartment in time to lose two hours of the afternoon to a book I keep saying I am almost done with, then probably the same friends as every Sunday at the same bar." That is a paragraph. It is also a person.
  </p>

  <h2>What the reader is checking for</h2>
  <p>
  When someone reads your three prompts, they are not grading you. They are running a small unconscious checklist. Does this person sound like a person. Could I have a conversation with this person without it being work. Do I get any sense of what they actually do all week. Would I be bored on a date with them.
  </p>
  <p>
  The prompts answer those questions whether you mean for them to or not. The trick is to know which questions yours are currently answering, and to make sure the answers are the ones you want.
  </p>

  <h2>The prompt you should almost never pick</h2>
  <p>
  "Don't hate me if I." It is the most overrepresented prompt on the app, and almost no one has a real answer to it. The honest answers are mild ("don't hate me if I take my shoes off at restaurants") and the dishonest ones are performative ("don't hate me if I love pineapple on pizza," which everyone has heard 500 times).
  </p>
  <p>
  The structural problem is that the prompt invites a confession at a register that is too low to be interesting. You end up promising a small transgression and then delivering something that is not transgressive at all. The reader feels the gap.
  </p>
  <p>
  Same goes for "Two truths and a lie," "I'll fall for you if," and "The hallmark of a good relationship is." These are prompts that almost always produce the same five answers. If you can write something genuinely fresh to them, fine. Otherwise pick a prompt that does not have a default groove worn into it.
  </p>

  <h2>What to do this afternoon</h2>
  <p>
  Open your three prompts. Read them out loud. Notice which one sounds the least like a person. Rewrite that one with one concrete detail from the past month of your actual life. A street name. A meal. A specific thing you said yes or no to.
  </p>
  <p>
  If you cannot think of anything that fits, that itself is a piece of information. The prompt may be wrong for you. Change the prompt before you change the answer.
  </p>
  </>
  ),

  "bio-anti-patterns-i-keep-seeing": (
  <>
  <p>
  I have looked at a lot of dating profiles in the last year. Hinge, Bumble, Tinder, the lot. The same six bio moves keep coming up. They feel safe to write. They read as forgettable. If your bio has two of them, your profile is almost certainly blending into the scroll, which is the worst place it can be.
  </p>
  <p>
  None of these are wrong. They are just inert. They take up space that could be doing work.
  </p>

  <h2>1. The list of cities</h2>
  <p>
  "Sydney via Melbourne via London." Or some version of it. The geographical resume bio. It tells the reader you have moved, which is true of a large fraction of people on dating apps, and gives them no other information to work with.
  </p>
  <p>
  The fix is not to delete the cities. It is to pick one of them and say something specific about it. "Sydney, but I still miss the corner store under my flat in Highbury that sold both wine and lightbulbs." That is the same fact. It is now a person.
  </p>

  <h2>2. The Office quote, or its equivalent</h2>
  <p>
  "I am Jim. Looking for my Pam." "Schrute Bucks accepted." Any line that signals you watched a show that the reader also watched. This was almost charming in 2017. It now functions as a placeholder for a personality.
  </p>
  <p>
  The reason it does not work is that it is borrowed. You did not write it. The reader cannot tell what is yours and what is reflexive. Borrowed lines from popular media are read as decoration, not content. They make the viewer feel like they are looking at someone else's stuff arranged on your wall.
  </p>

  <h2>3. The disclaimer about hating writing bios</h2>
  <p>
  "I am terrible at writing these things." "Bios are weird, just ask me anything." "Send help, I do not know what to put here."
  </p>
  <p>
  This is a defensive move pretending to be a humble one. What it actually communicates is: I did not put effort into this and I want you to do the work instead. The reader, who has 80 other profiles to look at, declines.
  </p>
  <p>
  The fix is not "try harder at being witty." The fix is to just write the next sentence, the one you would have written if you had not opened with the apology. Start there.
  </p>

  <h2>4. The list of activities with no specifics</h2>
  <p>
  "I love hiking, reading, traveling, trying new restaurants, and spending time with friends."
  </p>
  <p>
  This sentence is in roughly one in four bios. It contains no information. Every person on the app likes those things. Listing them is the textual equivalent of breathing.
  </p>
  <p>
  If you do hike, name one trail. If you read, name a book you are 100 pages into and not yet sure about. If you travel, name the last place you slept that was not your own bed and one thing about it. If you love restaurants, name a meal that genuinely changed your week. Each of these is a small risk. Each one is also the entire reason a bio exists.
  </p>

  <h2>5. The wish list</h2>
  <p>
  "Looking for someone who is kind, ambitious, funny, and emotionally available."
  </p>
  <p>
  I want to be careful here. There is nothing wrong with knowing what you want. The issue is that this kind of sentence lands as a job posting. It tells the viewer how to qualify for an interview. It tells them nothing about what working at the company is like.
  </p>
  <p>
  If you want to communicate that you take dating seriously, do it by being specific about your own life, not by listing the attributes of a hypothetical partner. The viewer will infer what you want from how you present yourself. A bio that is clearly written by a thoughtful person attracts thoughtful readers without ever using the word.
  </p>

  <h2>6. The catalog of irony</h2>
  <p>
  "Not here for hookups, not here for games, not here for anything serious, just here to see what happens." Or some version of being on the app while also being above the app.
  </p>
  <p>
  The reader can tell. It reads as ambivalence with a wink. It is the equivalent of showing up to a party and announcing that you do not really like parties. People will believe you and leave you alone, which is the opposite of what you wanted when you opened the app.
  </p>
  <p>
  If you are ambivalent about dating right now, that is fine. The bio does not have to address it. Write the bio of the version of you who wants to meet someone, and let the ambivalence live in your head where it belongs.
  </p>

  <h2>Bonus pattern: the height-and-stats opener</h2>
  <p>
  On apps that do not display height by default, a small contingent of men open the bio with their height. Sometimes followed by their MBTI and their enneagram. "6'2, ENTJ, 4w3, looking for my person."
  </p>
  <p>
  I understand why this happens. Height filtering on dating apps is real and exhausting. Stating it up front is meant to remove ambiguity. The problem is that opening with stats sets the entire bio in a register of measurement. The rest of whatever you write is read through that frame. The reader has been told, in the first line, that you think of yourself as a set of data points. The line that follows has to fight uphill against that.
  </p>
  <p>
  If you want to put your height in the bio, put it later. Buried in a sentence about how you can never find pants that fit. Anything except the opening line.
  </p>

  <h2>The compounding effect</h2>
  <p>
  One of these in a bio is recoverable. Most people have at least one. Two of them and the profile starts to read as generic. Three and the reader has stopped seeing a person and started seeing a category.
  </p>
  <p>
  Go look at your bio. Count how many of the six are in there. Pick the one that hurts the least to cut. Replace it with one true sentence about your actual week. That single swap usually changes the kind of person who messages you within ten days.
  </p>
  </>
  ),

  "the-everything-profile-attracts-nobody": (
  <>
  <p>
  The most common bad profile is not the lazy one. It is the careful one. The one that has been edited five times to make sure it does not say anything that could turn anyone off. The one that ends up appealing to everyone in theory and nobody in practice.
  </p>
  <p>
  I think of these as everything profiles. They are trying to be appropriate for every kind of person who might read them. The result is a profile with no edges, which is also a profile that no specific person feels something about.
  </p>

  <h2>Why the everything profile happens</h2>
  <p>
  You sit down to write your bio. You think, what if I mention I like staying in on Friday nights, and the kind of person I want is more of a party person, and they swipe past. So you take it out. You think, what if I mention I run a small business, and the kind of person I want feels intimidated, and they swipe past. So you take it out.
  </p>
  <p>
  You do this maybe 15 more times. Each cut feels rational in isolation. At the end, the bio says you love good coffee and traveling and being outside. Which is also what every other bio says, for exactly the same reasons.
  </p>
  <p>
  The mental model is that the goal is to maximize the pool of people who might swipe right. The actual goal, the one that produces dates and relationships, is to maximize the pool of people who swipe right because something specific in the profile made them feel like this person might be worth meeting.
  </p>

  <h2>Particular beats narrow</h2>
  <p>
  The fix is not to write a niche profile. Writing for a niche is its own trap. You end up performing a personality you think will appeal to a specific subculture, which is just a different version of writing for an imagined audience.
  </p>
  <p>
  The fix is to be particular. Particular is not narrow. Particular is what your actual life looks like, written down without sanding off the parts that make it yours.
  </p>
  <p>
  Consider the difference. Narrow: "I am looking for someone who is into wine and the slow food movement and weekend trips to the Hunter Valley." Particular: "I have a Sunday tradition of cooking too much pasta and inviting two people over who have not met each other."
  </p>
  <p>
  The narrow version filters for a lifestyle. The particular version filters for a person who responds to specificity. Those are different filters. The second one will produce better matches because it filters on something that actually predicts compatibility, which is taste in detail.
  </p>

  <h2>The fear is real, the math is wrong</h2>
  <p>
  When I tell people to be more particular, the most common response is some version of "but what if it scares people off."
  </p>
  <p>
  The answer is yes. It will scare some people off. That is the point. Those people were not going to be a good match. Filtering them out earlier saves both of you a Wednesday evening at a wine bar in two months.
  </p>
  <p>
  The other thing that happens, which people do not predict, is that the right kind of stranger reads the particular bio and feels relief. Something specific. Something they can ask about. Something that suggests the person on the other end is a real human and not a customer service script. That feeling is what triggers the swipe.
  </p>

  <h2>How to find your particulars</h2>
  <p>
  Most people do not have a particular-finding problem. They have a particular-noticing problem. The details are there. They just do not show up when you sit down to write a bio because the bio-writing brain immediately reaches for the generic shape.
  </p>
  <p>
  One exercise that works. Open your messages. Find the last three real conversations you had with close friends in the past week. Read them. The voice in those conversations is yours. The references in them are yours. The small specific things you complained about, the bit you keep bringing up about your boss, the joke you and your sister have been running for five years, the cafe you keep mentioning. That is your material.
  </p>
  <p>
  Most of what you need for a good bio is already in the last 30 messages you sent someone who knows you. You are just used to writing the bio in a different voice than the one you actually use.
  </p>

  <h2>The two-line test</h2>
  <p>
  Open your bio. Find the two sentences that are doing the most work. If you cut them, would the bio still describe a recognizable person? If yes, the rest of the bio is filler. Cut it. Let the two good lines breathe.
  </p>
  <p>
  Most bios I rewrite end up shorter than they started, because the rewrite is mostly an act of removing what was not earning its place. The everything profile has more words than it needs. The particular profile usually has fewer.
  </p>

  <h2>The "third paragraph" tell</h2>
  <p>
  Here is a quick diagnostic. Read your bio aloud and count the sentences. If you can finish the whole bio without ever having said something a friend of yours would tease you about, the bio is still in everything mode.
  </p>
  <p>
  The tease-able sentence is the one that gives a specific human texture. The fact that you cannot pass a bookstore without going in even if you do not need anything. The fact that you fall asleep with the TV on every night and pretend you do not. The fact that the longest grudge you currently hold is against a former coworker who took credit for an idea in 2022. None of these need to be in the bio. But the bio should contain at least one sentence in the same key. Otherwise it is just a list of acceptable answers.
  </p>

  <h2>What changes when you stop trying to please everyone</h2>
  <p>
  The first thing you notice, after you swap an everything profile for a particular one, is that the match volume often drops a little. Sometimes more than a little. This is the moment people panic and revert.
  </p>
  <p>
  Do not revert. Wait a week.
  </p>
  <p>
  The match volume drops because the filter got sharper. The replies you do get are different. The conversations start somewhere other than "hey." People reference things in your profile. The energy is higher. The percentage that turn into actual dates climbs. Which is the only number that ever mattered.
  </p>
  <p>
  The everything profile gives you a lot of matches with nobody specific. The particular profile gives you fewer matches with people who actually wanted to meet you. The second outcome is the one you opened the app for.
  </p>
  </>
  ),

  "when-good-photos-still-fail": (
  <>
  <p>
  You hired a photographer. Or your friend with the good camera spent a Saturday afternoon on it. The photos are sharp. The lighting is soft. You look like yourself, on a good day, in good light. You upload them. Nothing happens.
  </p>
  <p>
  This is one of the more frustrating versions of a dating-app problem, because the most common advice you will get is to fix the photos. The photos are fine. The lineup is the issue.
  </p>

  <h2>Good photos in a bad lineup</h2>
  <p>
  A photo lineup tells a story. The story is told by the order of the photos, the variety of settings, the energy of each shot relative to the ones around it, and the gaps between what is shown and what is implied.
  </p>
  <p>
  You can have six technically excellent photos that all tell the same small story. Six headshots in soft light. Six photos taken on the same afternoon at the same beach. Six versions of you looking serious at a slight angle to the camera. The viewer reads the lineup and concludes that this person exists in one mood, in one place, in one register. Which is not true of you, but it is what the photos are saying.
  </p>
  <p>
  This is the lie of good lighting. Good lighting can make any single photo feel substantial. It cannot make a lineup of six similar photos feel like a person.
  </p>

  <h2>The one-of-each rule</h2>
  <p>
  A working lineup usually has one photo from each of several categories. The categories are not strict. The point is variety.
  </p>
  <p>
  One photo of your face, clean and clear, no props. One photo of you doing something specific that is not posed. One photo with other people in it, ideally where the relationship to them is legible. One photo somewhere that says where you actually live or spend your time, which is rarely a beach in Bali. One photo that has some movement in it, where you are not staring at the camera. One photo that is slightly older or different, that adds a dimension the others do not.
  </p>
  <p>
  If five of your six photos are from the same category, the lineup is failing even if each photo is technically perfect.
  </p>

  <h2>The repeat-outfit problem</h2>
  <p>
  One of the easier diagnostics. Go look at your lineup. How many photos have you in the same outfit? If two or more of them are from the same day, that is two photos doing the work of one.
  </p>
  <p>
  This happens almost every time someone gets professional photos done. The photographer takes 300 shots over two hours. You pick the six best. All six are from the same shoot. Now the entire profile is wearing one outfit, has one haircut, was in one mood, and was photographed by one person who lit you the same way. The viewer reads this as a curated set, not a life.
  </p>
  <p>
  The fix is to use, at most, two photos from any single shoot. The other four come from your camera roll. Yes, the camera roll. Yes, the iPhone photo from last September of you laughing in a kitchen with bad overhead lighting. That photo is doing more work than the third headshot from the shoot.
  </p>

  <h2>The energy problem nobody names</h2>
  <p>
  There is a thing that happens with technically good photos where everyone in them is performing for the camera. You can feel it without being able to name it. The eyes are not quite present. The smile is in place but not earned. The body is angled correctly. The vibe is poster, not person.
  </p>
  <p>
  This is hard to fix in a photo shoot because the photo shoot is the problem. You are aware of being photographed, so you perform. The performance is competent. The performance is also what the viewer reads.
  </p>
  <p>
  The photo in your lineup that is doing the most work, almost always, is the one where you were not aware the photo was being taken. The one a friend snapped from across a table while you were in the middle of a sentence. The one from a birthday party where you were laughing at something the person to your left said. Those photos look slightly less "good" by photo-shoot standards. They look much more like a person you might want to meet.
  </p>

  <h2>The third-photo gap</h2>
  <p>
  Watch what happens between your second and third photo. This is where most lineups die.
  </p>
  <p>
  Photo one: clear shot of you. Photo two: another clear shot of you, slightly different angle, same energy. Photo three: a third clear shot. By now the viewer is looking at three versions of the same input. The brain marks this as redundant and stops investing attention.
  </p>
  <p>
  Photo three needs to be a turn. A different setting, a different version of you, a different mood. The contrast is what keeps the viewer scrolling. If your good photos are all in the same register, slot three is where the lineup quietly collapses.
  </p>

  <h2>The "what would a stranger conclude" exercise</h2>
  <p>
  A useful exercise. Hand your phone to a friend who has not seen your profile. Have them swipe through the photos once, in order, no bio. Then ask them three questions. Where do you think this person lives. What do you think this person does on a Sunday. What kind of people do you think this person spends time with.
  </p>
  <p>
  The answers tell you exactly what the lineup is saying. If your friend, who actually knows you, cannot answer those questions from the photos, no stranger is going to either. A photo lineup that produces three blank answers is not failing on quality. It is failing on coverage.
  </p>
  <p>
  Most fixes start there. Find the question the lineup cannot answer. Add one camera-roll photo that answers it. Do not add anything else. Watch the next two weeks.
  </p>

  <h2>Run the test on your current set</h2>
  <p>
  Pull up your profile. Look at the six photos in order. Ask three questions.
  </p>
  <p>
  Could a stranger tell where you actually live from the photos? If no, you have a setting problem. Could a stranger tell what kind of week you have when nothing exciting is happening? If no, you have a daily-life problem. Could a stranger tell what you are like with people who know you well? If no, you have a relationship-legibility problem.
  </p>
  <p>
  One of those three questions usually answers itself the moment you ask it. The fix is rarely a new photo shoot. It is one camera-roll photo that fills a missing register in the lineup you already have.
  </p>
  </>
  ),

  "one-prompt-to-pre-filter-everyone-wrong": (
  <>
  <p>
  If you only change one line in your profile this month, make it the one that does the pre-filtering. Done well, it saves you the equivalent of three first dates that were never going to work. Done badly, it does nothing and you stay in the queue.
  </p>
  <p>
  The prompt that does the filtering is not the one you think. It is not "deal breakers." It is not "looking for." It is not the manifesto where you list what kind of person you want.
  </p>
  <p>
  The prompt that filters is the one that names a small specific thing about how you actually live, with enough clarity that the wrong person reads it and quietly swipes left.
  </p>

  <h2>How the filter actually works</h2>
  <p>
  Most people think the filter mechanism in a profile is intellectual. The reader sees a value or preference, agrees or disagrees, and acts accordingly.
  </p>
  <p>
  That is not how it works. The filter mechanism is emotional. The reader feels a small yes or a small no when they read the line. The yes or the no fires before the conscious thought arrives. The swipe follows the feeling.
  </p>
  <p>
  This is why "I want someone kind and ambitious" filters nothing. It does not produce a feeling. Everyone agrees in principle and swipes regardless. Whereas "I do not own a TV and have a strong opinion about the people who use that as a personality trait" does produce a feeling. Some readers feel relief. Some feel mild offense. Either way they are out of the queue of false positives.
  </p>

  <h2>The structure of a good filter prompt</h2>
  <p>
  The best filter prompts share three properties.
  </p>
  <p>
  First, they describe a behavior rather than a value. "I cook on Sundays and freeze the leftovers" is a behavior. "I love cooking" is a value. The behavior triggers a feeling because the reader can imagine themselves living next to it. The value does not, because the value is abstract.
  </p>
  <p>
  Second, they have some friction. They include one detail that some readers will react against. Not a deal breaker. A texture. "I am asleep by 10:30 most nights because I run a small business and I am tired" has friction. The reader who wants someone who closes down bars on Saturdays feels a quiet no. Which is the point.
  </p>
  <p>
  Third, they are short. The longer the prompt, the more the reader's brain treats it as background. A two-sentence filter prompt outperforms a six-sentence one almost every time.
  </p>

  <h2>The one I keep recommending</h2>
  <p>
  The prompt I keep recommending to people is some version of: "What a normal Tuesday night looks like for me right now."
  </p>
  <p>
  Tuesday is the key word. Tuesdays are honest. Weekends are aspirational. Saturday nights are a performance you put on for the camera of the dating app. Tuesdays are what your life is actually like.
  </p>
  <p>
  A good Tuesday-night answer might be: "Home by 7, cook something that is mostly vegetables, on the couch with my dog and whatever I am watching, asleep by 10:30." Or: "Pottery class until 9, walk home, half an hour with a book before I fall asleep with the lights on." Or: "Late shift at the restaurant so I am not home until 1, then I am useless until Wednesday afternoon."
  </p>
  <p>
  Each of these tells the reader exactly what a relationship with you might look like on a non-special day. The reader who wants something different feels it. The reader who wants something like it feels it more.
  </p>

  <h2>What this prompt does that the others do not</h2>
  <p>
  The Tuesday-night prompt does three things at once that no single other prompt does as well.
  </p>
  <p>
  It pre-filters on energy match. People with very different energy levels read each other's Tuesdays and self-select.
  </p>
  <p>
  It pre-filters on life logistics. Late shifts, early bedtimes, kids, dogs, second jobs, gym schedules. All of these surface in the Tuesday answer without you having to list them as facts.
  </p>
  <p>
  It pre-filters on writing voice. The answer is short. You cannot hide in it. Either you sound like a person or you sound like a generic bio. The reader's brain picks up the difference in about three seconds.
  </p>

  <h2>The pushback I always get</h2>
  <p>
  Every time I suggest the Tuesday prompt to someone, the first response is some version of "my Tuesday is boring." Which is correct. And which is the point.
  </p>
  <p>
  Almost everyone's Tuesday is boring. Most relationships happen in the boring weekday space between work and sleep. The reader of your bio is also someone whose Tuesday is mostly unremarkable. When you describe yours honestly, you are showing them what the actual shared space of being together would look like. The fact that it is not exciting is exactly what makes it useful information.
  </p>
  <p>
  The other pushback is "but what if my Tuesday is genuinely just work and bed." That is also a valid answer. "Work until 8, eat whatever is in the fridge, bed by 11" is a perfectly good filter. It tells anyone who needs more evening energy than that to move along, and it tells the person on the same schedule that you exist.
  </p>

  <h2>What to do with your current pre-filter</h2>
  <p>
  If your current "filter" prompt is some version of a wish list, swap it. The wish list is not pre-filtering anyone. It is making the profile look serious without doing any work.
  </p>
  <p>
  Write your Tuesday in three sentences. Be specific. Use a real start time, a real activity, a real bedtime. Do not edit it to sound impressive. The fact that your Tuesday is unremarkable is most of the value of the answer.
  </p>
  <p>
  Leave it up for two weeks. Notice the difference in who messages you. The volume might drop. The conversations should get notably more aligned. Some of them will reference Tuesday specifically, which is your sign that the filter is working.
  </p>
  <p>
  The point of a filter prompt is not to attract more people. It is to attract fewer wrong ones. By that measure, the Tuesday answer is one of the few prompts that genuinely pays for the slot it takes up.
  </p>
  </>
  ),

  "profile-as-invitation-not-resume": (
  <>
  <p>
  If you have spent any time editing your dating profile, there is a moment most people hit where the bio reads back like a CV. Job. Hobbies. Education. Travel. Languages. A photo at a wedding. A photo on a mountain. A line about looking for something serious.
  </p>
  <p>
  The instinct that produces this is rational. You are presenting yourself to strangers who are deciding whether to spend an evening with you. Of course you list your credentials. Of course you show your best angles. This is how presenting yourself works in every other context.
  </p>
  <p>
  Dating profiles are not every other context. The mental model that produces good resumes produces bad profiles. The two formats are doing different work.
  </p>

  <h2>What a resume is for</h2>
  <p>
  A resume is a document that argues you are qualified for a role. The role is defined in advance. The reader is comparing you to a job description and to other candidates. The optimal resume is comprehensive, accurate, and free of personality, because personality is noise in a hiring decision.
  </p>
  <p>
  The reader of a resume is asking: should I move this person to the next stage? They are looking for proof. Specific accomplishments, measurable outcomes, verifiable credentials. Anything that is not proof gets in the way.
  </p>
  <p>
  This is exactly the wrong frame for a profile.
  </p>

  <h2>What an invitation is for</h2>
  <p>
  An invitation is a different document. It does not argue. It depicts. It shows the reader what a specific evening or experience would look like if they accepted. The optimal invitation is concrete, sensory, and a little particular. The reader can almost smell the room.
  </p>
  <p>
  The reader of an invitation is asking: do I want to be in that room? They are not comparing your invitation to a list of requirements. They are checking whether the picture you painted produces a small feeling of yes.
  </p>
  <p>
  This is the question someone is actually asking when they swipe. Not "is this person qualified." But "do I want to be in a room with this person."
  </p>

  <h2>What changes when you write an invitation</h2>
  <p>
  The first thing that changes is what you put in. Resume bios list. Invitation bios show. The job becomes a sentence about what you actually do at work that you like. The hobby becomes a small scene from the last time you did it. The travel becomes one street in one city you keep thinking about.
  </p>
  <p>
  The second thing that changes is what you leave out. A resume tries to be comprehensive. An invitation does not. An invitation can leave entire areas of your life unmentioned because the reader does not need to know everything to decide whether to come. They just need to see one room clearly enough to want to walk into it.
  </p>
  <p>
  The third thing is the voice. Resumes are written in a register that downplays the writer. Invitations are written in the writer's actual voice. The reader of an invitation is not just deciding whether to come. They are deciding whether they like the person doing the inviting.
  </p>

  <h2>The dinner-party heuristic</h2>
  <p>
  Here is a heuristic I use when I am stuck on a bio. Imagine you are writing an invitation to a dinner party you are throwing on Saturday. Not a wedding invitation. A casual one, by text, to a person you have not seen in a while who you genuinely want to come.
  </p>
  <p>
  What would that message say? Probably something like: "I am cooking a thing on Saturday, two friends you do not know, low key, food will be too much pasta and probably a decent bottle of wine. Come if you can." Notice what it does. It names the event. It gives the texture. It signals the energy. It invites without pressuring. It does not list your credentials as a host.
  </p>
  <p>
  Your bio is, structurally, doing the same job. It is inviting a stranger to consider a hypothetical Saturday with you. The texture of the invitation is what they are deciding on, not the credentials.
  </p>

  <h2>What people on the other end actually read</h2>
  <p>
  Ask anyone who has spent serious time on dating apps what they remember from the last 20 profiles they liked. They will not remember anyone's job. They will not remember anyone's height. They will remember one specific detail. The pasta on Sundays. The dog named after a poet. The thing about how he always orders the same drink at every bar.
  </p>
  <p>
  This is what gets remembered because this is what gets felt. The resume parts of the profile are scanned and forgotten in under a second. The invitation parts are what stay in the reader's head when they are deciding whether to swipe back.
  </p>

  <h2>The "first line" problem</h2>
  <p>
  Resume bios almost always open with a credential. Job title, city, age range. Invitation bios open with a sensory detail or a small scene. The opening line is doing more weight than the rest combined, because it is the only sentence that has the reader's full attention before they decide whether to keep reading.
  </p>
  <p>
  I have rewritten a lot of opening lines this year. Almost every successful rewrite involves cutting a fact and replacing it with a specific moment. "Architect in Brooklyn" becomes "I draw houses for a living and the best part of my week is the half hour I spend on the train sketching the building across from the platform." Same person. Different invitation.
  </p>
  <p>
  If your first line could be the headline of someone else's LinkedIn profile, it is doing resume work. Rewrite it as the first sentence of a story about a Wednesday in your actual life.
  </p>

  <h2>One swap to make this week</h2>
  <p>
  Find the most resume-shaped sentence in your bio. The one that sounds the most like a LinkedIn line. Usually it is the one that names your job, or the one that lists three hobbies, or the one that says where you went to university.
  </p>
  <p>
  Do not delete the underlying fact. Keep the fact. Rewrite the sentence as a tiny scene from the actual activity it describes.
  </p>
  <p>
  "Senior product manager at a fintech" becomes "I run product at a startup and most weeks the best part is the Tuesday meeting where we argue about what last week's user research means." Same fact. Now there is a room. Now there is a person in the room. Now the reader can decide whether they want to walk in.
  </p>
  <p>
  This is the entire move. Stop arguing that you are qualified. Start showing what the evening looks like. The right people will accept the invitation.
  </p>
  </>
  ),

  "the-death-of-hey": (
  <>
  <p>
  I have a folder on my desktop called "screenshots people send me" and somewhere in the high hundreds of those screenshots is a one-word opener. Usually it is "Hey." Sometimes "Hi" or "Heya" or, in the worst cases, "Yo." The person who sent the screenshot is always asking the same question, which is some version of: why is nobody replying to me.
  </p>
  <p>
  The honest answer is that "hey" does not give the person on the other end anything to do with their thumbs. And on a Tuesday night at 9:47pm, when they are lying in bed and have already swiped through forty profiles and answered seven other messages, what they need from you is not a greeting. They need a reason to keep going.
  </p>
  <p>
  I am not the first person to say this. There are tweets about it. There are TikToks. There are dating coaches in fluorescent ring lights who have been saying for five years that "hey" does not work. And yet I still see the folder fill up, every week, with new screenshots.
  </p>
  <p>
  So I want to actually look at why this is.
  </p>

  <h2>What "hey" does in the receiver's brain</h2>
  <p>
  When a stranger sends you a single-word message, your brain does a tiny piece of math. It compares the effort they put in to the effort it would take you to reply. "Hey" is roughly four keystrokes of effort. A real reply, the kind that builds anything, is probably two to four sentences. That is a 20x effort imbalance and the receiver feels it immediately, even if they do not name it.
  </p>
  <p>
  So they triage. The hottest 10% of profiles get a "hey" reply back, because the receiver wants to keep the door open and is willing to absorb the cost. Everyone else gets nothing. The math is brutal and almost entirely invisible to the sender.
  </p>

  <h2>The opener does not need to be clever</h2>
  <p>
  The biggest mistake people make when they finally give up on "hey" is to swing to the other extreme. They write an opener that is structurally a small essay. Three sentences. A joke. A compliment. A question. By the end of it the receiver feels like they have been pitched, which is its own kind of off-putting.
  </p>
  <p>
  The opener that consistently outperforms both poles is short, specific, and tied to one thing in the other person's profile. One observation, one question, done.
  </p>
  <blockquote>"That photo of you with the dog at the lake is excellent. Whose lake?"</blockquote>
  <p>
  That is twelve words. It does three things at once. It tells them you actually looked. It compliments without being weird about appearance. And it asks a question that requires four words to answer but invites more.
  </p>

  <h2>Specificity is the entire trick</h2>
  <p>
  Here is the test I run on every opener. Could this same opener have been sent to anyone else on the app, with nothing changed? If the answer is yes, the opener is dead on arrival. It does not matter how warm it sounds or how confident it reads. It is generic, and generic gets the same brain math as "hey."
  </p>
  <p>
  Compare "Your profile is amazing" with "You said your favourite restaurant in Sydney is Continental Deli and I have made two of my friends move there for the wine specifically. Are you a wine person or did you go for something else."
  </p>
  <p>
  The first one could be sent to literally every woman on Hinge. The second one could only be sent to her. The cost of writing the second one is maybe thirty seconds of actually reading her profile. The lift in reply rate, in my experience helping people draft these, is somewhere between 3x and 8x depending on how good the underlying profile is.
  </p>

  <h2>What about when they have nothing in their profile</h2>
  <p>
  Sometimes the receiver has a sparse profile. Three photos, no prompts, a one-line bio. The temptation here is to just send "hey" because what else are you supposed to grab onto. The move is not to grab onto content. The move is to grab onto the absence of content.
  </p>
  <blockquote>"Your profile is the most efficiently empty profile I have seen this week. Are you on here on a dare or genuinely trying."</blockquote>
  <p>
  It is dry. It is specific to what you actually noticed. It gives them something to defend or laugh about. The reply rate on lines like this is genuinely surprising the first time you watch it work. The receiver is not stupid. They know their profile is thin. The thing they do not get from anyone is honesty about it.
  </p>

  <h2>"Hey" is not the disease. It is the symptom.</h2>
  <p>
  People who default to "hey" are usually not lazy. They are usually anxious. They have been ghosted before. They have written long, careful openers that got nothing back. So they have rationally reduced their effort to match the expected payoff, which is zero.
  </p>
  <p>
  The fix is not to bully yourself into writing better openers from the place of anxiety. The fix is to lower the stakes of any single opener. Send three a night. Send observations, not pitches. If one in five gets a reply, you are doing better than the median user on every major app.
  </p>
  <p>
  If you treat openers like art pieces you have to nail every time, you will keep falling back to "hey," because "hey" is the only line that costs nothing when it fails.
  </p>

  <h2>What I would actually do this week</h2>
  <p>
  Open your top three matches that have not replied to your "hey" in the last week. Do not double text "hey hey" or send a follow-up about whether they are still there. Both of those are worse than the original "hey."
  </p>
  <p>
  Instead, open their profile again. Find one specific thing. Send a new message that grabs that thing and asks one short question about it. Do not reference the previous "hey" at all. Pretend it never happened.
  </p>
  <p>
  Half of those will still go nowhere. That is fine. The other half will surprise you, because the receiver had also forgotten about the original "hey," and what they are actually responding to is the new message arriving like it was written by a person who saw them.
  </p>
  <p>
  That is the entire move. Stop greeting strangers. Start noticing them out loud.
  </p>
  </>
  ),

  "reply-rhythm-and-when-silence-means-something": (
  <>
  <p>
  I want to talk about the gap between messages. Not the messages themselves. The pause. The thing that happens in the white space between when you sent yours and when theirs arrives, or doesn't.
  </p>
  <p>
  I have spent a lot of time on this, partly because the people I help draft messages are usually more anxious about reply rhythm than about the messages themselves. They want to know what it means that he took four hours, or what it means that she replied in twelve seconds and then went quiet for two days, or whether they should match the other person's cadence on purpose.
  </p>
  <p>
  Most of the advice on this topic is wrong, in opposite directions. So I want to lay out what I actually believe after looking at a lot of threads.
  </p>

  <h2>Cadence is not a code</h2>
  <p>
  The dominant narrative online is that response time is a signal. Fast means interested. Slow means cooling off. Match their pace or look needy. There are entire TikTok subcultures built around the idea that the person who waits longer wins.
  </p>
  <p>
  This is mostly nonsense. It treats messaging like poker, where every move is a tell. In real life, a four-hour gap on a Tuesday afternoon usually means the person had a meeting. A nine-hour gap overnight usually means they were asleep. A two-day gap on a weekend usually means they had a weekend. The base rate of "I was busy" is extremely high and people consistently underestimate it.
  </p>
  <p>
  What is true is that across the whole arc of a conversation, the rhythm tells you something. Not from any single gap. From the pattern.
  </p>

  <h2>The patterns that actually mean something</h2>
  <p>
  If you watch the cadence over a week, three patterns reliably mean something.
  </p>
  <p>
  The first is symmetrical decay. Both of you are replying slower than you were on day one. The messages are still warm. The gaps are just longer. This usually means the conversation has hit a natural ceiling and it needs to move to a phone call or a plan, or it will quietly evaporate. Neither of you is doing anything wrong. Threads have lifespans and you are at the end of one.
  </p>
  <p>
  The second is asymmetrical decay. You are replying within an hour and they are replying the next morning, every time, for four days in a row. This one does mean something. It means they are interested enough to keep responding but not interested enough to prioritize. The polite version of this is "they are juggling and you are not the top of the queue." The honest version is to ask them to make a plan, and if they hedge, save your energy.
  </p>
  <p>
  The third is the dead drop. They were replying within minutes. Then nothing. For sixteen hours, twenty four, forty eight. This one feels like the worst but it is actually the cleanest. Either they got busy and will come back with an explanation, or they got distracted and will come back without one, or they faded. The thing not to do is to fill the silence with three follow-up messages. That converts a possibly-recoverable thread into a definitely-dead one.
  </p>

  <h2>Why people send the second message too fast</h2>
  <p>
  The single most common thing I watch people do is reply within ninety seconds of getting a message. They were waiting. They had the phone face up. They saw the notification, opened it, typed back instantly.
  </p>
  <p>
  This is fine in long-running relationships where the cadence is already established. In the first two weeks of talking to a stranger, it does one thing, which is to slowly recalibrate the other person's expectation of your availability. They learn that you are always there. Then when you are not there, for a perfectly normal reason, it reads louder than it should.
  </p>
  <p>
  I am not telling you to play hard to get. I am telling you that batching your replies, even just twice a day for the first week, protects you from a dynamic where your silence becomes information.
  </p>

  <h2>The double text rules everyone gets wrong</h2>
  <p>
  There is a piece of internet wisdom that you should never double text. This is wrong. Double texting is fine. The actual rule is that the second text needs to add value, not request validation.
  </p>
  <p>
  A double text that adds value: "Just saw a guy on the train wearing the exact shirt from your fourth photo. Either you have a twin or that shirt is in heavy circulation in Newtown." That is a gift. They get to laugh. They get to reply or not.
  </p>
  <p>
  A double text that requests validation: "Hey, did you see my last message?" or "Just checking you didn't ghost me lol." Both of these put the receiver in a position where their next move has to be defense or apology, which is never a good frame for what comes after.
  </p>
  <p>
  If you have a thing to say, say it. If you are just looking for reassurance, send it to a friend, not to them.
  </p>

  <h2>When silence actually means something</h2>
  <p>
  In my experience, silence past about seventy-two hours, with no explanation when they come back, is the signal. Not the four hours. Not the overnight gap. The three-day no-reply followed by them surfacing again with no acknowledgement of the gap.
  </p>
  <p>
  That is a person telling you, gently, that you are not the priority and they would rather you stop expecting them to be. Sometimes you can have a perfectly nice text relationship with that person. You will probably never have a relationship of any other shape.
  </p>
  <p>
  The error I watch people make is to read the surface message and ignore the silence. He sent a "hey how was your weekend" after disappearing for four days, so things must be back on track. They are not back on track. They are on his terms now, and his terms are intermittent.
  </p>

  <h2>The honest move</h2>
  <p>
  If you find yourself watching the timestamp on your phone and doing math about whether two hours is too long to wait before replying, that is the actual signal. Not about them. About you.
  </p>
  <p>
  That much vigilance is exhausting and almost always a sign that the thread is not giving you what you want, regardless of cadence. The fix is rarely to play the cadence game better. The fix is usually to ask for a plan, or to start a thread with someone who does not require this much math.
  </p>
  <p>
  Reply rhythm is real. It tells you something. But the thing it usually tells you is not what they are doing. It is what you are doing.
  </p>
  </>
  ),

  "how-to-rescue-a-dead-thread": (
  <>
  <p>
  Dead threads. We all have them. A conversation that started well, went somewhere interesting for a day or two, and then went quiet. Maybe you sent the last message. Maybe they did. Either way, three weeks have passed and the thread is sitting there in your inbox like a piece of unfinished homework.
  </p>
  <p>
  The instinct most people have is to either pretend it never happened and ghost back, or to send a "hey stranger" message that performs casualness while signalling slight resentment. Both of these are bad. There is a better move, and it works more often than you would think.
  </p>

  <h2>Why threads die in the first place</h2>
  <p>
  Before you can rescue one, you need to know how they die. There are three common deaths.
  </p>
  <p>
  The natural fade. The conversation hit a topic ceiling. You ran out of obvious things to say. Both of you got distracted by life. Neither of you was less interested. The thread just lost momentum.
  </p>
  <p>
  The mismatched signal. One of you tried to escalate (asked to meet, asked for a number, suggested a call) and the other one was not ready, so they got vague, and the vagueness made the first person retreat. Now you are both in stalemate, waiting for the other one to do something.
  </p>
  <p>
  The actual disinterest. They were never that into it and were politely letting it taper. This is the death you cannot rescue and you should learn to spot it quickly so you stop wasting energy.
  </p>
  <p>
  The first two are recoverable. The third one is not. The difference is mostly about what their last message looked like. If their last message was warm and just trailed off, it was probably a fade. If their last message was a polite one-word answer to a question you asked, it was probably actual disinterest.
  </p>

  <h2>The rescue move</h2>
  <p>
  The thing that consistently rescues a dead thread is what I think of as the low-stakes specific re-entry. You come back with something concrete, something that does not reference the silence, and something that does not put any pressure on them to explain themselves.
  </p>
  <p>
  The structure is roughly: a thing that just happened, in your actual life, that reminded you of them. Specific enough that it could only have reminded you of them. With a question that takes ten seconds to answer.
  </p>
  <p>
  Example. Three weeks of silence. Their last message had mentioned they were really into a particular Korean fried chicken place in Surry Hills. Your re-entry:
  </p>
  <blockquote>"Walked past Gami last night and remembered you said the cheese version is the move. Did I dream that or do I owe you a try."</blockquote>
  <p>
  That is twenty-one words. It does not say "hey, sorry for the silence." It does not say "thought I'd check in." It does not explain itself. It just lands like a person who remembered.
  </p>
  <p>
  The reply rate on these, in my experience, is genuinely surprising. Conversations I had given up for dead come back within six hours.
  </p>

  <h2>Why this works</h2>
  <p>
  Two things are happening in the receiver's brain when this message arrives.
  </p>
  <p>
  The first is relief. They were sitting on a small social debt to you and now you have removed it without making them apologize. That is a gift.
  </p>
  <p>
  The second is recognition. You remembered a specific thing they said three weeks ago. Almost no one does that. The mere fact that you did says more about you than any clever opener could.
  </p>

  <h2>What not to do</h2>
  <p>
  A short list of moves that kill any chance of rescue.
  </p>
  <p>
  The guilt re-entry: "Long time no talk, hope you didn't forget about me." This is a small accusation in a friendly font. They will read it as one.
  </p>
  <p>
  The reset re-entry: "Hey, I know it's been a while, life has been crazy, but I'd love to catch up." This is a tiny essay about you that requires them to respond with their own tiny essay about why they were also busy. Nobody wants this.
  </p>
  <p>
  The pity re-entry: "Last try, I promise." Now you have given them a graceful exit and most people will take it.
  </p>
  <p>
  The clean-slate re-entry: "Starting over. Hi, I'm Tom." Cute in theory. Reads as anxious in practice.
  </p>
  <p>
  All of these draw attention to the silence. The silence is exactly the thing you do not want to draw attention to. Re-entry works when it feels like a natural continuation of a conversation that never really stopped, not like a rescue mission.
  </p>

  <h2>When to not even try</h2>
  <p>
  If their last message was a polite one-liner that closed a question without opening anything new, leave it. Examples: "Haha yeah", "True", "Same here". These are graceful end-of-conversation signals. Trying to rescue them just confirms you did not read the room.
  </p>
  <p>
  If you sent the last two messages and got nothing back, do not send a third. The thread is asking you to stop.
  </p>
  <p>
  If they have posted a new prompt or photo on their profile since the last message and still have not responded, they have actively chosen not to reply while being active on the app. This is not a fade. This is information.
  </p>

  <h2>The longest gap I have seen recover</h2>
  <p>
  A friend of mine had a thread go dark for nine weeks. He had given up. He went on three other dates in the meantime. Then he was at a wedding and saw someone wearing the exact pattern of socks that this person had mentioned, in passing, as a joke about her dad. He sent a photo of the socks with the message "your dad's wedding twin spotted in Newtown."
  </p>
  <p>
  She replied in seven minutes. They went out the next weekend. They are still together.
  </p>
  <p>
  I am not saying every dead thread is recoverable. Most are not. But the rescue move costs you almost nothing and works often enough that it is worth the swing, especially on threads that started with real promise.
  </p>
  <p>
  The rule is the same as the rule for the original opener. Notice something specific. Say it out loud. Ask a small question. The fact that you waited three weeks is a non-issue if your re-entry sounds like a person, not like an apology.
  </p>
  </>
  ),

  "when-to-ask-them-out": (
  <>
  <p>
  The question I get most, by a wide margin, is when to ask someone out. People want a rule. Three days. Twenty messages. Two days of consistent conversation. Some sort of timer that, when it goes off, gives them permission.
  </p>
  <p>
  The honest answer is that there is no timer. There is a moment. And the people who consistently move from text to date are people who have trained themselves to feel that moment instead of counting.
  </p>
  <p>
  But because "feel the moment" is not a usable answer, let me try to be more specific.
  </p>

  <h2>The cost of waiting too long</h2>
  <p>
  The mistake people make most often is waiting too long. The conversation goes well. Then it goes well for another day. Then another. Then another. And by day six, both of you have used up the easy material, the energy is starting to flatten, and there is now a tiny dread in the receiver's stomach every time your name comes up, because they know the date question is coming and the conversation has gone on so long that the date now has to live up to a week of expectation.
  </p>
  <p>
  I have watched this happen many times. The thread starts strong, peaks around day three or four, and then dies in the gap between "we should hang out sometime" and an actual plan. The window for asking was day three. By day six you have missed it and you do not get a second one.
  </p>

  <h2>The cost of asking too early</h2>
  <p>
  The other failure mode, less common but real, is asking too early. You match Tuesday at 9pm. You send two messages back and forth. You ask her out at 11pm. She has not even decided yet whether she finds you interesting and you have made her decide whether to spend her Saturday night on you.
  </p>
  <p>
  The bar for "yes" goes up. She gets cautious. The conversation that should have built rapport collapses into a planning conversation she did not want to have yet.
  </p>
  <p>
  The frame I use is that you are not asking permission to meet. You are extending a natural next step from a conversation that has already become interesting. If the conversation has not gotten interesting yet, the ask is premature.
  </p>

  <h2>The actual signal that it is time</h2>
  <p>
  The moment is usually a specific kind of message they send, not a number of days that have passed.
  </p>
  <p>
  The most reliable signal: they reference something specific you would do together. "You'd love this place." "Have you been to that bar." "I'm trying to find someone to go to this gig with." These are open doors. They are inviting you to walk through.
  </p>
  <p>
  The second most reliable signal: they ask you a question that only makes sense if they are picturing meeting you. "Are you actually as tall as your photos suggest." "Do you have a weekend regular or are you more spontaneous." These questions are them building the mental model of what hanging out would be like.
  </p>
  <p>
  The third signal: the conversation has a natural rhythm and both of you are clearly enjoying it, but you are starting to repeat yourselves. This is the conversation telling you it has done its job and the next phase needs to be in person.
  </p>
  <p>
  If any of these are happening, the moment is now. Not tomorrow. Not after one more day. Now.
  </p>

  <h2>How to actually ask</h2>
  <p>
  The most important thing is to not pose it as a question that requires a yes or no.
  </p>
  <p>
  "Would you want to maybe grab a drink sometime" is the worst version. It is vague. It is hedged. It puts the entire weight of the decision on her and gives her no useful information.
  </p>
  <p>
  "There is a wine bar on Crown St I have been wanting to try. Are you free Thursday or Saturday." is the right structure. You have done the work. You have proposed a thing. You have given her two options. She can say yes to one, or counter with a different day, or say no. All of those are easy for her to do.
  </p>
  <p>
  The hidden cost of vague asks is that they make the other person do the work of planning the date in their head before they even agree to it. Most people will not bother. They will say "yeah let's do that sometime" and that "sometime" will never come.
  </p>

  <h2>When she is busy vs when she is dodging</h2>
  <p>
  A common confusion. She said yes she wants to go out but cannot do Thursday or Saturday. How do you read this.
  </p>
  <p>
  If she counters with a specific other day, she is in. Plan it.
  </p>
  <p>
  If she says "I'm slammed this week, can we sort something next week" with no specific day, she is probably in but you should take her at her word and not push. Wait three days, then come back with one specific suggestion for the following week.
  </p>
  <p>
  If she says "let me check my schedule and get back to you," she is not in. She might be, in some other timeline, but right now she is not. Do not chase. If she comes back, treat it like a fresh ask. If she does not, that was your answer.
  </p>

  <h2>The thing I had to learn the hard way</h2>
  <p>
  For a long time I treated the ask as the hardest part of the conversation. I would build up to it. I would over-rehearse it. I would send it after seven careful drafts.
  </p>
  <p>
  The actual hardest part is the conversation before the ask. If the conversation is good, the ask is a tiny administrative step. If the conversation is mediocre, no version of the ask will save it.
  </p>
  <p>
  So the move, mostly, is to stop optimizing the ask and start paying attention to whether the conversation has earned the ask. If it has, almost any version of "hey, want to grab a drink Thursday" will work. If it has not, no perfect script will rescue it.
  </p>

  <h2>A simple test</h2>
  <p>
  Read your last three messages back to back. If you, as an outside observer reading the thread, would think "these two should clearly meet up," it is time to ask. If you would think "these two are still figuring out whether they like each other," it is not.
  </p>
  <p>
  That is the entire signal. Trust it. The window does not stay open forever.
  </p>
  </>
  ),

  "voice-notes-are-a-cheat-code": (
  <>
  <p>
  I will admit something. For two years I was the person who, when someone sent me a voice note on a dating app, would visibly recoil. I would let it sit unplayed for hours. I had a small theory that voice notes were performative, that they were a way to dodge the actual work of writing a clean sentence, and that anyone who sent them was probably also the kind of person who insisted on FaceTime before meeting.
  </p>
  <p>
  I was wrong. Or, more precisely, I was right about a specific kind of voice note and wrong about the form in general. Done well, a voice note is one of the most efficient moves you can make on a dating app. Done badly, it confirms every fear the receiver has about voice notes.
  </p>
  <p>
  So I want to be specific about the difference.
  </p>

  <h2>What voice notes actually do that text cannot</h2>
  <p>
  A text message communicates words. A voice note communicates words, tone, pace, accent, energy, breath, what your laugh sounds like, and whether you are someone the receiver might enjoy actually being around. That is an enormous amount of information for a thirty-second clip.
  </p>
  <p>
  The reason this matters is that the gap between "this person seems great in text" and "I'd want to spend a Saturday night with this person" is exactly the gap that voice fills. Text can be polished and rehearsed. Voice cannot. The receiver hears whether you actually sound like a relaxed adult or whether you sound like someone who is performing being one.
  </p>
  <p>
  This is why a good voice note often pulls the conversation forward faster than a week of texts. The receiver gets the answer to the question they were going to wait until the first date to answer.
  </p>

  <h2>The voice notes that work</h2>
  <p>
  Three structural patterns I see consistently work.
  </p>
  <p>
  The first is the answer voice note. They asked you a question that was hard to answer in text. Instead of typing five paragraphs, you record forty-five seconds. It feels natural, it gives them your actual thought process, and it ends with you asking them something back. The whole thing took you under a minute and gave them more information than ten text messages would have.
  </p>
  <p>
  The second is the in-the-moment voice note. You are walking somewhere. You just saw something that reminded you of the conversation. You record fifteen seconds of you describing what you just saw, with the ambient sound of the street in the background. This works because it shows them a real moment of your day, which is intimate in a way that a typed message cannot be.
  </p>
  <p>
  The third is the laugh voice note. They sent something funny. Instead of typing "haha," you record yourself actually laughing and then saying one sentence. Your laugh is a piece of information about you. They will remember it. Typed laughs are forgettable.
  </p>

  <h2>The voice notes that do not work</h2>
  <p>
  Three patterns I see consistently fail.
  </p>
  <p>
  The introductory voice note. First message in the thread, three minutes long, you explaining who you are. This is too much. The receiver has not earned the audio commitment yet and the volume of your voice without context lands as pushy.
  </p>
  <p>
  The monologue. Anything over ninety seconds. Even if the content is great, you have asked the receiver to give you their undivided attention for a length of time they did not consent to. They will skip ahead. They will not catch the punchline. They will feel a low-grade obligation to write a long response.
  </p>
  <p>
  The performative voice note. The one where you can hear that you are trying. You are using your radio voice. You have rehearsed. The receiver hears all of this. The thing voice is good at is conveying actual personality. The moment you fake it, you waste the entire advantage of the medium.
  </p>

  <h2>When to send the first one</h2>
  <p>
  The rule of thumb I use, and recommend, is to wait until they have asked you a question that genuinely benefits from a voice answer. Then send the voice note as the answer. This solves the consent problem because they asked.
  </p>
  <p>
  "What's the actual story with the photo of you and the goose" is a question that wants a voice note. "Where are you from" is a question that wants a text answer.
  </p>
  <p>
  You can usually tell the difference because one of them is a setup for a story and the other one is a setup for a one-line fact.
  </p>

  <h2>The accent thing</h2>
  <p>
  People who are self-conscious about their voice or accent often resist voice notes because they think their accent is a liability. In my experience this is almost always wrong. Your accent is information. The receiver gets to decide whether they like it. Most of the time, on dating apps, the receiver has already seen photos and read enough to have made some prior decision, and the voice is just confirmation either way.
  </p>
  <p>
  The thing that does not work is putting on a voice that is not yours. People can hear it, even on a short clip, and it reads as inauthentic in a way that no amount of perfect text grammar can recover from.
  </p>

  <h2>The format that almost always works</h2>
  <p>
  If you have never sent a voice note on a dating app and want to start, here is the format with the highest hit rate.
  </p>
  <p>
  A question they asked, that requires a short story. You answer it in thirty to forty-five seconds. You end with a question back to them. You do not rehearse. You record once. You send it. If you mess up a word, leave it.
  </p>
  <p>
  The fact that you do not rehearse is doing more work than the content. They can hear that you were comfortable enough to just send the take.
  </p>

  <h2>What I tell people who say "but I hate my voice"</h2>
  <p>
  Everyone hates their voice. This is a well-known fact about recorded audio. The first time you hear yourself you sound like a stranger to yourself. Other people do not hear what you hear. They hear what they have been hearing in your photos and your texts, just with the extra dimension of how you actually sound.
  </p>
  <p>
  If you cannot get past the voice-hating, send one anyway. The one you send will be fine. The hundred you do not send because you are too self-conscious to start are the actual cost.
  </p>
  <p>
  The medium is a cheat code if you use it sparingly and well. Use it like a spice, not a base.
  </p>
  </>
  ),

  "the-question-that-actually-tells-you-something": (
  <>
  <p>
  Most questions on dating apps are filler. "What do you do?" "Where are you from?" "What are you doing this weekend?" These questions are not bad, exactly. They are just airline-magazine small talk that fills space without telling either of you anything you did not already know from the profile.
  </p>
  <p>
  I want to talk about the other category of questions. The ones that, in two sentences, give you more information about the other person than a week of small talk would. They are not magic. They are just better designed.
  </p>

  <h2>What a useful question does</h2>
  <p>
  A useful question has three properties. It cannot be answered with a fact. It requires the other person to make a choice or notice something about themselves. And the answer reveals something about how they think, not just what they have done.
  </p>
  <p>
  "Where are you from" fails all three. The answer is a fact. There is no choice to make. And the answer tells you nothing about how they think.
  </p>
  <p>
  "What is the most overrated thing in your hometown" passes all three. It cannot be answered without a small judgment. They have to choose. And whatever they pick tells you what they notice and what irritates them, which is much more useful information than the name of the town.
  </p>

  <h2>A short list of questions that consistently produce real conversation</h2>
  <p>
  These are not gotcha questions. They are not trick questions. They are just questions designed to give the other person something interesting to chew on.
  </p>
  <p>
  "What is something everyone in your industry pretends to enjoy but actually finds boring." This produces honest answers from people who work in any field with a culture. They often have very specific complaints they have never gotten to voice. They will remember that you asked.
  </p>
  <p>
  "What is a small luxury you justify even though it is not very justifiable." This invites them to describe one of the things they actually love, in a slightly self-aware way. The answer always tells you something about their values and their sense of humour.
  </p>
  <p>
  "What do your parents think you do for a living, and how wrong are they." This is great for people who have non-traditional careers. It also reveals their relationship with their parents in passing.
  </p>
  <p>
  "What is the worst piece of advice you keep getting." This taps into something they have actively thought about. The answer is usually specific and slightly funny.
  </p>
  <p>
  I am not saying memorize these and deploy them. I am saying notice the shape. A useful question gives the other person an interesting thing to think about that they have probably not been asked before.
  </p>

  <h2>Why "what do you do for fun" is a dead question</h2>
  <p>
  The reason "what do you do for fun" almost always produces a boring answer is that the question itself is boring. The person on the other end answers with the same three things they have listed on their profile. Read books, go to the gym, see friends. You have learned nothing.
  </p>
  <p>
  A better version of the same question: "what is something you have been quietly obsessed with this month." This is structurally a much better question because it is time-bound (this month) and tone-bound (quietly obsessed). They have to actually think. The answer might be a TV show, a recipe, a person they cannot stop thinking about, a small project. Whatever it is will tell you something specific.
  </p>

  <h2>The question I ask on every first date</h2>
  <p>
  The one I have stolen and used dozens of times: "What is something you used to be really into that you have somehow stopped doing, and you do not know why."
  </p>
  <p>
  This question lands every single time. People give surprisingly vulnerable answers. They had a band in college. They used to write. They used to skateboard. They used to call their grandmother every Sunday. The answer always reveals a small grief, and the conversation that follows is always more honest than the one before it.
  </p>
  <p>
  I am not saying you should send this one on a dating app cold. It is too heavy for a third message. But on a first date, twenty minutes in, after a glass of wine, it is a key that opens the door from small talk to real conversation.
  </p>

  <h2>The questions to avoid</h2>
  <p>
  Three categories of questions consistently fail.
  </p>
  <p>
  Big philosophical questions in early messages. "What is your love language" or "what are you looking for on here" lands as too much, too soon. The receiver has not given consent to that level of self-disclosure yet and the question reads as an interrogation.
  </p>
  <p>
  Past relationship questions. Anything that asks about their last relationship, their ex, their dating history, in the first week. This is information the receiver controls and gets to share when they choose. Asking too early signals that you are using the conversation to triage for risk rather than to actually meet the person.
  </p>
  <p>
  Questions you do not actually want the answer to. Sometimes people ask questions out of politeness, with no interest in the answer. The other person can usually tell. If you do not actually care about their favourite season, do not ask.
  </p>

  <h2>The reciprocity bit</h2>
  <p>
  A useful question is doing twice the work if you also answer it yourself. The structure is: ask, get their answer, give yours. Skipping the "give yours" step makes the conversation feel like an interview. Skipping the "ask" step makes it a monologue.
  </p>
  <p>
  The version of you that is good at this on a date is the version of you that asks a real question, listens to the answer, and then offers your own answer to the same question without being prompted. Three exchanges of this and the conversation has become a real one.
  </p>

  <h2>What this all adds up to</h2>
  <p>
  The shift you want to make, both in texting and in person, is from questions that collect facts to questions that produce thinking. The fact-collection questions are fine for the first thirty seconds of meeting someone. After that, they are filler that wastes the limited attention you have with each other.
  </p>
  <p>
  A better question costs you nothing. You can ask it instead of the boring one. The other person will tell you something that matters. You will remember it. The conversation will have texture that the next ten conversations they have, with other people, will not have. That texture is most of what they will use to decide whether they want to see you again.
  </p>
  </>
  ),

  "wyd-and-other-conversational-dead-ends": (
  <>
  <p>
  There are a small number of messages that, when you send them, are almost guaranteed to either kill a conversation or to drag it into a flat plain where nothing interesting happens. I want to make a list, because some of these are not obviously bad and people send them constantly.
  </p>
  <p>
  The patron saint of the list is "wyd." Three letters that contain almost no information, ask the receiver to summarize their entire existence, and signal a low-effort kind of attention. I have never seen "wyd" produce a good thread. Not once. And yet it remains, on every app, the most common late-night message sent.
  </p>

  <h2>Why "wyd" fails</h2>
  <p>
  "wyd" forces the receiver into one of three answers. They can lie ("just chilling"). They can describe something boring ("just got home from the gym"). Or they can refuse to engage ("nothing much, you?"). None of these answers go anywhere.
  </p>
  <p>
  Compare it to "what does your Tuesday night usually look like." Same energy. Same approximate topic. Vastly different invitation. The second version gives them something to actually describe and signals that you are interested in the texture of their week, not just their immediate availability.
  </p>

  <h2>The other dead ends</h2>
  <p>
  A short tour of the messages that consistently kill conversations.
  </p>
  <p>
  "How was your day?" Generic. The honest answer is almost always "fine" and the honest follow-up is almost always nothing. If you actually want to know about their day, ask about a specific part of it. "How did that thing on Wednesday go" tells them you remembered. "How was your day" tells them you were searching for something to say.
  </p>
  <p>
  "Tell me about yourself." The receiver has to choose what to share with no context. Half of them will give a tiny version of their resume. Most of them will not bother. This question is structurally an interview question and lands as one.
  </p>
  <p>
  "What are you up to this weekend?" In isolation, this is fine. The problem is when it is used as filler instead of as a setup to make a plan. If you are not going to follow it up with a suggestion, do not ask.
  </p>
  <p>
  "How was your weekend?" Same problem as "how was your day." Generic, requires the receiver to summarize, almost never produces more than two sentences of follow-up. Replaceable with any specific question about a part of the weekend you actually have reason to ask about.
  </p>
  <p>
  "Sup." See "hey." Same disease, different decade.
  </p>
  <p>
  "You up?" The receiver knows what this is. There is a time and place for this message and it is week three with a person you have already slept with. Not week one. Not ever, really, on a first thread.
  </p>
  <p>
  "Where you at?" If they have not given you their address yet, this is presumptuous. If they have, why are you texting it instead of meeting them.
  </p>

  <h2>The pattern under the pattern</h2>
  <p>
  All of these messages have the same structural failure. They put the work of finding something interesting to say onto the receiver, while giving them nothing to grab onto. The receiver, on the other end, is now in the position of having to be the entertaining one, the specific one, the person who turns the message into a conversation.
  </p>
  <p>
  Some of them will rise to it, the first few times. Almost none of them will do it twice. By the second "wyd," they have decided that talking to you is going to be effortful in a one-sided way, and they will stop responding.
  </p>

  <h2>The fix is not to write essays</h2>
  <p>
  The fix for dead-end messages is not to swing to the other extreme and write three-paragraph messages with multiple questions and a setup. That has its own failure mode, which is overwhelming the receiver.
  </p>
  <p>
  The fix is to send messages that contain a specific piece of information from your day or a specific reference to their last message, with a small open question attached.
  </p>
  <p>
  Instead of "wyd": "Just got out of a meeting that should have been one email, kind of want to get a beer, what does your Tuesday actually look like."
  </p>
  <p>
  Instead of "how was your day": "I made an actual lasagna last night for the first time and I have a strange amount of pride about it. How was yours."
  </p>
  <p>
  Instead of "tell me about yourself": "I keep meaning to ask, what was the actual story with the photo at the lake."
  </p>
  <p>
  Each of these costs you maybe twenty seconds of thought. The reply rate, compared to the dead-end versions, is dramatically higher.
  </p>

  <h2>The "good morning" trap</h2>
  <p>
  A separate category of message that deserves its own warning: the daily "good morning" text. People send these thinking they are warm and consistent. The receiver, especially in the first two weeks, reads them as a small daily obligation. There is now an expectation that they must reply with their own "good morning" message, and the days they forget will produce a tiny static of guilt.
  </p>
  <p>
  If you want to text in the morning, send something specific. The dream you just had. The thing the coffee shop person said. The fact that you saw a dog in a tiny coat on the way to the train. "Good morning" by itself is wallpaper, and wallpaper does not earn replies.
  </p>

  <h2>What the conversation actually wants from you</h2>
  <p>
  In every thread, the receiver is doing a small ongoing calculation. They are weighing what it costs them to reply versus what they get back from replying. Dead-end messages tilt this calculation against them every time. Specific, slightly observed messages tilt it in their favour.
  </p>
  <p>
  You do not need to be clever. You do not need to be impressive. You just need to send messages that are not wallpaper. The bar is low and most people fail it because they are doing what is easy on autopilot.
  </p>
  <p>
  The single move that fixes most threads is to read your own last message back, ask "could this have been sent to anyone," and if the answer is yes, do not send it. Send the next thought instead. The one with something specific in it.
  </p>
  </>
  ),

  "small-talk-to-real-talk-in-three-moves": (
  <>
  <p>
  Every conversation on a dating app starts as small talk. The question is whether it stays there. The threads that turn into dates, and the dates that turn into something more, are almost always the ones where, at some specific point, the conversation moved from the surface to a layer below. From small talk to real talk.
  </p>
  <p>
  This shift is not random. There is a fairly reliable three-move sequence that does it. I have used it many times. I have watched other people use it. It works often enough that I want to write it down.
  </p>

  <h2>Move one: the specific noticing</h2>
  <p>
  The first move is to notice something about their last message that they probably did not realize they were giving you. Not a fact. A texture. The way they phrased something. The thing they implied without saying. The detail that landed sideways.
  </p>
  <p>
  Example. They said "I just got back from a wedding in Newcastle and I am exhausted." A small-talk reply is "oh nice, how was it." A real-talk reply notices the texture: "Whose wedding makes you exhausted in a good way and whose makes you exhausted in a bad way. That sentence could go either direction."
  </p>
  <p>
  You have just told them that you read their message carefully and that you have an ear for what they are not quite saying. This is the move that signals to them that the conversation is going to be different from the other ones in their inbox.
  </p>

  <h2>Move two: the trade</h2>
  <p>
  Once the texture is in the air, the second move is to trade. You make a small specific disclosure of your own, in the same key. Not a big one. Not a confession. Just enough to signal that you are willing to play at this level too.
  </p>
  <p>
  If they said the wedding was draining because their family was there, you might say "the last family wedding I went to I left two hours in and sat in my car for twenty minutes deciding whether to go back. I went back. I wish I had not." That is a real thing. It is specific. It admits something small without making it the focal point.
  </p>
  <p>
  This is the move most people skip. They want the other person to keep disclosing without giving anything back. That asymmetry kills the real-talk frame within two messages. The other person notices they are doing all the volunteering, and they will retreat.
  </p>
  <p>
  A trade is not the same as a competition. You are not topping their disclosure. You are matching it, in tone and in size. If they say something light and slightly vulnerable, you say something light and slightly vulnerable. If they go a bit deeper, you can too.
  </p>

  <h2>Move three: the soft question</h2>
  <p>
  The third move is the question that asks them to go one click further, but gives them an easy out if they do not want to.
  </p>
  <p>
  The structure is: "If it is not too weird to ask," or "tell me as much or as little as you want," followed by a question that follows naturally from what you just traded.
  </p>
  <p>
  "If it is not too weird to ask, was the going back the right call or do you wish you had stayed in the car." That question is doing several things at once. It mirrors the structure of their original disclosure. It gives them permission to either go shallow or deeper. It does not demand a particular answer.
  </p>
  <p>
  The opt-out matters. Without it, the question reads as pushing. With it, the question reads as caring whether they want to push themselves.
  </p>

  <h2>The shape that emerges</h2>
  <p>
  These three moves, in sequence, look like a small ladder. Notice, trade, soft question. Each step is just a tiny bit further into the territory than the last one. By the time you have done all three, the conversation is in a completely different place than it was four messages ago.
  </p>
  <p>
  This is not therapy. It is not interrogation. It is the structure of how good friends actually talk. They notice. They share. They ask. They do this almost without thinking, because they have been doing it for years.
  </p>
  <p>
  On a dating app, with a stranger, you have to do it more on purpose because you do not have the years of accumulated trust. But the moves are the same.
  </p>

  <h2>When the move fails</h2>
  <p>
  Sometimes you will run the sequence and the other person will not engage. They will deflect. They will joke. They will go back to small talk. This is not always a bad sign. Some people need three or four passes of this kind of message before they trust that you are not a weirdo.
  </p>
  <p>
  The wrong response, when they deflect, is to push harder. The right response is to back off, return to slightly lighter territory, and try again two days later. Real-talk is something they have to choose. You can offer the door. You cannot drag them through it.
  </p>
  <p>
  If they consistently deflect across multiple attempts, that is information. They might be a person who is great over coffee but does not do depth in text. Or they might be a person who does not do depth at all. The first one is fine and you can meet them. The second one is something you will want to know early.
  </p>

  <h2>Why this works on apps in particular</h2>
  <p>
  The bar for any given message on a dating app is very low because the median message is so bland. The first message that has any texture at all gets a disproportionate amount of attention. The first message that goes one layer below the surface, and does it gracefully, often gets remembered by the receiver as the moment the conversation actually started.
  </p>
  <p>
  I have had a number of people tell me, weeks into a relationship, that they remember the exact message where they first thought "oh, this person might be different." It is almost always a message that ran some version of the noticing-trading-asking sequence.
  </p>
  <p>
  You do not need to be good at this. You need to do it once. The one time you do it, in a sea of small talk, is the moment the thread turns into something else.
  </p>
  </>
  ),

  "attachment-styles-without-the-tiktok": (
  <>
  <p>
  Attachment theory has been chewed up by short-form video and spit back out as a personality quiz. Anxious, avoidant, secure, disorganised. Pick one. Post about it. Use it as the reason you ghosted.
  </p>
  <p>
  That is not what the theory says, and it is not what it is useful for.
  </p>
  <p>
  Attachment is a tendency that shows up under stress. Specifically: the stress of getting close to someone who might leave. It is not a label you wear at brunch. It is a gravity you feel, often without naming it, when a connection starts to matter.
  </p>

  <h2>The honest version</h2>
  <p>
  Four broad tendencies. None of them are identities. All of them are normal under the right conditions.
  </p>
  <p>
  <strong>Secure.</strong> When something feels off, you ask. When something feels good, you say so. You can tolerate the other person having a mood that is not about you. You do not need a same-day reply to feel safe. About half of adults look like this most of the time. They are also boring to make videos about, which is why you do not see them on your For You page.
  </p>
  <p>
  <strong>Anxious.</strong> Closeness feels good but precarious. You read tone in messages that have no tone. A two-hour gap can become a full afternoon of theories. You over-give early to lock in the connection, then resent that you over-gave. Your nervous system has decided that more contact equals more safety, and the math, painfully, does not always work that way.
  </p>
  <p>
  <strong>Avoidant.</strong> You want connection. You also need a door. When someone starts mattering, you feel a quiet pressure that you might describe as "needing space" or "not feeling it anymore." The wanting is real. The closing is also real. Both are happening at once and the closing usually wins because it is older.
  </p>
  <p>
  <strong>Disorganised.</strong> Closeness pulls you in and makes you flinch at the same time. The push-pull is internal, not strategic. The person you most want to be near is also the person whose voice note you cannot bring yourself to open. This one is rarer and almost never what TikTok means when it uses the word.
  </p>

  <h2>What it looks like at week two</h2>
  <p>
  Attachment does not show up on the first date. It shows up around the time you start to care.
  </p>
  <p>
  A friend of mine, secure-leaning, told me about meeting someone she really liked. The guy went quiet for thirty-six hours after a great second date. She noticed it, felt a small ping, then went to the gym and went to sleep. He texted on day two. She replied like the ping had not happened. They are still together two years later. The gravity was small enough that she could move through it.
  </p>
  <p>
  Another friend, anxious-leaning, told me about the same situation, different guy. Thirty-six hours of silence after a great second date. By hour ten she had drafted, deleted, and re-drafted four messages. By hour twenty she had decided she had been "too much." By hour twenty-eight she had sent a long apology for something neither of them had named. The guy was at his grandmother's funeral. He needed twelve more hours. The relationship did not survive the apology.
  </p>
  <p>
  Same external event. Two completely different inner weathers.
  </p>

  <h2>The useful question</h2>
  <p>
  Most people use attachment language to explain other people. Why he pulled away. Why she got clingy. Why this was doomed from the start.
  </p>
  <p>
  Useful attachment language goes the other way. It asks: when this connection started to feel like it mattered, what did my body do? Did I lean in harder than the situation called for? Did I find a reason to be busy? Did I pick a small fight to test the temperature?
  </p>
  <p>
  That is the question that does work. The one about them is mostly gossip.
  </p>

  <h2>What does not help</h2>
  <p>
  Telling someone on date two that you are anxious-attached. They cannot do anything with that information yet, and you have just handed them a frame for everything that goes slightly wrong from here on out. You are not warning them. You are pre-blaming yourself.
  </p>
  <p>
  Using your style as a reason. "I am avoidant, so." That sentence ends a conversation. It does not start one. The thing that actually moves you toward secure-feeling relationships is not announcing your style. It is staying in the room when your style wants to bolt.
  </p>

  <h2>What does</h2>
  <p>
  Noticing, naming, and then doing the small uncomfortable thing your style does not want to do. If you are anxious, that often means waiting four hours before sending the thing. If you are avoidant, that often means staying on the phone for the extra ten minutes when your skin is buzzing to hang up. If you are secure, it usually means not assuming everyone else has your settings.
  </p>
  <p>
  Attachment style is a starting condition, not a sentence. Most people move toward secure across their twenties and thirties if they are around people who do not punish them for the moves they make under stress. Some people move toward less secure when they are around people who do.
  </p>
  <p>
  The theory is useful when it makes you more curious about your own behaviour. It is useless, and often actively bad, when it gives you a four-letter excuse not to be.
  </p>
  </>
  ),

  "the-im-bad-at-dating-reframe": (
  <>
  <p>
  "I am just bad at dating."
  </p>
  <p>
  I have heard this sentence, or some version of it, from probably a hundred people. Smart people. Warm people. People who are excellent at their actual lives. They say it the way you say something you have already decided.
  </p>
  <p>
  It is almost never true in the way they mean it.
  </p>

  <h2>What people actually mean</h2>
  <p>
  When someone says they are bad at dating, they almost always mean one of these things, and they almost never mean all of them. Untangling which one matters.
  </p>
  <p>
  Sometimes they mean: I have a pattern I cannot see, and I keep ending up in the same disappointing place. That is a skill issue and skills can be learned.
  </p>
  <p>
  Sometimes they mean: I am attracted to a type of person who is not good for me, and I keep choosing them even though I know better. That is a calibration issue and calibration shifts with attention.
  </p>
  <p>
  Sometimes they mean: I do not know how to flirt without feeling like I am pretending. That is a permission issue and it eases when you stop trying to perform a thing called flirting and start actually noticing the person in front of you.
  </p>
  <p>
  Sometimes they mean: I am scared, and I have been scared for years, and I am running out of patience with myself about it. That is a real thing and it deserves more than a reframe.
  </p>
  <p>
  Sometimes they mean: dating has been awful for me lately, and saying "I am bad at it" feels less raw than saying "I have been hurt."
  </p>

  <h2>The cost of the sentence</h2>
  <p>
  The problem with "I am bad at dating" is the noun. It turns a temporary set of behaviours into a fixed identity. And identities resist change because identities recruit evidence.
  </p>
  <p>
  Once you have decided you are bad at dating, you will notice every bad date and store it as confirmation. You will not notice the date that went fine and just did not turn into anything. You will not notice the message exchange that built nicely for a week. You will store the no-shows and the awkward silences and the matches that ghosted, because those are the data points your story needs.
  </p>
  <p>
  It is not paranoia. It is just how stories work. The brain is loyal to the explanation it already has.
  </p>

  <h2>The reframe</h2>
  <p>
  The reframe is not "you are actually great at dating." That is a lie and you will not believe it.
  </p>
  <p>
  The reframe is changing the noun. Not "I am bad at dating" but "I have a few habits in dating that are costing me." The first sentence is a verdict. The second sentence is a to-do list.
  </p>
  <p>
  Habits are specific. They are also editable. A verdict is not.
  </p>

  <h2>How to actually find the habit</h2>
  <p>
  Pull the last six dating things. Matches that went nowhere, dates that went sideways, situationships that ended badly. Write one sentence per thing. Not a story. A sentence.
  </p>
  <p>
  Then read the six sentences as if a friend handed them to you and asked what they had in common.
  </p>
  <p>
  You will almost always find something. The thing is usually quieter than you expect. Often it is something you do early, in the first three messages or the first two dates, and it sets a tone you cannot recover from later. Sometimes it is the opposite. You do something at the four-week mark, every time, that closes the door from the inside.
  </p>
  <p>
  Whatever it is, that is the habit. Not your personality. A habit.
  </p>

  <h2>What changes when the noun changes</h2>
  <p>
  I worked through this with someone last year who was certain she was bad at dating. She was thirty-one, four years out of a long relationship, six months into a stretch where every match seemed to end the same way. We pulled the six sentences. The pattern was clear inside four minutes.
  </p>
  <p>
  She was, every single time, the first person to say "we should make this exclusive" somewhere around week three. Sometimes the guy agreed and then pulled away. Sometimes the guy did not agree and she ended it because she had already framed it as rejection. In both cases the conversation she had started was the conversation that ended it.
  </p>
  <p>
  She was not bad at dating. She had a specific habit that was running on a specific timeline. We talked about what the habit was trying to do for her, which was mostly to convert ambiguity into safety. We did not pretend she could stop doing the thing by force of will. We did agree she could notice when she was about to do it and ask herself one question first: what would happen if I gave this another two weeks?
  </p>
  <p>
  That was the whole intervention. She started dating someone in April. They are still together.
  </p>

  <h2>One sentence to keep</h2>
  <p>
  You are not bad at dating. You are running a habit, in a context that is genuinely hard, with limited feedback and no recovery time between attempts. That is a different sentence and it points at a different door.
  </p>
  </>
  ),

  "self-knowledge-is-the-pressure-point": (
  <>
  <p>
  Most dating advice is about other people. How to read them. How to attract them. How to spot the ones who will hurt you. How to send the message that gets the reply.
  </p>
  <p>
  Almost none of it is about you. Which is strange, because you are the only variable in the dating equation that you actually control.
  </p>
  <p>
  Self-knowledge is the pressure point. The small place where a little real pressure changes everything downstream. Done honestly, it outperforms tactics. By a lot.
  </p>

  <h2>What self-knowledge is not</h2>
  <p>
  It is not knowing your Myers-Briggs type. It is not knowing your love language. It is not knowing that you are an Enneagram 4 with a 5 wing. Those are vocabularies, not knowledge. Some of them are useful as starter prompts and most of them turn into excuses inside two months.
  </p>
  <p>
  It is also not the thing where you list your flaws to a partner on date three and call it vulnerability. That is performance. It buys you nothing.
  </p>

  <h2>What it actually is</h2>
  <p>
  Self-knowledge, in a dating context, is being able to answer four questions out loud, in your own words, without rehearsing.
  </p>
  <p>
  What do I actually want from a relationship right now, this season, not in theory. Who do I become when I am attracted to someone, what shifts in my behaviour, what gets louder, what goes quiet. What is the move I make under stress, the one that usually makes things worse. What am I avoiding by being on the apps, or by not being on the apps.
  </p>
  <p>
  Four questions. None of them tactical. All of them pointed at you.
  </p>
  <p>
  Most people, in my experience, can answer maybe one and a half of these clearly. The rest sit in the corner of their head as vague feelings they have not put into sentences.
  </p>

  <h2>Why this outperforms tactics</h2>
  <p>
  A good opener gets you a reply. Then you have to be a person on the other side of the reply. A flattering profile gets you matches. Then you have to do the actual dating. A perfect first date question gets you a fifteen-minute story. Then you have to keep dating that person, possibly for years.
  </p>
  <p>
  Tactics get you to the next step. Self-knowledge is what determines what happens after the next step. And after that. And after the next forty-two.
  </p>
  <p>
  Two people with identical message-coaching skills will have radically different outcomes if one of them knows that she gets quietly contemptuous around men who admire her too quickly and the other does not. The tactic is the same. The relationship arc is not.
  </p>

  <h2>The hardest part</h2>
  <p>
  The hardest part of self-knowledge is not gathering it. The hardest part is admitting the parts you would rather not.
  </p>
  <p>
  Almost everyone has a thing they do in early dating that they are not proud of. Pulling away the moment someone gets warm. Picking apart small flaws to manage your own anxiety. Saying yes to plans you do not want to keep because the no feels harder. Going cold for two days when you feel rejected, then pretending you were busy.
  </p>
  <p>
  Knowing the thing is not the same as fixing the thing. But the fix cannot start without the knowing. And the knowing, by itself, slows you down enough that the move sometimes does not get made. That alone is worth most of the work.
  </p>

  <h2>How to actually build it</h2>
  <p>
  Read your own messages back. The ones you sent six months ago, when you were in something. Notice what you sound like. Notice what you avoid asking. Notice where you are warm and where you are cool, and what triggered the shift.
  </p>
  <p>
  Talk to a friend who has watched you date. Ask them what they have noticed. Then sit through whatever they say without defending yourself. Friends are usually more accurate than therapists about the shape of your dating life because they have more data and less script.
  </p>
  <p>
  Write down the version of yourself you become when you are interested in someone. Not the version you wish you were. The actual one. The one that texts back too fast or too slow. The one that gets quieter or louder. The one that lies a little about their schedule.
  </p>
  <p>
  Notice the gap between that version and your idle-state self. That gap is the most useful piece of information you will ever have about your dating life.
  </p>

  <h2>What changes</h2>
  <p>
  Once you can see yourself with some accuracy, three things start happening on their own. You stop chasing people whose profiles flatter a part of you that you no longer want to feed. You start noticing the small moments in early dating where you usually self-sabotage, and you sometimes choose not to. And you stop reading every disappointment as confirmation that the dating pool is broken, because you can see your own contribution to the disappointment.
  </p>
  <p>
  None of that is glamorous. None of it makes a good caption. It is also the thing that quietly separates the people who keep cycling from the people who eventually do not.
  </p>
  </>
  ),

  "healing-and-avoidance-look-the-same-from-the-outside": (
  <>
  <p>
  Same app break. Same journal. Same therapist. Same six months "focusing on myself." From the outside, healing and avoidance are identical.
  </p>
  <p>
  From the inside they feel different, but most people have not been taught what to listen for, and the difference is easy to miss when you want to be doing one and are actually doing the other.
  </p>

  <h2>Why they look the same</h2>
  <p>
  Both involve stepping back. Both involve more solitude than usual. Both involve a vocabulary of self-work, boundaries, capacity, nervous system. Both look responsible. Both photograph well.
  </p>
  <p>
  The difference is not in the activities. It is in what the activities are pointed at.
  </p>
  <p>
  Healing is metabolising something. Avoidance is stepping around it. The journal that is healing is the journal where you write the sentence you have been afraid to write. The journal that is avoidance is the journal where you write around it for thirty pages and feel productive.
  </p>

  <h2>The test</h2>
  <p>
  Here is the test I use, on myself and out loud with friends when they ask.
  </p>
  <p>
  Healing tends to involve approaching a specific thing. A specific person, a specific feeling, a specific event. The work is moving toward, even slowly. After a healing session, you usually feel tired and slightly more honest. Sometimes you feel worse for a day. The relief, when it comes, comes from having looked at the thing.
  </p>
  <p>
  Avoidance tends to involve diffuse activity around the general area of the thing without ever touching the thing. You meditate for a month, you take the app break, you go on the retreat, you read the book. You feel calmer. The calmness, when it comes, comes from having successfully not looked at the thing.
  </p>
  <p>
  Calmness from looking and calmness from not looking are different textures. You can tell which one you are in if you ask honestly. The body knows.
  </p>

  <h2>An example</h2>
  <p>
  A friend of mine got out of a relationship in March of last year. The breakup was bad. She did everything right, on paper. Therapy weekly. App delete. Six months of "not dating to date but dating to learn." Yoga. A trip alone to Portugal. Read four books with the word boundary in the title.
  </p>
  <p>
  In November, eight months in, she told me she felt calmer but not different. The same feeling she had been trying to get away from was still there, in the same place, waiting.
  </p>
  <p>
  We talked about the breakup, which she had told the story of probably forty times by then. I asked what the worst sentence she could say about it was. She thought for a long time. She said something that was not in any version of the story she had told before. It was about a thing she had done, not a thing he had done, and she had not said it out loud to anyone.
  </p>
  <p>
  She cried for about an hour. Then she went home and slept for eleven hours. The next week she said something had shifted. The thing she had been calmly working around for eight months had been the thing she had to say.
  </p>
  <p>
  The eight months were not wasted. They built the capacity to say it. But the saying was the move. The eight months on their own would have been avoidance dressed as growth.
  </p>

  <h2>What avoidance sounds like</h2>
  <p>
  Avoidance has a vocabulary. It sounds wise. It says things like, I am not ready to date again. I am still working on myself. I need to be whole on my own first. I do not want to bring my baggage into something new.
  </p>
  <p>
  Sometimes these sentences are true. Sometimes they are protection. The way to tell is to ask: is there a specific thing I am protecting myself from, and am I doing anything to actually face it, or am I just running out the clock until it feels safer to look.
  </p>
  <p>
  Running out the clock does not work. The thing does not get smaller while you wait. Sometimes it gets quieter, which you can mistake for smaller, until something normal happens and it is right there again at full volume.
  </p>

  <h2>What healing sounds like</h2>
  <p>
  Healing has a different vocabulary, often less articulate. It sounds like, I had a hard week. I noticed I did the thing I always do, and I do not know yet what to do about it. I said the thing to my therapist that I had been avoiding for a year. I am still scared but I am tired of being scared.
  </p>
  <p>
  Healing is rarely tidy. It is rarely linear. It often makes you, briefly, less functional than you were when you were avoiding. That is part of the test. If your "healing" never costs you a week of being slightly worse, you might want to look at whether you are doing it or performing it.
  </p>

  <h2>Why this matters for dating</h2>
  <p>
  Dating brings up the thing. Even when you are not looking for it to. You meet someone and the old shape arrives in the room. If you have been healing, you can feel it without being run by it. If you have been avoiding, you find yourself doing the thing again, in a slightly different costume, with someone new.
  </p>
  <p>
  The break from dating is not the work. The break creates the space for the work. The work is the part where you sit with what arrives. Most people skip that part, take a long enough break that the feeling goes underground, and call it healed.
  </p>
  <p>
  That is the most common mistake I see. It is not a moral failing. The instinct to step around the thing is older than any of us. But the relationship that follows the break is going to ask, very directly, whether the work happened. And it will know.
  </p>
  </>
  ),

  "what-wellness-actually-means-when-youre-dating": (
  <>
  <p>
  Wellness has been colonised by a particular aesthetic. Matcha. Pilates. A morning routine that begins at five-fifteen. A sober October. A specific shade of beige.
  </p>
  <p>
  None of that is wrong. Most of it is fine. Almost none of it is what wellness actually means when you are dating.
  </p>

  <h2>The working definition</h2>
  <p>
  Wellness, in a dating context, is your capacity to feel a thing and still be legible to the person across from you.
  </p>
  <p>
  That is the whole definition. The rest is mechanics.
  </p>
  <p>
  If you are jealous and can name it without it eating the evening, that is wellness. If you are anxious about a slow reply and can hold the feeling without sending eight follow-ups, that is wellness. If you are excited and can let it land without rushing the timeline, that is wellness. If you are disappointed and can say so in a sentence that does not punish anyone, that is wellness.
  </p>

  <h2>What it depends on</h2>
  <p>
  Capacity is not abstract. It is built from very concrete inputs that most wellness content underplays because they are not photogenic.
  </p>
  <p>
  <strong>Sleep.</strong> Almost every fight I have had with a partner in the early stages of dating was downstream of one of us being underslept. Six hours twice in a row, and my reading of tone goes haywire. Five hours twice in a row, and a normal text feels like a slap. Sleep is the first wellness lever and it is free.
  </p>
  <p>
  <strong>Friends.</strong> If your only emotional outlet about a new person is the new person, the relationship is being asked to do too much. A friend who has known you for ten years and will tell you, gently, that you are spiralling, is worth more than three therapists you have just met. The wellness move is calling them before you call him.
  </p>
  <p>
  <strong>Rage.</strong> A wellness culture that pretends anger is a sign of poor regulation will quietly teach you to swallow legitimate frustrations until they come out sideways at week six. Rage is information. The capacity to feel it, name it, and let it move through you without performing it on the person who caused it, is one of the most underrated wellness skills in dating.
  </p>
  <p>
  <strong>The body.</strong> Not the gym. The body. Knowing when you are hungry. Knowing when you are tired. Knowing when you are turned on and when you are pretending. People who have lost touch with the body cannot tell, often for years, that a relationship is not working. The body knew at month two. They could not feel it because they had stopped feeling much of anything.
  </p>

  <h2>What it does not depend on</h2>
  <p>
  It does not depend on having your whole life sorted. I have known plenty of people in chaotic life seasons who dated well, because they were honest about the chaos and did not ask the new person to fix it. I have also known people with perfectly arranged lives who dated badly, because the arrangement was the avoidance.
  </p>
  <p>
  It does not depend on never being a mess. Wellness is not the absence of mess. It is the ability to be a mess and tell the truth about it. Most of the worst dating behaviour I have seen was from people performing wellness at someone, not people being honest about not feeling well.
  </p>

  <h2>The dating-specific check</h2>
  <p>
  Three questions I think are more useful than any wellness quiz when you are about to start dating again.
  </p>
  <p>
  One. Can I currently feel a strong feeling, name it accurately, and still function the next day. If the answer is no, that is not a moral problem, that is a capacity problem, and you should know it about yourself before you start.
  </p>
  <p>
  Two. Do I have at least one person in my life I would tell the truth to about a date that went badly, without spinning it first. Not a group chat. A person. If the answer is no, your support structure is too thin to date well, and you should fix that before fixing your bio.
  </p>
  <p>
  Three. Is there a feeling I have been running from for more than six months, that dating will bring up. If yes, dating will not solve it and might make it sharper. That is not a reason not to date. It is a reason to be honest with yourself, early, about what is going to come up.
  </p>

  <h2>The thing nobody puts on the wellness page</h2>
  <p>
  The single most predictive wellness signal in early dating, in my experience, is whether you can tolerate a small disappointment without dramatising it. Not a betrayal. A small disappointment. The cancelled plan, the slightly cooler text, the off night.
  </p>
  <p>
  People who can tolerate that without escalating are people who tend to end up in good relationships. People who cannot, usually because the small disappointment lands on top of an older one and detonates, tend to keep getting close and then blowing it up.
  </p>
  <p>
  That tolerance is the wellness skill. Everything else is staging.
  </p>
  </>
  ),

  "the-question-you-keep-not-asking-yourself": (
  <>
  <p>
  Most of the questions you ask yourself about dating are about them. Are they into me. Why did they go quiet. Are they playing games. Is this going somewhere. Do I like them, or do I just like the attention.
  </p>
  <p>
  There is one question that is about you and you almost never ask it. Most of what is going wrong in your dating life lives downstream of not asking it.
  </p>

  <h2>The question</h2>
  <p>
  What slot is this person filling for me right now.
  </p>
  <p>
  Not what do I like about them. Not what is the future here. Not are they good for me. The question is what slot. What role in your interior life is this person, right this minute, being recruited into.
  </p>
  <p>
  It is an awkward question. It feels reductive. It is also extremely clarifying, and you probably do not ask it because you already half-know the answer.
  </p>

  <h2>The slots</h2>
  <p>
  There are a handful of common ones. Most people have a favourite, and most people are running it without seeing it.
  </p>
  <p>
  <strong>The proof slot.</strong> This person is proof that you have moved on, that you are desirable, that you are not the person your last partner said you were. Their job is to confirm something about you. Whether they want to do that job is a separate question.
  </p>
  <p>
  <strong>The distraction slot.</strong> Something in your life is unbearable right now and this person is somewhere else to put your attention. The relationship is functioning as the screen between you and the unbearable thing. Often it works. For a while.
  </p>
  <p>
  <strong>The rescue slot.</strong> You are lonely, or sad, or scared about a milestone, and you are looking for someone to take the edge off the underlying state. They are not a partner yet. They are a temperature change.
  </p>
  <p>
  <strong>The almost-right slot.</strong> Someone who looks close enough to the thing you actually want that you can let yourself stay, but is reliably wrong in a specific way you have already noticed and are pretending not to. This one is the most painful because it can run for years.
  </p>
  <p>
  <strong>The repair slot.</strong> You had a painful past relationship and this person is going to be the version that works. They are being asked to fix a wound they did not make. They will sometimes try. They will eventually resent it.
  </p>
  <p>
  <strong>The partner slot.</strong> This is rarer than people think early on. This is when you can answer the question and the answer is, honestly, that the slot is being a partner. No other job. Just that one.
  </p>

  <h2>Why this is uncomfortable</h2>
  <p>
  Because it implies you are using someone, which sounds bad. We have a cultural rule that any relationship that is not pure is exploitative.
  </p>
  <p>
  That is not what I am saying. Most relationships fill more than one slot at once. The question is not whether they fill a slot. The question is whether you can see which slot they are filling, and whether you are being honest about it with yourself and, eventually, with them.
  </p>
  <p>
  A relationship that is mostly the distraction slot, where both people know it, is one thing. A relationship that is mostly the distraction slot, where you are calling it love because love is the only word you let yourself use, is another. The first one might be fine. The second one ends badly.
  </p>

  <h2>How to actually ask it</h2>
  <p>
  Pick a person you are dating, or thinking about, or stuck on. Write their name on a piece of paper. Underneath, write the sentence, the slot I am asking this person to fill is.
  </p>
  <p>
  Finish the sentence without revising. Whatever comes out, keep it. Do not soften it.
  </p>
  <p>
  Then ask: would I be okay if this person knew that was the slot. If the answer is yes, you probably have a real relationship or the start of one. If the answer is no, you have information.
  </p>
  <p>
  Information is not a verdict. Sometimes you keep dating the person anyway, with more honesty about what you are doing. Sometimes you let them go because keeping them was costing both of you. Sometimes you realise the slot is the partner slot and you have been hiding from how much you actually want this.
  </p>

  <h2>What changes</h2>
  <p>
  Once you can ask this question reliably, your swipe behaviour starts to shift. You stop matching with people whose only function is to fill an old slot you are tired of running. You stop chasing connections whose appeal is mostly about something you are running from.
  </p>
  <p>
  You also stop blaming people for not being the thing you secretly hired them to be. Which is a lot of what bitterness in dating is. Bitterness at people for failing a job interview they did not know they were in.
  </p>
  <p>
  Asking the slot question is, in the end, a kindness to both of you. It does not make you mercenary. It makes you slightly harder to surprise by your own behaviour.
  </p>
  </>
  ),

  "you-are-not-your-pattern": (
  <>
  <p>
  There is a stage of self-awareness that is genuinely useful and a stage right after it that is a trap.
  </p>
  <p>
  The useful stage is when you finally see your pattern. The chronic move you make, the kind of person you reliably pick, the spot in week three where you always do the thing. Seeing it is a relief, even when it stings. The trap is what happens about six months later, when the pattern has stopped being something you do and started being something you are.
  </p>

  <h2>The shift</h2>
  <p>
  It sounds like this. I am an anxious attacher. I am someone who self-sabotages. I am a runner. I am the type who falls for unavailable people. I am too much. I am not enough. I am someone who needs a lot of space.
  </p>
  <p>
  Notice the verb. I am. Not, I tend to. Not, I have noticed I sometimes. The pattern has become a noun. A noun about you. A noun you carry around.
  </p>
  <p>
  Nouns are sticky. Once you have one, you stop noticing the days when you do not match it. You stop noticing the date where you did not do the thing. You stop noticing the conversation where the pattern did not show up. The noun edits the data so that the noun keeps being true.
  </p>

  <h2>Why this is worse than not knowing</h2>
  <p>
  Not knowing your pattern is bad because you keep running it without seeing it. Knowing your pattern but having become it is, in a strange way, worse, because you have added a layer of fatalism on top of the pattern.
  </p>
  <p>
  A friend told me last spring that she had decided she was just an anxious attacher and was going to look for people who could "handle that." She said it with a kind of finality. The reading of attachment theory she had done had given her a vocabulary that mostly served to lock the pattern in. She did not see herself as someone who sometimes got anxious about closeness. She saw herself as a type. The type came with predictions, and the predictions came with permission.
  </p>
  <p>
  It is hard to change a behaviour that you think is the truth about you. It is much easier to change a behaviour that you think is a habit you are running.
  </p>

  <h2>Describing versus prescribing</h2>
  <p>
  This is the distinction most of self-help gets wrong. A description is, when I am stressed, I tend to pull away. A prescription is, I am avoidant.
  </p>
  <p>
  Description leaves room for the exception, the slow change, the season where the thing was less true. Prescription does not. Prescription is identity, and identity asks for loyalty.
  </p>
  <p>
  You can use the same vocabulary in either mode. The difference is in the verb and in what you do with the data the next time the pattern does not appear. If the data is allowed to count, you are describing. If the data has to be explained away to keep the story intact, you are prescribing.
  </p>

  <h2>The test, again</h2>
  <p>
  Last month, did the pattern hold every single time. If yes, it is probably a pattern. If no, it is a pattern with exceptions, and the exceptions are interesting.
  </p>
  <p>
  Exceptions tell you something. They tell you the conditions under which the pattern does not run. Maybe it does not run when you are sleeping enough. Maybe it does not run with people whose energy is unusually calm. Maybe it does not run when you have not had a drink. Whatever it is, the exception is where the change lives.
  </p>
  <p>
  If you have made yourself into the noun, the exception just looks like a fluke. If you have kept yourself as the person who sometimes runs the pattern, the exception looks like a clue.
  </p>

  <h2>What I keep saying to people</h2>
  <p>
  You have a pattern. The pattern is real. The pattern probably has a cause that started a long time before any of this. You are not making it up.
  </p>
  <p>
  And. You are not the pattern. The pattern is a thing you do, sometimes more, sometimes less, depending on conditions you have more control over than the noun makes it sound.
  </p>
  <p>
  That distinction is small and it is most of the work. People who change their dating lives do it from the side of, I have noticed I do this. People who get stuck do it from the side of, this is who I am.
  </p>

  <h2>The danger of the vocabulary</h2>
  <p>
  The reason I am wary of the current state of dating discourse is that it makes it very easy to acquire the prescription without doing the work. You can call yourself avoidant on Tuesday based on three TikToks and a quiz, and by Friday it is fused with your identity. You have skipped the noticing-yourself step entirely. You have just adopted a label that, conveniently, predicts the next time you blow something up.
  </p>
  <p>
  That is not insight. That is borrowed fatalism.
  </p>
  <p>
  Real self-knowledge is more boring and slower. It is noticing. It is keeping the verb soft. It is letting the exceptions count. It is being suspicious of any sentence about yourself that starts with I am and ends with a clinical category.
  </p>
  <p>
  You are not your pattern. You are the person who can watch the pattern arrive and, sometimes, decide what to do next.
  </p>
  </>
  ),

  "picking-right-is-not-the-skill": (
  <>
  <p>
  The culture sells dating as a selection problem. Get the algorithm right. Read the signs early. Spot the red flags. Filter harder. The implicit promise is that if you just pick the right person, the rest will mostly take care of itself.
  </p>
  <p>
  This is almost the opposite of what people in long, good relationships will tell you when they are being honest.
  </p>

  <h2>What the data quietly says</h2>
  <p>
  The most carefully designed studies on relationship satisfaction find, again and again, that who you pick matters less than how the two of you behave together. The variance between "compatible" couples and "incompatible" couples on intake is small. The variance between couples who do certain things repeatedly and couples who do not is enormous.
  </p>
  <p>
  Pick anyone, behave badly, the relationship ends badly. Pick anyone reasonable, behave well, the relationship usually works. There is a floor below which selection cannot save you and a ceiling above which selection mostly does not matter.
  </p>
  <p>
  Most people are well above the floor and well below the ceiling. Most of the time, then, selection is not the lever.
  </p>

  <h2>The skills nobody calls skills</h2>
  <p>
  Calibration. The ability to read how the other person is doing today, and adjust without making them work for the adjustment. It is small and it is not glamorous. It is most of what loving someone over years actually consists of.
  </p>
  <p>
  Repair. The ability, after a fight or a misunderstanding, to come back to the room and say the thing that closes the gap. Not the apology that re-litigates. The repair sentence. People who can do this stay together. People who cannot do this break up with people who would have been fine.
  </p>
  <p>
  Showing up. The basic, unglamorous practice of doing what you said you would do, when you said you would do it, even when you are tired or distracted or in a mood. The reliability of small promises is, over time, a larger predictor of relationship health than chemistry, intelligence, or shared values.
  </p>
  <p>
  Tolerating difference. Noticing that the person you picked is not, in fact, a slightly modified version of you, and finding that interesting rather than threatening. Most couples I have watched come apart did so over differences they had logically known about from the first month and emotionally never accepted.
  </p>

  <h2>The Esther Perel thing</h2>
  <p>
  Perel said something years ago that I keep coming back to. We have asked one person to be everything to us, and then we are surprised when it does not work.
  </p>
  <p>
  The implication is not that you should expect less. The implication is that you should expect to do more, with the person you have, rather than spending your thirties looking for the person you would have to do less with.
  </p>
  <p>
  That person does not exist. Or rather, that person exists for about eleven weeks and then becomes a real human whose needs are also annoying.
  </p>

  <h2>What picking is for</h2>
  <p>
  Selection is not pointless. It rules out the genuinely bad fits. Major value mismatches. Repeated dishonesty. The dynamic that, in the first three weeks, makes you smaller in a way you do not recover from. You do need to be able to walk away from those.
  </p>
  <p>
  But that is a floor exercise, not a ceiling one. Most of the people who survive your floor checks are workable, if you are workable, and most of the time the difference between them is not large enough to predict the trajectory.
  </p>
  <p>
  The trajectory is mostly about you. What you do at the four-week mark. What you do the first time you are disappointed. What you do when they reveal a part of themselves that did not show up in the first month.
  </p>

  <h2>The question I would put on every dating app</h2>
  <p>
  Not, do I like this person. Not, are they my type. Not, are they the one. Just, who do I become when I am with them.
  </p>
  <p>
  Do I become more honest or more performed. Do I become more generous or more measured. Do I become more curious about them, or more focused on what they think of me. Do I sleep better or worse. Do I see my friends more or less. Do I feel more like myself or like someone slightly adjacent to myself.
  </p>
  <p>
  Those are answerable questions, often by date four. They are almost never the questions people are actually asking. The questions people are actually asking are about them.
  </p>
  <p>
  Who you become with them is what you are picking. Not them. The version of you that exists in their presence. That is the only real thing on offer. The skill is reading that version honestly and choosing accordingly.
  </p>

  <h2>Why this is hopeful, actually</h2>
  <p>
  If picking were the skill, your dating life would be mostly luck. The odds of finding the right person on the apps in your particular city in your particular season would govern your romantic future. That is a bleak math.
  </p>
  <p>
  If picking is the floor and behaving together is the skill, then your dating life is in your hands. Not all of it. But the part that determines the trajectory once you are with someone reasonable. Which is most of it.
  </p>
  <p>
  That is the actually hopeful version. Less filtering, more building. Less verdict, more practice. The people who end up in long, good relationships are not the people who picked perfectly. They are the people who got reasonably good at the unglamorous work, with someone reasonable, over time.
  </p>
  </>
  ),

  "dating-fatigue-is-real-and-its-fixable": (
  <>
  <p>
  A few weeks ago I sat down to swipe and realised I had been doing it for eleven minutes without registering a single face. I had become a thumb. The faces were a slide deck.
  </p>
  <p>
  That is dating fatigue. Not boredom. Not depression. A specific, narrow exhaustion that comes from running a low-grade cognitive task for thousands of reps without any real outcome attached.
  </p>
  <p>
  Most people I talk to think the fatigue is moral failure. They think they are losing the thread because they are picky, or shallow, or not trying hard enough. None of that is what is happening. The brain you brought to the apps is the same brain it has always been. It just got asked to do a thing it was not built for, and the thing has no end state.
  </p>
  <p>
  Let me describe the texture, since you probably recognise it.
  </p>
  <p>
  You open Hinge. You make seventy small evaluations in three minutes. You match with someone. You feel a small flat sensation that is not excitement. You exchange six messages. The conversation peters out. You go back to swiping. Two days later you cannot remember any of the names.
  </p>
  <p>
  If you ran any other system this way for months you would call it broken. We do not call dating apps broken because we have stopped expecting them to feel different.
  </p>

  <h2>What fatigue actually is</h2>
  <p>
  When your brain processes a face it does an enormous amount of low-level work. Symmetry, expression, age estimation, vibe parse, comparison against thousands of other faces you have already seen this week. None of that work is voluntary. It happens whether you want it to or not.
  </p>
  <p>
  Stack 200 of those a day for six weeks and the system runs out of headroom. The faces start to look the same. The bios start to read the same. Your taste flattens because flat is what an overtaxed face-evaluator outputs.
  </p>
  <p>
  This is not a character flaw. It is bandwidth. Pilots get this. Air-traffic controllers get this. The fix is not to try harder.
  </p>

  <h2>The fixes that do not work</h2>
  <p>
  Switching apps. You will get a small novelty bump for forty-eight hours. Then you are processing the same faces with a slightly different UI.
  </p>
  <p>
  Upgrading to premium. You will get more matches. The fatigue is downstream of the volume already. Adding volume is the opposite of the medicine.
  </p>
  <p>
  Forcing yourself to be "more open." This is the worst one. You start matching with people you have no interest in, going on dates that confirm you have no interest in them, and then telling yourself you are bad at dating. You are not bad at dating. You are bad at ignoring your own data.
  </p>

  <h2>The fixes that do work</h2>
  <p>
  Cap your reps. I went from open-ended swiping to ten minutes a day with a timer. The dating did not get worse. The matches did not drop. The fatigue lifted in about a week.
  </p>
  <p>
  Process each conversation to a decision point before opening the next one. If you have four threads going and none of them have a date in motion, you have zero threads. Pick one. Move it forward or close it. Then open the next one.
  </p>
  <p>
  Treat the apps as a tool, not a feed. The feed framing is what does the damage. Tools you pick up and put down. Feeds you scroll because the scroll itself is the reward. The apps want to be feeds. They do not have to be.
  </p>

  <h2>The bigger frame</h2>
  <p>
  Dating fatigue is also a signal that the rest of your life is contributing too little. When the apps are the most stimulating thing in your week, they will exhaust you. When they are one input among many, they sit at the right size.
  </p>
  <p>
  I went through a stretch this year where my social life had thinned out. I was new in a city. The apps got loud because nothing else was making noise. I added two standing things to my week, a Tuesday run with a friend and a Sunday writing session at a café, and the apps quieted on their own. They had less to do.
  </p>
  <p>
  This is not "go touch grass." That advice is condescending and useless. It is more specific than that. The apps swell to fill whatever space your life leaves them. Give them less space and they shrink without any willpower on your end.
  </p>

  <h2>When the fatigue is something else</h2>
  <p>
  Sometimes what reads as fatigue is actually grief, or post-relationship dysregulation, or burnout from the rest of your life that is leaking into this corner. The tell is whether breaks help.
  </p>
  <p>
  If you stop using the apps for two weeks and feel relieved, it was fatigue, and the fixes above work.
  </p>
  <p>
  If you stop for two weeks and feel worse, the apps were holding something at bay. You are not actually tired of dating. You are tired of being alone with whatever surfaces when the distraction stops. That is a different problem, and the answer is not the apps either way.
  </p>

  <h2>The point about practice</h2>
  <p>
  I keep a short log of how each app session felt. Not the matches. The session. Did I close the app feeling sharper or duller than when I opened it. Three sentences. That data adds up quickly.
  </p>
  <p>
  After a month you can see the pattern. The sessions that felt good were almost always short, had a specific intent, and ended at a decision point. The sessions that felt bad were almost always long, drifting, and ended because I got bored, not because I was done.
  </p>
  <p>
  The fatigue is fixable. The fix is mostly structural. You do not have to want to date less. You have to want to swipe less. Those are different sentences, and the second one is the one that actually changes anything.
  </p>
  </>
  ),

  "the-reset-week-and-why-it-works": (
  <>
  <p>
  I run a reset week about every six weeks. Not because some app told me to. Because if I do not, the dating part of my life starts to leak everywhere and I get worse at all of it.
  </p>
  <p>
  A reset week is exactly what it sounds like. Seven days off the apps, off the live conversations, off the planning. The bar is low. Nothing happens. That is the whole point.
  </p>
  <p>
  People think a reset is a luxury or a hippie thing. It is not. It is maintenance. Same category as sleeping, eating, taking your laptop off your lap before your thigh goes numb.
  </p>
  <p>
  Let me explain what it actually does, because the surface description sounds like permission to do nothing, which is the wrong frame.
  </p>

  <h2>What a reset week actually changes</h2>
  <p>
  Five things move during a reset week, in roughly this order.
  </p>
  <p>
  First, your face-recognition system reboots. The numbing flatness that comes from grading a thousand profiles in a month softens. You can tell because by day four faces start to look like individual faces again, not categories.
  </p>
  <p>
  Second, your sense of standards comes back. Burned-out daters develop a strange relationship to the bar. Either it drops to almost zero, because every match is just one more thing to grind through, or it gets unreasonably high, because every flaw is one more reason to abandon the whole project. Off the apps for a week, you stop grading at all, and the actual sense of what you want resurfaces.
  </p>
  <p>
  Third, the obsessive replay loop dims. You know the one. Where you keep relitigating a date from three weeks ago, a thread that died last Sunday, a thing you said that did not land. With nothing live to feed the loop, it runs out of fuel.
  </p>
  <p>
  Fourth, your social life expands by the exact amount the apps were taking up. This is not poetic. It is arithmetic. Two hours a week reclaimed shows up as two hours of friend time, exercise, sleep, or whatever you actually wanted.
  </p>
  <p>
  Fifth, and this is the one most people do not anticipate, you remember what it feels like to not be in motion romantically. Most people who have been actively dating for over a year have forgotten what stillness feels like. Stillness is information. It tells you what you actually miss versus what was just habit.
  </p>

  <h2>How to actually run one</h2>
  <p>
  I have learned through trial and error what makes a reset week work versus what makes it a tease.
  </p>
  <p>
  Delete the apps from your phone. Do not just hide them in a folder. Do not just turn off notifications. Delete. You can reinstall in two minutes after the week. The friction is the medicine.
  </p>
  <p>
  Tell two people you trust. Not for accountability theatre. For the small thing where saying a thing out loud makes it more real.
  </p>
  <p>
  Do not replace the apps with a new shiny dating thing. Do not sign up for a singles event. Do not try out a new platform. The point is not "different dating." The point is no dating.
  </p>
  <p>
  Do not journal about dating during the week either. The reset has to extend to the meta-layer. You are not allowed to analyse your dating life this week. Same brain, different topic.
  </p>
  <p>
  Cook one real meal alone. This is oddly important. Eating something you made for yourself, slowly, without a screen, is a small ritual that does something specific. I cannot fully explain why it works. It works.
  </p>

  <h2>What goes wrong</h2>
  <p>
  The first time I tried a reset week I checked the apps on day three because I was bored. I told myself it was research. It was not. I had to start over.
  </p>
  <p>
  The second time I went on a date in the middle, with someone I had matched with the week before. I told myself it did not count. It counted.
  </p>
  <p>
  The third time I made it through clean. The difference on the other side was significant. Not a personality change. A volume change. The noise had gone down. I could hear what I actually thought.
  </p>

  <h2>What it is not</h2>
  <p>
  A reset week is not a cleanse. There is no toxin you are flushing. It is not a punishment for swiping too much. It is not a guarantee that you will come back rejuvenated and meet someone in the first hour.
  </p>
  <p>
  What it is, mostly, is permission to stop performing for seven days. Dating involves a lot of performance. Even if you do not feel like you are performing, your nervous system is doing low-grade vigilance the whole time. Vigilance is expensive.
  </p>

  <h2>When to run one</h2>
  <p>
  The signals are pretty clear once you know them. Conversations feel like work. You find yourself irritated at matches before they have done anything. You cannot remember the last time you laughed at someone's prompt. You are checking the apps more but enjoying them less.
  </p>
  <p>
  If any two of those apply, you are due. If three or four apply, you were due last week.
  </p>
  <p>
  After enough reps I started noticing the early signal, which is when I open the app and feel a small tired thing before the first profile loads. That is the dashboard light. When it comes on, I know a reset is coming, and I would rather run it on purpose than crash into one.
  </p>
  </>
  ),

  "journaling-without-making-it-homework": (
  <>
  <p>
  I tried to journal about dating for the first time at twenty-six. I bought a leather notebook. I sat down on a Sunday with a cup of coffee. I wrote two pages, hated all of it, and did not open the notebook again for nineteen months.
  </p>
  <p>
  The reason was simple. I had treated journaling as homework, and the only consistent thing about me is that I do not do homework.
  </p>
  <p>
  Most journaling advice gets this wrong. It tells you to write every day. It tells you to write for thirty minutes. It tells you to "process your emotions," which is a phrase invented by someone who has not had to actually do it. None of that works for normal humans with normal jobs and normal attention.
  </p>
  <p>
  The version that does work is much smaller, and it is built around the specific texture of dating, which is fast, episodic, and full of moments that disappear if you do not catch them.
  </p>

  <h2>What dating journaling is actually for</h2>
  <p>
  Two things, mostly.
  </p>
  <p>
  One. Holding onto the specifics you will forget. Three weeks from now you will not remember the exact phrase someone used that bothered you. You will remember that you were bothered. The exact phrase is the data. The bothered is the conclusion. Skip the data and you cannot learn anything.
  </p>
  <p>
  Two. Watching yourself across multiple dates and conversations and noticing the repeating moves. You cannot see your own pattern from one entry. You can see it from twelve. Twelve is achievable. Twelve is not "every day for a year."
  </p>
  <p>
  That is the whole purpose. Anything beyond that is a bonus.
  </p>

  <h2>The shape that works</h2>
  <p>
  A dating journal entry is three to six sentences. Not a paragraph. Not a free-write. Three to six sentences.
  </p>
  <p>
  The structure I use is: what happened, what I felt, what I notice now.
  </p>
  <p>
  Example. Drinks with R on Thursday. Felt sharper than I expected, also a little defensive when she asked about my last relationship. Notice now that I get defensive specifically when the question is sympathetic. I have a thing about being pitied.
  </p>
  <p>
  That is the entry. It took ninety seconds. It will be useful in six weeks when I am wondering why a different conversation went sideways.
  </p>

  <h2>When to write</h2>
  <p>
  Not at a set time. The set-time framing is what kills journaling for most people. Write within four hours of the thing. Not before, not days later. Within four hours, while the texture is still available.
  </p>
  <p>
  A date is the obvious trigger. A hard conversation. A surprising message. A moment in your own head where you noticed something you had not noticed before. Those are the things you write about. Not "today I felt." That direction never goes anywhere.
  </p>
  <p>
  If nothing happened, do not write. There is no value in performing journaling on an empty week. Skip it. The notebook will wait.
  </p>

  <h2>Format does not matter</h2>
  <p>
  I use Notes on my phone for ninety percent of mine. I have a notebook for the longer ones. I sometimes write into the Mirror in the app when I want it to feed into the pattern view across dates.
  </p>
  <p>
  The medium is not the point. The friction-cost is the point. Whatever lets you write the three sentences in ninety seconds without a setup ritual is the right tool. If the tool requires opening a laptop, finding the file, formatting the date header, you will not do it. I will not do it. Nobody does it.
  </p>

  <h2>What not to journal about</h2>
  <p>
  Skip the meta. Do not write about your dating "journey." Do not write about how you are growing. Do not write the kind of entry that sounds like it was written for an audience of one future therapist. Those entries are emotionally pleasing to produce and useless to read later.
  </p>
  <p>
  The useful entries are small, specific, slightly embarrassing. They are about a moment you cannot stop replaying, or a thing you said you wish you had not, or a feeling you cannot place. Those are the ones that show you something six months from now.
  </p>

  <h2>What to do with the entries</h2>
  <p>
  Mostly nothing. They sit there. Once a month, maybe every six weeks, read the last batch in one sitting.
  </p>
  <p>
  Reading them is where the actual learning happens. In the moment each one feels small. Stacked, they reveal patterns that no single one shows. I have noticed things about myself from these reads that I had been doing for years without seeing.
  </p>
  <p>
  A specific example. I read three months of entries last spring and noticed I had used the phrase "felt safe" about every woman I went on a second date with, and "felt interesting" about almost everyone I did not. That was useful information. I had not known I was tracking that distinction. Now I do.
  </p>

  <h2>The pace that is sustainable</h2>
  <p>
  Two to four entries a week, in active dating periods. Zero entries a week, in fallow periods. No guilt in either direction.
  </p>
  <p>
  The trap is thinking journaling is a virtue. It is not. It is a tool. Tools you use when they help and put down when they do not. If your dating journal feels like a tax, it is the wrong shape and you should change it until it is not.
  </p>
  <p>
  That is the whole method. Three sentences. Within four hours. Specific over reflective. Read monthly. Put down when nothing is happening.
  </p>
  <p>
  If that sounds underwhelming, good. The underwhelming version is the one you will actually do.
  </p>
  </>
  ),

  "post-date-reflection-without-the-spiral": (
  <>
  <p>
  The hour after a date is the most dangerous hour of the week, if you are the kind of person who reflects.
  </p>
  <p>
  I do not mean dangerous physically. I mean dangerous to your ability to read the date accurately.
  </p>
  <p>
  In that first hour your brain is flooded with the freshest possible version of the data, and also the most distorted version of it. You are running on whatever drink you had, the residual adrenaline of being looked at across a table, and a half-formed verdict about how it went. Whatever you write, think, or text in that hour will warp the date in your memory for weeks.
  </p>
  <p>
  So the question is not whether to reflect. It is when, and how, without the spiral.
  </p>

  <h2>What the spiral looks like</h2>
  <p>
  You leave the bar. You walk to the train. By the time you sit down on the train you have already convicted yourself or them. You text your friend. Your friend asks one question. You give a version of the night already shaped by your conviction. Your friend responds to that version, which reinforces it.
  </p>
  <p>
  By the time you get home the date in your memory is not the date that happened. It is a polemic, with you as either the prosecutor or the defendant.
  </p>
  <p>
  This is universal. This is not a sign of weakness. This is what the human brain does with high-stimulus social events. It compresses them into a shape that makes them easier to file.
  </p>
  <p>
  The problem is the shape is almost always wrong.
  </p>

  <h2>The two-pass method</h2>
  <p>
  I have a rule for myself that has saved me a lot of misery. I am not allowed to draw conclusions about a date until twelve hours later.
  </p>
  <p>
  First pass, in the immediate aftermath, I am allowed to write down only facts and only sentences they said that I can quote.
  </p>
  <p>
  What time it ended. Where we went. Three things they said, verbatim. One thing I said, verbatim. Whether we hugged. Whether one of us suggested another drink. Whether the goodbye felt long or short.
  </p>
  <p>
  That is it. No verdict. No feelings. No predictions. Facts only.
  </p>
  <p>
  Second pass, the next morning, with coffee, I write the actual reflection. Now I can ask the better questions. What did I notice that I want to keep noticing. Where did the conversation go somewhere I did not expect. What did they do that made me want to see them again, if anything. What did I do that I want to do less of.
  </p>
  <p>
  The morning version is almost always more accurate than the night version. Not always. Almost always.
  </p>

  <h2>What to skip</h2>
  <p>
  Skip the "did they like me" question. It is the wrong question and it is also unanswerable in the first twelve hours. Your read on it will swing wildly with your blood sugar.
  </p>
  <p>
  Skip the strategic reflection. Whether to text first, when to text, what to say. Those are downstream questions. If the date had genuine contact in it, the text writes itself. If it did not, no amount of strategising will manufacture one.
  </p>
  <p>
  Skip the comparison to other dates. Every date is its own object. Stacking it against the last three flattens what was specific about this one.
  </p>

  <h2>The one question worth asking immediately</h2>
  <p>
  There is exactly one question worth asking in the first hour. When did I feel most like myself.
  </p>
  <p>
  That is it. It is fast, it is honest, and it does not require any conclusions about how it went or what comes next. It just marks a moment for you. Later you can look back and ask what was happening in that moment, and that is usually where the real signal lives.
  </p>
  <p>
  I went on a date last fall where the only moment I felt fully like myself was a five-minute stretch about the bus system. Sounds ridiculous. It was. But that moment told me something about her, which was that she was actually listening, and something about me, which was that I am a person who comes alive when allowed to be a little weird. Those were both worth knowing.
  </p>

  <h2>When the spiral is information</h2>
  <p>
  Sometimes the spiral is not noise. Sometimes it is telling you something specific you do not want to face.
  </p>
  <p>
  If you cannot stop replaying a particular moment, that moment is doing work. Either it landed badly and you know it, or it landed well and you are scared of how much you wanted it to land well. Both of those are worth sitting with, just not in the first hour.
  </p>
  <p>
  If you find yourself drafting a text apology for something they did not actually mind, you are in a self-attack spiral. Different problem, different fix, mostly involves not sending the text.
  </p>
  <p>
  If you find yourself preemptively writing them off before they have even had a chance to text you, you are running an avoidance pattern. Worth noticing. Not worth obeying.
  </p>

  <h2>The longer game</h2>
  <p>
  The point of post-date reflection is not to grade the date. It is to get slightly better at reading what happens between you and another person. That is a skill. It compounds.
  </p>
  <p>
  You will get better at it by writing small notes, twelve hours after the event, that are honest about what you noticed. You will not get better at it by analysing each date to death the same night.
  </p>
  <p>
  The spiral feels productive. It is mostly not.
  </p>
  </>
  ),

  "when-to-delete-the-apps-actually": (
  <>
  <p>
  I have deleted the dating apps from my phone seven times. I have reinstalled them six. The math suggests I will keep doing this. The math is probably right.
  </p>
  <p>
  The question is not whether deleting is a permanent solution. It is not. The question is when it actually helps versus when it is theatre.
  </p>
  <p>
  Most "I deleted the apps" announcements are theatre. The person is performing a decision they have not actually made. They will be back inside ten days, often inside three.
  </p>
  <p>
  That is fine. The theatre is sometimes useful. But you should know which version you are doing, because the real one and the theatrical one require different reasons.
  </p>

  <h2>When you should actually delete</h2>
  <p>
  There is a specific cluster of signals that tells you a real delete is the right call. These are the signs that the apps are extracting more from you than they are giving back, by a margin that has stopped being sustainable.
  </p>
  <p>
  You open the app and immediately feel a small dread before you swipe.
  </p>
  <p>
  You can no longer remember the names of the people you matched with this week.
  </p>
  <p>
  You have had three or more dates in a row where you knew within fifteen minutes that you were not interested, and went through with them anyway because you had nothing else going on.
  </p>
  <p>
  Your last good first date was over four months ago.
  </p>
  <p>
  You have stopped opening matches' profiles before replying to their first message.
  </p>
  <p>
  You catch yourself thinking "what is the point of this" multiple times a week, not as a thought to engage with but as ambient static.
  </p>
  <p>
  Three or more of those, and a delete is overdue.
  </p>

  <h2>When deleting is a mistake</h2>
  <p>
  There is also a cluster that tells you deleting will hurt more than help. You should not delete when the apps are mostly fine and a single hard interaction has thrown you off. Take a 48-hour break instead.
  </p>
  <p>
  You should not delete after a date that did not go well, in the immediate aftermath, while you are still vibrating from it. You will reinstall in three days, feel worse for having reinstalled, and convict yourself for being weak. Wait until you are calm.
  </p>
  <p>
  You should not delete because someone you respect told you to. The instinct is correct. The reasoning needs to be yours. You will not stick to a decision someone else made for you.
  </p>
  <p>
  You should not delete to send a signal to a specific person. That is not deleting. That is messaging. They will not see it. You will be the only person affected.
  </p>

  <h2>The half-delete that does not work</h2>
  <p>
  A lot of people do the half-delete where they turn off notifications, hide the apps in a folder, and tell themselves they will only check once a day. Inside a week the once-a-day rule is gone.
  </p>
  <p>
  The half-delete does not work because the friction is not high enough. The whole point of deleting is to put a small barrier between the impulse and the action. A folder is not a barrier. Notifications-off is not a barrier. The home screen icon being absent is a barrier. The reinstall flow is a barrier. The login again is a barrier.
  </p>
  <p>
  If you want a real break, take a real one. If you want to keep checking, keep checking, just without lying to yourself about it.
  </p>

  <h2>What to do during the delete</h2>
  <p>
  Almost nothing. That is the part most people skip.
  </p>
  <p>
  There is an instinct to fill the time with self-improvement. New workout plan. Reading list. Better skincare. The instinct is well-meaning. The execution is suspicious.
  </p>
  <p>
  The point of the delete is not to come back as a better version of yourself who deserves better matches. The point is to come back as the same version of yourself who has remembered what your dating life is supposed to feel like.
  </p>
  <p>
  That second thing requires nothing. It requires sitting in the slight discomfort of an unoccupied attentional space until something about that space starts to teach you.
  </p>
  <p>
  A delete that is structured as a self-improvement sprint is not really a delete. It is just a different kind of busyness with the same exhaustion at the end.
  </p>

  <h2>The reinstall</h2>
  <p>
  Most reinstalls are sloppy. You reinstall because you got bored, or because a friend mentioned someone, or because it is a Friday night and you are lonely.
  </p>
  <p>
  The clean reinstall has a reason. The reason can be small. I am ready to be in conversation with strangers again. I am curious about who is in the pool right now. I want one specific thing, which is a Sunday afternoon coffee with someone new.
  </p>
  <p>
  If you cannot finish the sentence "I am reinstalling because," do not reinstall yet. The apps will be there in a week. The desire to reinstall without a reason is the same desire that exhausted you last time.
  </p>

  <h2>The pattern</h2>
  <p>
  After the seventh delete I started writing down the reason each time. The reasons cluster. About a third of mine are real fatigue. About a third are post-bad-date reactions, where I had no business deleting. About a third are quiet hopelessness that the apps did not cause.
  </p>
  <p>
  That data is useful. Most of my deletes were responses to feelings that were not really about the apps. The apps were the closest available object to throw the feeling at.
  </p>
  <p>
  Knowing that does not stop me from doing it. It just makes the next reinstall a little less embarrassing.
  </p>
  </>
  ),

  "taking-a-real-break-vs-avoiding": (
  <>
  <p>
  There is a difference between resting from dating and hiding from it. The two look identical from the outside. They feel identical from the inside, for a while. The difference shows up later, and by then you have either built something or wasted a season.
  </p>
  <p>
  A real break is a deliberate pause. You step away because the pace was too much, or because something in your life needs your attention, or because you want to come back sharper. You know roughly when you will come back. You are not making any decisions during the break. You are letting your nervous system reset so the next round of decisions is cleaner.
  </p>
  <p>
  Avoidance looks the same on day one. You delete the apps. You cancel a planned date. You stop telling friends to set you up. You tell yourself you are taking time.
  </p>
  <p>
  The difference is what is happening underneath.
  </p>

  <h2>The structural test</h2>
  <p>
  There is one question that separates the two. Honest answer required.
  </p>
  <p>
  What scares me about being available right now.
  </p>
  <p>
  If you can answer that, and the answer is something specific, you might be in avoidance dressed as rest. If you cannot answer that, or the answer is "nothing, I am just tired," you are probably actually resting.
  </p>
  <p>
  My answers, when I have been honest, have included things like: I am scared of what I will be asked to give up if I meet someone right now. I am scared of being seen at the weight I am currently at. I am scared of the conversations about my last relationship. I am scared of starting over for the fourth time this year.
  </p>
  <p>
  Those are real things. They are not bad things. They are not character flaws. But they are not "I am tired and need a break." They are reasons that need to be met directly, and a break alone will not meet them.
  </p>

  <h2>How avoidance behaves</h2>
  <p>
  Avoidance has a specific texture. It is the version of rest that does not actually rest you.
  </p>
  <p>
  A real break, after two or three weeks, leaves you feeling lighter. Curiosity comes back. You start noticing strangers again on the train. You start thinking about a specific date scenario without flinching.
  </p>
  <p>
  Avoidance, after two or three weeks, leaves you in the same place. The flinch is still there. The thought of being available still feels heavy. You start making a case for staying out indefinitely. You start telling yourself you are happier alone, in a tone that does not sound like someone who is happier alone.
  </p>
  <p>
  The tell is the tone. People who are actually content single talk about it lightly. People who are avoiding talk about it with a small edge.
  </p>

  <h2>What to do if it is avoidance</h2>
  <p>
  The first thing is not to start dating again right away. That is a common mistake. The reasoning is "I need to push through it." The result is forcing yourself onto a few dates that confirm all the fears, which strengthens the avoidance.
  </p>
  <p>
  The better move is to address what you are avoiding directly, separately from the apps. If the fear is about your body, work with that. If the fear is about being asked about your last relationship, write your answer down so it stops being a panic surface. If the fear is about starting over, name that out loud to a friend.
  </p>
  <p>
  The apps come back online when the fear is not running the show. Not before. You can tell because the thought of an opening message feels neutral instead of nauseating.
  </p>

  <h2>What to do if it is rest</h2>
  <p>
  Different protocol. With rest, the work is to actually rest, which is harder than it sounds.
  </p>
  <p>
  Stop researching dating. Stop reading the discourse. Stop following the dating creators. Stop having the conversations with friends about who is dating whom. Stop tracking the meta-game.
  </p>
  <p>
  The reset only works if you stop the meta as well as the actual swiping. Otherwise the system stays activated and the break stops being a break.
  </p>
  <p>
  Set a soft end. Three weeks is a good default. You can extend it. You should not shorten it. The shortening impulse is almost always the wrong impulse.
  </p>
  <p>
  Plan one thing for after that has nothing to do with dating. A trip with a friend. A class. A weekend you have not had for a year. Something that lives entirely in your single life and does not require a partner to be good.
  </p>
  <p>
  Then actually stop thinking about dating for the duration. The not-thinking is the medicine.
  </p>

  <h2>The harder version</h2>
  <p>
  Sometimes the right call is neither a rest nor a continued grind. It is sitting with whatever is showing up when the dating stops, and not running back to the dating to avoid it.
  </p>
  <p>
  This is the hardest version. Almost nobody volunteers for it. I did it once, accidentally, after a hard breakup, and it changed the shape of my next year in a way I would not undo.
  </p>
  <p>
  I did not learn anything mystical. I just learned what I was using dating to outrun. Mostly it was the loneliness of evenings, which I had been spackling over with conversations that did not need to happen. Once I could sit through the evenings without the spackle, the version of dating I came back to was different. I had less to ask of it. The dates were better because they were not also providing emergency relief.
  </p>

  <h2>The part that has to be yours</h2>
  <p>
  I am not going to tell you which one you are doing. I do not know. You know. The question is whether you are willing to ask yourself honestly enough to find out.
  </p>
  <p>
  The two versions look the same for the first ten days. They diverge on day fourteen. If by week three you still cannot tell, that is itself information. Probably avoidance. Probably not fatal. Probably worth a conversation with someone who knows you well enough to push back.
  </p>
  </>
  ),

  "micro-rituals-between-dates": (
  <>
  <p>
  A friend of mine has a thing she does before every first date. She walks the long way to the venue, takes a slightly different route than her phone recommends, and on the walk she lists three things in her week she is actually looking forward to that have nothing to do with the date.
  </p>
  <p>
  She told me this in passing. I have stolen it. It is one of the best dating habits I have picked up from another human.
  </p>
  <p>
  She did not call it a ritual. She called it "the walk." That is exactly the right register for what micro-rituals between dates should be. Small. Specific. Unromantic about themselves. They do their work in the background.
  </p>

  <h2>Why micro-rituals matter</h2>
  <p>
  Dating is full of high-stakes moments and almost no infrastructure between them. You go on a date. The date ends. Then there is a stretch of hours or days where nothing structurally is happening but a lot is happening in your head.
  </p>
  <p>
  Without something to do with that space, the space fills with rumination, replay, and the slow accumulation of low-grade anxiety about the next interaction. With something to do, even something tiny, the space stays clean.
  </p>
  <p>
  The rituals are not about being calm. They are about giving the in-between time a shape, so it stops bleeding into the dates themselves.
  </p>

  <h2>The shape that works</h2>
  <p>
  A micro-ritual has four properties.
  </p>
  <p>
  It is short. Under fifteen minutes, usually under five.
  </p>
  <p>
  It is specific. The same thing each time, not a vague intention.
  </p>
  <p>
  It is physical. Something you do with your body, not just your thoughts. The body remembers what the mind forgets.
  </p>
  <p>
  It is not about the dating. The ritual exists adjacent to the dating, not in service of it. The moment it becomes a strategy, it stops working.
  </p>
  <p>
  Most rituals that fail fail because they are too big, too vague, too cerebral, or too instrumental.
  </p>

  <h2>Examples that work for me</h2>
  <p>
  Before a first date. Twenty minutes earlier than I need to leave. I sit on my couch with a glass of water and listen to one song. The same song each time. It has nothing to do with romance. It is a song I associate with a specific friend who is dead and whose company I would have wanted before doing a thing like this. It centers me without me having to perform centering myself.
  </p>
  <p>
  After a first date. A walk home, even if I took transit there. Even ten minutes of walking. I do not let myself text anyone about the date during the walk. I let the date stay just mine for that walk.
  </p>
  <p>
  The morning after. I make a real coffee, in the French press, not the espresso machine. Slower process. It forces me to spend four extra minutes standing in the kitchen, which is when I usually write the second-pass note about the date.
  </p>
  <p>
  Between threads with the same person. Before I reply to a long message, I read it twice. The second read always tells me something the first did not. The reply gets sent slower as a result. The reply is also almost always better.
  </p>
  <p>
  None of these are profound. That is the point. They are tiny grooves in the week that hold the dating part of my life from sloshing into the rest.
  </p>

  <h2>Examples I have stolen from other people</h2>
  <p>
  A woman I know writes the venue's address on her arm in pen before a first date. She has used GPS plenty of times. She does it anyway. She says the act of writing the address is a small announcement to herself that the night is real and she has chosen it.
  </p>
  <p>
  A friend of mine has a "no apps after 10pm" rule on weeknights. Not aspirational. Actual. His phone literally hides them after ten. He told me his dating got noticeably less anxious within a month of starting it.
  </p>
  <p>
  Another friend has a small box on her desk where she puts a folded piece of paper after every date with a one-word verdict on it. "Sharp." "Boring." "Curious." "No." Once a quarter she empties the box and reads the words. She says it shows her things her brain has been hiding.
  </p>

  <h2>What does not count as a ritual</h2>
  <p>
  Lighting a candle and journaling about your worth for forty minutes is not a ritual. It is a performance of self-care, and you will not do it next week.
  </p>
  <p>
  Going to a yoga class because you have a date that night is not a ritual. It is just yoga, with a date attached.
  </p>
  <p>
  Calling your friend after every date is not a ritual. It is offloading. The ritual would be sitting with the date for a defined period before you call.
  </p>
  <p>
  The line between a ritual and a coping strategy is thin. Coping strategies are reactive. Rituals are anticipatory. Coping strategies discharge feeling. Rituals contain it.
  </p>

  <h2>Building your own</h2>
  <p>
  Start with one. Not three. Not a system. One.
  </p>
  <p>
  Pick the moment in your dating week that consistently feels the worst. Not the worst once. The reliably worst. For most people it is the hour after a date, or the morning after a non-response, or the Sunday evening of a slow week.
  </p>
  <p>
  Build the smallest possible thing you will do in that moment. It can be a song. A walk. A specific drink. A page of writing. Whatever you will actually do.
  </p>
  <p>
  Do it for a month. Do not evaluate it until then. The rituals that work are the ones that compound, and you cannot feel the compound after two reps.
  </p>
  <p>
  Then maybe add a second. Maybe not. One real ritual beats four aspirational ones.
  </p>
  <p>
  The dating itself will not be different because of the ritual. You will be different because of the ritual. That difference shows up in the dating.
  </p>
  </>
  ),

  "the-sunday-night-wind-down-with-yourself": (
  <>
  <p>
  Sunday night is the most underrated hour in a dater's week. Most people waste it on dread about Monday. The ones who use it well get something back that no other time of the week offers.
  </p>
  <p>
  I started running what I call a wind-down conversation with myself on Sunday nights about two years ago. It takes between twenty and forty minutes. It does not require a notebook, though I sometimes use one. It does not require any app, though the Mirror in this one is useful for the last part. It mostly requires being alone, slightly tired, and willing to ask three or four questions honestly.
  </p>
  <p>
  I am going to walk you through the version I run. You can steal the parts that work and discard the rest.
  </p>

  <h2>Why Sunday night specifically</h2>
  <p>
  Sunday night sits at a useful place in the week. You have enough distance from the week's events to see them with some perspective. You do not yet have Monday on top of you, demanding you be functional. You are usually slightly soft from the weekend, which makes you more honest with yourself than the harder weekday version of you tends to be.
  </p>
  <p>
  If the week had anything dating-related in it, by Sunday you have stopped reacting to it and started seeing it. Reactions are loud. Seeing is quiet. Sunday is quiet.
  </p>

  <h2>The structure</h2>
  <p>
  Four questions, in order. The order matters. The order is doing work even if it does not look like it.
  </p>
  <p>
  One. What actually happened this week.
  </p>
  <p>
  Not how I felt about it. Not what I made of it. What happened. Two dates. Three threads. A match I ghosted. A friend who said something useful. The bare events. Naming them in your head, or on a piece of paper, is the first move. You cannot reflect on a week you have not named.
  </p>
  <p>
  Two. Where was I sharp and where was I dull.
  </p>
  <p>
  This is a behavior question, not a personality one. Where did I show up well, where did I show up poorly. Specific moments. The reply I drafted carefully. The reply I fired off without reading. The date where I asked the second question. The date where I monologued for ten minutes about my job. The texture of my own performance over the week.
  </p>
  <p>
  Three. What did I notice about other people that I want to keep noticing.
  </p>
  <p>
  This one is easy to skip and important not to skip. It pulls the attention off the self-grading. You are not the only person who showed up this week. The thing the person across the table from you said on Tuesday is worth holding onto. Their pause when you asked something. Their face when you said the wrong thing. Their small kindness when you were nervous. These build the library of how to read people, which is the actual skill underneath dating.
  </p>
  <p>
  Four. What am I bringing into next week, on purpose.
  </p>
  <p>
  Not goals. Not resolutions. Just one or two things you are choosing to carry. A question you want to ask on the next first date. A pattern you noticed in yourself you want to interrupt. A conversation with a friend you want to have. A specific person you want to text. Small. Specific. Pickable.
  </p>

  <h2>What it is not</h2>
  <p>
  It is not a planning session. Resist the urge to schedule the week, or to draft messages, or to pre-think dates. The wind-down is a different mode. Planning will hijack it if you let it.
  </p>
  <p>
  It is not a venting session. Venting feels good and accomplishes nothing. If you find yourself slipping into a vent, redirect with the second question. Sharp and dull. Specific moments. That keeps you from spiraling into general dissatisfaction.
  </p>
  <p>
  It is not a journal entry. The wind-down can produce notes, but the notes are a byproduct. The point is the thinking, not the artifact.
  </p>

  <h2>What changes after a few months of it</h2>
  <p>
  Three things, in my experience.
  </p>
  <p>
  You stop being surprised by your own week. The week stops washing over you in a blur. You start the next week with a clearer sense of what is actually happening in your dating life, which means fewer decisions get made out of fog.
  </p>
  <p>
  You start to see your patterns earlier. The thing that took six months to notice last year takes six weeks to notice now. The compound on the noticing is real.
  </p>
  <p>
  You start to like Sunday night. This was the most surprising thing for me. The night I used to half-dread became, after maybe three months, the night I looked forward to most. Not because the rest of the week got worse. Because Sunday night got more useful.
  </p>

  <h2>When to skip it</h2>
  <p>
  Sometimes you should not run the wind-down. Weeks where something hard happened. Weeks where you are sick. Weeks where you went to bed early on Sunday because Sunday brunch ran long. Skip those. The practice should serve you, not the other way around.
  </p>
  <p>
  A wind-down that becomes obligatory is a wind-down that has lost the plot. The point is to use the time well. If using it well looks like sleep this week, sleep is the right call.
  </p>

  <h2>The version that lasts</h2>
  <p>
  The version of this practice that lasts is the version you would still do if no one ever found out. No one is watching. The point is not to become the kind of person who has a Sunday ritual. The point is to spend twenty minutes of one night a week being honest with yourself about a part of your life that mostly happens too fast to see clearly.
  </p>
  <p>
  If you do that, with no audience, with no commitment longer than this Sunday, you will look up in a season and see that you have been paying attention to your own life. Which is, eventually, the thing that changes everything else.
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
  const { user } = useAuth();

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

  {/* CTA, per-article when defined, otherwise generic audit CTA */}
  {(() => {
  const cta = article.cta ?? {
  title: "Get your free Profile Signal Audit",
  body: "Find out exactly what your profile is communicating. Signal Score, bio critique, prompt rewrites, and a 7-day action plan.",
  href: "/start",
  label: "Start free audit, takes 3 minutes",
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

  {/* Related quiz (if blog post has a matching quiz) */}
  {(() => {
  const quizSlug = QUIZ_BY_BLOG_SLUG[article.slug];
  const quiz = quizSlug ? getQuizBySlug(quizSlug) : undefined;
  if (!quiz) return null;
  return (
  <motion.div
  {...fadeUp(0.22)}
  className="mt-8 glass rounded-2xl p-6"
  style={{ borderColor: withAlpha(article.color, 0.25), borderWidth: "1px", borderStyle: "solid" }}
  >
  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50 mb-2">Related quiz</p>
  <h3 className="font-serif text-lg font-bold text-foreground mb-2">{quiz.emoji} {quiz.title}</h3>
  <p className="text-sm text-muted-foreground mb-4">{quiz.pitch}</p>
  <Link
  href={`/quiz/${quiz.slug}`}
  onClick={() => trackEvent("blog_related_quiz_click", { blog_slug: article.slug, quiz_slug: quiz.slug })}
  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 transition-colors text-sm font-semibold text-foreground"
  >
  Take the quiz <ArrowRight className="w-3.5 h-3.5" />
  </Link>
  </motion.div>
  );
  })()}

  {/* Share */}
  <motion.div {...fadeUp(0.23)} className="mt-8 flex justify-center">
  <ShareButton
  surface="blog-post"
  title={article.title}
  text={article.excerpt}
  path={`/blog/${article.slug}`}
  ref={user?.id ? `user-${user.id}` : article.slug}
  variant="ghost"
  label="Share this piece"
  copiedLabel="Link copied"
  testId={`share-blog-${article.slug}`}
  />
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