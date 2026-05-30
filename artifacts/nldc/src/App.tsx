import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import Wizard from "@/pages/Wizard";
import Dashboard from "@/pages/Dashboard";
import Report from "@/pages/Report";
import Coach from "@/pages/Coach";
import Insights from "@/pages/Insights";
import Integrations from "@/pages/Integrations";
import Pricing from "@/pages/Pricing";
import Waitlist from "@/pages/Waitlist";
import Diagnosis from "@/pages/Diagnosis";
import Lab from "@/pages/Lab";
import SignalCheck from "@/pages/SignalCheck";
import Roadmap from "@/pages/Roadmap";
import Privacy from "@/pages/Privacy";
import Terms from "@/pages/Terms";
import Checkout from "@/pages/Checkout";
import CheckoutSuccess from "@/pages/CheckoutSuccess";
import CheckoutCancel from "@/pages/CheckoutCancel";
import Founder from "@/pages/Founder";
import ShebangsPartner from "@/pages/ShebangsPartner";
import Blueprint from "@/pages/Blueprint";
import MirrorProfile from "@/pages/MirrorProfile";
import YourMirror from "@/pages/YourMirror";
import Archetype from "@/pages/Archetype";
import Reflection from "@/pages/Reflection";
import ProfileReader from "@/pages/ProfileReader";
import StyleMap from "@/pages/StyleMap";
import NextMessage from "@/pages/NextMessage";
import GlowUp from "@/pages/GlowUp";
import ConnectionStyle from "@/pages/ConnectionStyle";
import CompatibilityCompass from "@/pages/CompatibilityCompass";
import ProgressTimeline from "@/pages/ProgressTimeline";
import ProgressPatterns from "@/pages/ProgressPatterns";
import ProgressExperiments from "@/pages/ProgressExperiments";
import ProgressFollowUp from "@/pages/ProgressFollowUp";
import ProgressScorecard from "@/pages/ProgressScorecard";
import ProgressFeed from "@/pages/ProgressFeed";
import ProgressControl from "@/pages/ProgressControl";
import ProgressInsightsRoadmap from "@/pages/ProgressInsightsRoadmap";
import ProgressReadiness from "@/pages/ProgressReadiness";
import ProgressCompanion from "@/pages/ProgressCompanion";
import WellnessCenter from "@/pages/WellnessCenter";
import UserControl from "@/pages/UserControl";
import LifeContext from "@/pages/LifeContext";
import FutureConnections from "@/pages/FutureConnections";
import Copilot from "@/pages/Copilot";
import StartMyReset from "@/pages/copilot/StartMyReset";
import HelpMeReply from "@/pages/copilot/HelpMeReply";
import ImproveMyProfile from "@/pages/copilot/ImproveMyProfile";
import DebriefWhatHappened from "@/pages/copilot/DebriefWhatHappened";
import WeeklyGrowthPlan from "@/pages/copilot/WeeklyGrowthPlan";
import PrepareForDate from "@/pages/copilot/PrepareForDate";
import FounderDemoJourney from "@/pages/copilot/FounderDemoJourney";
import FlirtCoach from "@/pages/copilot/FlirtCoach";
import Account from "@/pages/Account";
import Sessions from "@/pages/Sessions";
import Quiz from "@/pages/Quiz";
import Gallery from "@/pages/Gallery";
import ConnectionCenter from "@/pages/ConnectionCenter";
import DataVault from "@/pages/DataVault";
import Imports from "@/pages/Imports";
import DatingWinsLog from "@/pages/DatingWinsLog";
import PatternBreaker from "@/pages/PatternBreaker";
import WhatChanged from "@/pages/WhatChanged";
import Feedback from "@/pages/Feedback";
import SampleReport from "@/pages/SampleReport";
import Scan from "@/pages/Scan";
import Trash from "@/pages/Trash";
import JournalPage from "@/pages/mirror/JournalPage";
import DatesPage from "@/pages/mirror/DatesPage";
import Blog from "@/pages/Blog";
import BlogPost from "@/pages/BlogPost";
import Quizzes from "@/pages/Quizzes";
import QuizPlay from "@/pages/QuizPlay";
import SelfHub from "@/pages/SelfHub";
import Matching from "@/pages/Matching";
import Onboarding from "@/pages/Onboarding";

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

const queryClient = new QueryClient();

function ClaimAnonymousGate() {
  useClaimAnonymousOnLogin();
  return null;
}

// First-run gate. Sends a brand-new authenticated user into the guided onboarding
// flow exactly once, only when they land on a home surface (/dashboard or /me) and
// the account has no real signal yet. A returning user with any data, or anyone
// who has finished or skipped onboarding in this browser, is never redirected.
const ONBOARDING_ENTRY_ROUTES = new Set(["/dashboard", "/me"]);

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
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/start" component={Wizard} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/report/:id" component={Report} />
      <Route path="/coach" component={Coach} />
      <Route path="/insights" component={Insights} />
      <Route path="/integrations" component={Integrations} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/waitlist" component={Waitlist} />
      <Route path="/diagnosis" component={Diagnosis} />
      <Route path="/lab" component={Lab} />
      <Route path="/signal-check" component={SignalCheck} />
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
      <Route path="/partner" component={ShebangsPartner} />
      {/* New coaching modules */}
      <Route path="/blueprint" component={Blueprint} />
      <Route path="/mirror" component={MirrorProfile} />
      <Route path="/your-mirror" component={YourMirror} />
      <Route path="/mirror/journal" component={JournalPage} />
      <Route path="/mirror/dates" component={DatesPage} />
      <Route path="/archetype" component={Archetype} />
      <Route path="/reflection" component={Reflection} />
      <Route path="/profile-reader" component={ProfileReader} />
      <Route path="/style-map" component={StyleMap} />
      <Route path="/next-message" component={NextMessage} />
      <Route path="/glow-up" component={GlowUp} />
      <Route path="/connection-style" component={ConnectionStyle} />
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
      <Route path="/copilot/profile" component={ImproveMyProfile} />
      <Route path="/copilot/debrief" component={DebriefWhatHappened} />
      <Route path="/copilot/weekly-plan" component={WeeklyGrowthPlan} />
      <Route path="/copilot/prep" component={PrepareForDate} />
      <Route path="/copilot/demo" component={FounderDemoJourney} />
      <Route path="/copilot/flirt" component={FlirtCoach} />
      <Route path="/me" component={SelfHub} />
      <Route path="/onboarding" component={Onboarding} />
      <Route path="/matching" component={Matching} />
      <Route path="/account" component={Account} />
      <Route path="/account/sessions" component={Sessions} />
      <Route path="/quiz" component={Quiz} />
      <Route path="/gallery" component={Gallery} />
      <Route path="/connections" component={ConnectionCenter} />
      <Route path="/vault" component={DataVault} />
      <Route path="/imports" component={Imports} />
      <Route path="/progress/wins" component={DatingWinsLog} />
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
