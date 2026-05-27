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
    excerpt:
      "Your bio says you love hiking and good coffee. But what it's communicating is something entirely different — and that gap is exactly why you're not getting the matches you want.",
    category: "Profile Science",
    readMin: 7,
    date: "May 2026",
    color: "hsl(248 62% 52%)",
  },
  {
    slug: "the-science-of-message-coaching",
    title: "The Science Behind Why Some Messages Get Replies and Others Don't",
    excerpt:
      "Researchers have analysed millions of dating app conversations. The patterns are surprisingly consistent — and almost none of them are about being clever or funny.",
    category: "Message Coaching",
    readMin: 8,
    date: "May 2026",
    color: "hsl(190 75% 50%)",
  },
  {
    slug: "red-flags-in-your-own-profile",
    title: "The 7 Subtle Red Flags in Your Own Profile You Can't See Yourself",
    excerpt:
      "These aren't the obvious ones. They're the quiet signals that make someone feel vaguely uneasy and swipe left before they can even articulate why.",
    category: "Profile Audit",
    readMin: 6,
    date: "April 2026",
    color: "hsl(348 55% 65%)",
  },
  {
    slug: "photo-psychology-dating-apps",
    title: "Photo Psychology: What Your Dating App Photos Are Really Saying",
    excerpt:
      "Photo order, solo vs. group shots, eye contact, smile type — every choice in your photo lineup sends a signal. Here's what the research actually says.",
    category: "Photo Psychology",
    readMin: 9,
    date: "April 2026",
    color: "hsl(43 65% 65%)",
  },
];
