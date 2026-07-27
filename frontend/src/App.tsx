import { LiveAPIProvider } from "./contexts/LiveAPIContext";
import { ModeProvider } from "./contexts/ModeContext";
import { LeadProvider } from "./contexts/LeadContext";
import { LiveClientOptions } from "./types";
import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import ABCDLoanJourney from './pages/ABCDLoanJourney';
import AgentVoicePage from './pages/AgentVoicePage';
import BranchHero from './pages/BranchHero';
import GoldApplication from './pages/GoldApplication';
import BusinessApplication from './pages/BusinessApplication';
import SecuredApplication from './pages/SecuredApplication';
import OffersPage from './pages/OffersPage';
import LoanApplicationList from './pages/LoanApplicationList';
import LoanDetailsPage from './pages/LoanDetailsPage';

const BACKEND_WS_URL = import.meta.env.VITE_BACKEND_WS_URL || "ws://localhost:8000/ws";

const apiOptions: LiveClientOptions = { backendUrl: BACKEND_WS_URL };

function App() {

  return (
    <div className="App">
      <ModeProvider>
        <LeadProvider>
        <LiveAPIProvider options={apiOptions}>
          <Routes>
            <Route path="/" element={<Navigate to="/home" replace />} />
            <Route path="/home" element={<Home />} />
            <Route path="/loan-application" element={<ABCDLoanJourney />} />
            {/* Page 1 — the hyperlocal branch hero. This is what the agent's
                browser opens when a gold call connects, keyed to the caller's
                pincode. The form only appears once they agree to apply. */}
            <Route path="/branch/:pincode" element={<BranchHero />} />
            <Route path="/branch" element={<BranchHero />} />
            {/* Per-loan-type live-fill forms (page 2). The agent's browser opens
                the one matching the caller's loan_type. */}
            <Route path="/gold-application" element={<GoldApplication />} />
            <Route path="/business-application" element={<BusinessApplication />} />
            <Route path="/secured-application" element={<SecuredApplication />} />
            {/* Page 3 — indicative offers the agent reads out before handover. */}
            <Route path="/offers/:loanType" element={<OffersPage />} />
            <Route path="/agent/voice" element={<AgentVoicePage />} />
            {/* Chat front-door + chat/voice picker retired — flow is voice-only now.
                Redirect any stale links back to the landing page. */}
            <Route path="/chat" element={<Navigate to="/home" replace />} />
            <Route path="/agent/chat" element={<Navigate to="/home" replace />} />
            <Route path="/applications" element={<LoanApplicationList />} />
            <Route path="/application/:applicationId" element={<LoanDetailsPage />} />
          </Routes>
        </LiveAPIProvider>
        </LeadProvider>
      </ModeProvider>
    </div>
  );
}

export default App;

