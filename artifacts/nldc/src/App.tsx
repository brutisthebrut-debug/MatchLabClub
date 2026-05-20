import { Switch, Route, Router as WouterRouter } from "wouter";
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
import DatingWinsLog from "@/pages/DatingWinsLog";
import PatternBreaker from "@/pages/PatternBreaker";
import WhatChanged from "@/pages/WhatChanged";
import Feedback from "@/pages/Feedback";
import SampleReport from "@/pages/SampleReport";
import Scan from "@/pages/Scan";
import Trash from "@/pages/Trash";

import { useClaimAnonymousOnLogin } from "@/hooks/useClaimAnonymousOnLogin";

const queryClient = new QueryClient();

function ClaimAnonymousGate() {
  useClaimAnonymousOnLogin();
  return null;
}

function Router() {
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
        {(params) => <Checkout product={params?.product ?? "dating-reset"} />}
      </Route>
      <Route path="/founder" component={Founder} />
      <Route path="/partners/shebangs" component={ShebangsPartner} />
      <Route path="/partner" component={ShebangsPartner} />
      {/* New coaching modules */}
      <Route path="/blueprint" component={Blueprint} />
      <Route path="/mirror" component={MirrorProfile} />
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
      <Route path="/account" component={Account} />
      <Route path="/account/sessions" component={Sessions} />
      <Route path="/quiz" component={Quiz} />
      <Route path="/gallery" component={Gallery} />
      <Route path="/connections" component={ConnectionCenter} />
      <Route path="/vault" component={DataVault} />
      <Route path="/progress/wins" component={DatingWinsLog} />
      <Route path="/progress/pattern-breaker" component={PatternBreaker} />
      <Route path="/copilot/what-changed" component={WhatChanged} />
      <Route path="/feedback" component={Feedback} />
      <Route path="/sample-report" component={SampleReport} />
      <Route path="/scan" component={Scan} />
      <Route path="/trash" component={Trash} />
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
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
