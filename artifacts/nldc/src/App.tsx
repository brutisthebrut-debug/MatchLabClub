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
