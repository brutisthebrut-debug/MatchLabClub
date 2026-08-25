import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { lazy, Suspense, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useClaimAnonymousOnLogin } from "@/hooks/useClaimAnonymousOnLogin";
import { usePageTracking } from "@/hooks/usePageTracking";
import { useAuth } from "@workspace/replit-auth-web";
import {
  useGetAccountSummary,
  getGetAccountSummaryQueryKey,
  useListWellnessAnswers,
  getListWellnessAnswersQueryKey,
} from "@workspace/api-client-react";
import { hasCompletedOnboarding } from "@/lib/onboardingState";
import {
  PROFILE_PROJECT_AUDIT_CAPTURE_HREF,
  profileProjectAuditHistoryHref,
} from "@/lib/profileProjectRoutes";

// Route-level code splitting — each page loads only when first visited.
const NotFound = lazy(() => import("@/pages/not-found"));
const Landing = lazy(() => import("@/pages/Landing"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Coach = lazy(() => import("@/pages/Coach"));
const DateSafety = lazy(() => import("@/pages/DateSafety"));
const RehearsalRoom = lazy(() => import("@/pages/RehearsalRoom"));
const Insights = lazy(() => import("@/pages/Insights"));
const Integrations = lazy(() => import("@/pages/Integrations"));
const Pricing = lazy(() => import("@/pages/Pricing"));
const Waitlist = lazy(() => import("@/pages/Waitlist"));
const Lab = lazy(() => import("@/pages/Lab"));
const Roadmap = lazy(() => import("@/pages/Roadmap"));
const Privacy = lazy(() => import("@/pages/Privacy"));
const Terms = lazy(() => import("@/pages/Terms"));
const Checkout = lazy(() => import("@/pages/Checkout"));
const CheckoutSuccess = lazy(() => import("@/pages/CheckoutSuccess"));
const CheckoutCancel = lazy(() => import("@/pages/CheckoutCancel"));
const Founder = lazy(() => import("@/pages/Founder"));
const ShebangsPartner = lazy(() => import("@/pages/ShebangsPartner"));
const MirrorProfile = lazy(() => import("@/pages/MirrorProfile"));
const YourMirror = lazy(() => import("@/pages/YourMirror"));
const Echo = lazy(() => import("@/pages/Echo"));
const HowItWorks = lazy(() => import("@/pages/HowItWorks"));
const Archetype = lazy(() => import("@/pages/Archetype"));
const Reflection = lazy(() => import("@/pages/Reflection"));
const ProfileReader = lazy(() => import("@/pages/ProfileReader"));
const StyleMap = lazy(() => import("@/pages/StyleMap"));
const NextMessage = lazy(() => import("@/pages/NextMessage"));
const CareDialect = lazy(() => import("@/pages/CareDialect"));
const CompatibilityCompass = lazy(() => import("@/pages/CompatibilityCompass"));
const ProgressTimeline = lazy(() => import("@/pages/ProgressTimeline"));
const ProgressPatterns = lazy(() => import("@/pages/ProgressPatterns"));
const ProgressExperiments = lazy(() => import("@/pages/ProgressExperiments"));
const ProgressFollowUp = lazy(() => import("@/pages/ProgressFollowUp"));
const ProgressScorecard = lazy(() => import("@/pages/ProgressScorecard"));
const ProgressFeed = lazy(() => import("@/pages/ProgressFeed"));
const ProgressControl = lazy(() => import("@/pages/ProgressControl"));
const ProgressInsightsRoadmap = lazy(() => import("@/pages/ProgressInsightsRoadmap"));
const ProgressReadiness = lazy(() => import("@/pages/ProgressReadiness"));
const ProgressCompanion = lazy(() => import("@/pages/ProgressCompanion"));
const WellnessCenter = lazy(() => import("@/pages/WellnessCenter"));
const UserControl = lazy(() => import("@/pages/UserControl"));
const LifeContext = lazy(() => import("@/pages/LifeContext"));
const FutureConnections = lazy(() => import("@/pages/FutureConnections"));
const Copilot = lazy(() => import("@/pages/Copilot"));
const StartMyReset = lazy(() => import("@/pages/copilot/StartMyReset"));
const HelpMeReply = lazy(() => import("@/pages/copilot/HelpMeReply"));
const DebriefWhatHappened = lazy(() => import("@/pages/copilot/DebriefWhatHappened"));
const WeeklyGrowthPlan = lazy(() => import("@/pages/copilot/WeeklyGrowthPlan"));
const PrepareForDate = lazy(() => import("@/pages/copilot/PrepareForDate"));
const FlirtCoach = lazy(() => import("@/pages/copilot/FlirtCoach"));
const Account = lazy(() => import("@/pages/Account"));
const Sessions = lazy(() => import("@/pages/Sessions"));
const Quiz = lazy(() => import("@/pages/Quiz"));
const Gallery = lazy(() => import("@/pages/Gallery"));
const ConnectionCenter = lazy(() => import("@/pages/ConnectionCenter"));
const Matches = lazy(() => import("@/pages/Matches"));
const MatchThread = lazy(() => import("@/pages/MatchThread"));
const MatchPhotos = lazy(() => import("@/pages/MatchPhotos"));
const SourcePaste = lazy(() => import("@/pages/SourcePaste"));
const ThisOrThat = lazy(() => import("@/pages/ThisOrThat"));
const VoiceIntro = lazy(() => import("@/pages/VoiceIntro"));
const Receipts = lazy(() => import("@/pages/Receipts"));
const DataVault = lazy(() => import("@/pages/DataVault"));
const Imports = lazy(() => import("@/pages/Imports"));
const DatingWinsLog = lazy(() => import("@/pages/DatingWinsLog"));
const WouldYouRather = lazy(() => import("@/pages/WouldYouRather"));
const DailySpark = lazy(() => import("@/pages/DailySpark"));
const Flags = lazy(() => import("@/pages/Flags"));
const Cosmic = lazy(() => import("@/pages/Cosmic"));
const Scenarios = lazy(() => import("@/pages/Scenarios"));
const PredictYourself = lazy(() => import("@/pages/PredictYourself"));
const TimeCapsule = lazy(() => import("@/pages/TimeCapsule"));
const Wingman = lazy(() => import("@/pages/Wingman"));
const WingmanRespond = lazy(() => import("@/pages/WingmanRespond"));
const PatternBreaker = lazy(() => import("@/pages/PatternBreaker"));
const WhatChanged = lazy(() => import("@/pages/WhatChanged"));
const Feedback = lazy(() => import("@/pages/Feedback"));
const SampleReport = lazy(() => import("@/pages/SampleReport"));
const Scan = lazy(() => import("@/pages/Scan"));
const Trash = lazy(() => import("@/pages/Trash"));
const JournalPage = lazy(() => import("@/pages/mirror/JournalPage"));
const DatesPage = lazy(() => import("@/pages/mirror/DatesPage"));
const Blog = lazy(() => import("@/pages/Blog"));
const BlogPost = lazy(() => import("@/pages/BlogPost"));
const Quizzes = lazy(() => import("@/pages/Quizzes"));
const QuizPlay = lazy(() => import("@/pages/QuizPlay"));
const SelfHub = lazy(() => import("@/pages/SelfHub"));
const Matching = lazy(() => import("@/pages/Matching"));
const MatchPath = lazy(() => import("@/pages/MatchPath"));
const Verification = lazy(() => import("@/pages/Verification"));
const ShareCard = lazy(() => import("@/pages/ShareCard"));
const Milestones = lazy(() => import("@/pages/Milestones"));
const Onboarding = lazy(() => import("@/pages/Onboarding"));
const MemberDestination = lazy(() => import("@/pages/MemberDestination"));
const MyMatchLab = lazy(() => import("@/pages/MyMatchLab"));
const ProfileProject = lazy(() => import("@/pages/ProfileProject"));

const queryClient = new QueryClient();

function ClaimAnonymousGate() {
  useClaimAnonymousOnLogin();
  return null;
}

// First-run gate. Sends a brand-new authenticated user into the guided onboarding
// flow exactly once, only when they land on a home surface (/your-mirror, /me, or
// /dashboard) and the account has no real signal yet. A returning user with any
// data, or anyone who has finished or skipped onboarding in this browser, is never
// redirected.
const ONBOARDING_ENTRY_ROUTES = new Set([
  "/today",
  "/dashboard",
  "/me",
  "/your-mirror",
]);

function OnboardingGate() {
  const [location, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const enabled = isAuthenticated && !hasCompletedOnboarding();

  const summary = useGetAccountSummary({
    query: { queryKey: getGetAccountSummaryQueryKey(), enabled },
  });
  const wellness = useListWellnessAnswers(undefined, {
    query: { queryKey: getListWellnessAnswersQueryKey(), enabled },
  });

  useEffect(() => {
    if (!enabled) return;
    if (!ONBOARDING_ENTRY_ROUTES.has(location)) return;
    if (summary.isLoading || wellness.isLoading) return;

    const s = summary.data;
    const answerCount = wellness.data?.answers?.length ?? 0;
    const hasSignal =
      (s?.audits ?? 0) > 0 ||
      (s?.profiles ?? 0) > 0 ||
      (s?.journalEntries ?? 0) > 0 ||
      (s?.postDateNotes ?? 0) > 0 ||
      answerCount > 0;

    if (!hasSignal) setLocation("/onboarding");
  }, [
    enabled,
    location,
    summary.isLoading,
    summary.data,
    wellness.isLoading,
    wellness.data,
    setLocation,
  ]);

  return null;
}

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    // Skip when the URL has an in-page anchor (e.g. /pricing#faq).
    if (typeof window === "undefined") return;
    if (window.location.hash && window.location.hash.length > 1) return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location]);
  return null;
}

function Router() {
  usePageTracking();
  return (
    <Suspense fallback={null}>
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/today" component={MemberDestination} />
        <Route path="/my-matchlab/profile" component={ProfileProject} />
        <Route path="/my-matchlab" component={MyMatchLab} />
        <Route path="/journey" component={MemberDestination} />
        <Route path="/play" component={MemberDestination} />
        <Route path="/trust-data" component={MemberDestination} />
        {/* Audit capture/generation is owned by Profile Project. */}
        <Route path="/start">
          <Redirect to={PROFILE_PROJECT_AUDIT_CAPTURE_HREF} />
        </Route>
        <Route path="/dashboard" component={Dashboard} />
        {/* Preserve durable report deep links while reopening the same audit in
            the canonical history surface. */}
        <Route path="/report/:id">
          {(params: { id?: string } | null) => (
            <Redirect
              to={profileProjectAuditHistoryHref(params?.id)}
            />
          )}
        </Route>
        <Route path="/coach" component={Coach} />
        <Route path="/date-safety" component={DateSafety} />
        <Route path="/rehearsal" component={RehearsalRoom} />
        <Route path="/insights" component={Insights} />
        <Route path="/integrations" component={Integrations} />
        <Route path="/connections/add/:source" component={SourcePaste} />
        <Route path="/this-or-that" component={ThisOrThat} />
        <Route path="/voice-intro" component={VoiceIntro} />
        <Route path="/receipts" component={Receipts} />
        <Route path="/pricing" component={Pricing} />
        <Route path="/waitlist" component={Waitlist} />
        {/* Signal Check's own-profile read is absorbed into the evidence-gated
            Profile Project capture. Both old entry URLs remain redirects. */}
        <Route path="/diagnosis">
          <Redirect to={PROFILE_PROJECT_AUDIT_CAPTURE_HREF} />
        </Route>
        <Route path="/lab" component={Lab} />
        {/* Photo Lab is fully absorbed into the durable Profile Project.
            Keep the old URL as a compatibility redirect for saved links. */}
        <Route path="/photo-lab">
          <Redirect to="/my-matchlab/profile" />
        </Route>
        <Route path="/signal-check">
          <Redirect to={PROFILE_PROJECT_AUDIT_CAPTURE_HREF} />
        </Route>
        <Route path="/roadmap" component={Roadmap} />
        <Route path="/privacy" component={Privacy} />
        <Route path="/terms" component={Terms} />
        <Route path="/checkout/success" component={CheckoutSuccess} />
        <Route path="/checkout/cancel" component={CheckoutCancel} />
        <Route path="/checkout/:product">
          {(params: { product?: string } | null) => <Checkout product={params?.product ?? "dating-reset"} />}
        </Route>
        <Route path="/founder" component={Founder} />
        <Route path="/partners/shebangs" component={ShebangsPartner} />
        {/* New coaching modules */}
        {/* Preserved deep link; App owns the compatibility redirect while the
            reusable experience renders in My MatchLab and regression tests. */}
        <Route path="/blueprint">
          <Redirect to="/my-matchlab?communication=personal-blueprint" />
        </Route>
        <Route path="/mirror" component={MirrorProfile} />
        <Route path="/your-mirror" component={YourMirror} />
        <Route path="/echo" component={Echo} />
        <Route path="/how-it-works" component={HowItWorks} />
        <Route path="/mirror/journal" component={JournalPage} />
        <Route path="/mirror/dates" component={DatesPage} />
        <Route path="/archetype" component={Archetype} />
        <Route path="/reflection" component={Reflection} />
        <Route path="/profile-reader" component={ProfileReader} />
        <Route path="/style-map" component={StyleMap} />
        <Route path="/next-message" component={NextMessage} />
        <Route path="/glow-up">
          <Redirect to="/my-matchlab/profile" />
        </Route>
        {/* Preserved deep link into My MatchLab Communication. */}
        <Route path="/connection-style">
          <Redirect to="/my-matchlab?communication=connection-style" />
        </Route>
        <Route path="/care-dialect" component={CareDialect} />
        <Route path="/compatibility-compass" component={CompatibilityCompass} />
        {/* Progress Workspace */}
        <Route path="/progress/timeline" component={ProgressTimeline} />
        <Route path="/progress/patterns" component={ProgressPatterns} />
        <Route path="/progress/experiments" component={ProgressExperiments} />
        <Route path="/progress/followup" component={ProgressFollowUp} />
        <Route path="/progress/scorecard" component={ProgressScorecard} />
        <Route path="/progress/feed" component={ProgressFeed} />
        <Route path="/progress/control" component={ProgressControl} />
        <Route path="/progress/insights-roadmap" component={ProgressInsightsRoadmap} />
        <Route path="/progress/readiness" component={ProgressReadiness} />
        <Route path="/progress/companion" component={ProgressCompanion} />
        {/* Wellness & Control */}
        <Route path="/wellness" component={WellnessCenter} />
        <Route path="/user-control" component={UserControl} />
        <Route path="/life-context" component={LifeContext} />
        <Route path="/future-connections" component={FutureConnections} />
        {/* Copilot / Wingman Studio */}
        <Route path="/copilot" component={Copilot} />
        <Route path="/copilot/reset" component={StartMyReset} />
        <Route path="/copilot/reply" component={HelpMeReply} />
        <Route path="/copilot/profile">
          <Redirect to="/my-matchlab/profile" />
        </Route>
        <Route path="/copilot/debrief" component={DebriefWhatHappened} />
        <Route path="/copilot/weekly-plan" component={WeeklyGrowthPlan} />
        <Route path="/copilot/prep" component={PrepareForDate} />
        <Route path="/copilot/flirt" component={FlirtCoach} />
        <Route path="/me" component={SelfHub} />
        <Route path="/onboarding" component={Onboarding} />
        <Route path="/matching" component={Matching} />
        <Route path="/match-path" component={MatchPath} />
        <Route path="/verification" component={Verification} />
        <Route path="/share-card" component={ShareCard} />
        <Route path="/milestones" component={Milestones} />
        <Route path="/account" component={Account} />
        <Route path="/account/sessions" component={Sessions} />
        <Route path="/quiz" component={Quiz} />
        <Route path="/gallery" component={Gallery} />
        <Route path="/connections" component={ConnectionCenter} />
        <Route path="/matches" component={Matches} />
        <Route path="/matches/:id" component={MatchThread} />
        <Route path="/photos" component={MatchPhotos} />
        <Route path="/vault" component={DataVault} />
        <Route path="/imports" component={Imports} />
        <Route path="/progress/wins" component={DatingWinsLog} />
        <Route path="/games/would-you-rather" component={WouldYouRather} />
        <Route path="/games/daily-spark" component={DailySpark} />
        <Route path="/flags" component={Flags} />
        <Route path="/cosmic" component={Cosmic} />
        <Route path="/games/scenarios" component={Scenarios} />
        <Route path="/games/predict" component={PredictYourself} />
        <Route path="/games/time-capsule" component={TimeCapsule} />
        <Route path="/wingman" component={Wingman} />
        <Route path="/wingman/r/:token" component={WingmanRespond} />
        <Route path="/progress/pattern-breaker" component={PatternBreaker} />
        <Route path="/copilot/what-changed" component={WhatChanged} />
        <Route path="/feedback" component={Feedback} />
        <Route path="/sample-report" component={SampleReport} />
        <Route path="/scan" component={Scan} />
        <Route path="/trash" component={Trash} />
        <Route path="/quizzes" component={Quizzes} />
        <Route path="/quizzes/:slug">
          {(params: { slug?: string } | null) => <QuizPlay slug={params?.slug ?? ""} />}
        </Route>
        <Route path="/blog" component={Blog} />
        <Route path="/blog/:slug">
          {(params: { slug?: string } | null) => <BlogPost slug={params?.slug ?? ""} />}
        </Route>
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ClaimAnonymousGate />
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <ScrollToTop />
          <OnboardingGate />
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
