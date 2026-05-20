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

const queryClient = new QueryClient();

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
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
