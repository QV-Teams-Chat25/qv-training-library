import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import App from './App';
import ManagerDashboard from './components/ManagerDashboard/ManagerDashboard';
import AgentProcess from './pages/agent/AgentProcess';
import AgentRebuttals from './pages/agent/AgentRebuttals';
import AgentTransitions from './pages/agent/AgentTransitions';

const MainRoutes: React.FC = () => (
  <Router>
    <Routes>
      <Route path="/" element={<Navigate to="/agents" replace />} />
      <Route path="/agents" element={<App />} />
      <Route path="/agents/rebuttals" element={<AgentRebuttals />} />
      <Route path="/agents/process" element={<AgentProcess />} />
      <Route path="/agents/transitions" element={<AgentTransitions />} />
      <Route path="/managers" element={<ManagerDashboard />} />
      <Route path="/manager" element={<Navigate to="/managers" replace />} />
      <Route path="/rebuttals" element={<Navigate to="/agents/rebuttals" replace />} />
      <Route path="/process" element={<Navigate to="/agents/process" replace />} />
      <Route path="/transitions" element={<Navigate to="/agents/transitions" replace />} />
      <Route path="*" element={<Navigate to="/agents" replace />} />
    </Routes>
  </Router>
);

export default MainRoutes;
