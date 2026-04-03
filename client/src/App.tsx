import React from 'react';
import { Link } from 'react-router-dom';

const legalLine1 = 'Copyright © 2026 Quality Voices LLC. All rights reserved. Confidential and proprietary information for authorized business use only.';
const legalLine2 = 'IT Legal Notice: Unauthorized access, use, disclosure, copying, or distribution is prohibited and may result in disciplinary action, civil liability, and criminal penalties.';

// This is the main screen agents see at http://10.0.1.123:3000/agents
const AgentLibrary: React.FC = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', background: '#eef1f5', fontFamily: 'sans-serif' }}>
      <header style={{ background: '#003366', color: 'white', padding: '24px 20px', textAlign: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '2rem', letterSpacing: '0.02em' }}>QV Training Library</h1>
      </header>
      <main style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '24px' }}>
        <div style={{ background: 'white', padding: '54px 44px', borderRadius: '14px', boxShadow: '0 10px 26px rgba(0,0,0,0.10)', textAlign: 'center', width: 'min(1020px, 100%)' }}>
          <h2 style={{ color: '#003366', fontSize: '2.2rem', margin: '0 0 14px 0' }}>Agent Training Library</h2>
          <p style={{ color: '#4b5563', fontSize: '1.2rem', marginBottom: '34px' }}>Select a training section below.</p>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
            <Link to="/agents/rebuttals" style={{ background: '#1e67cc', color: 'white', textDecoration: 'none', fontWeight: 700, fontSize: '1.2rem', padding: '16px 28px', borderRadius: '10px', minWidth: '180px' }}>
              Rebuttals
            </Link>
            <Link to="/agents/transitions" style={{ background: '#1e67cc', color: 'white', textDecoration: 'none', fontWeight: 700, fontSize: '1.2rem', padding: '16px 28px', borderRadius: '10px', minWidth: '180px' }}>
              Transitions
            </Link>
            <Link to="/agents/process" style={{ background: '#1e67cc', color: 'white', textDecoration: 'none', fontWeight: 700, fontSize: '1.2rem', padding: '16px 28px', borderRadius: '10px', minWidth: '180px' }}>
              Verification
            </Link>
          </div>
        </div>
      </main>
      <footer style={{ borderTop: '1px solid #d6dbe3', background: '#fff', padding: '14px 16px', textAlign: 'center', fontSize: '12px', color: '#4b5563', lineHeight: 1.4 }}>
        <div>{legalLine1}</div>
        <div>{legalLine2}</div>
      </footer>
    </div>
  );
};

function App() {
  return <AgentLibrary />;
}

export default App;