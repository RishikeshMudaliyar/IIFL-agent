import { LiveAPIProvider } from "./contexts/LiveAPIContext";
import { ModeProvider } from "./contexts/ModeContext";
import { LeadProvider } from "./contexts/LeadContext";
import { LiveClientOptions } from "./types";
import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import ABCDLoanJourney from './pages/ABCDLoanJourney';
import AgentVoicePage from './pages/AgentVoicePage';
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

