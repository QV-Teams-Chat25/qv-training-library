import React from 'react';

const ManagerHeader: React.FC = () => {
  return (
    <header style={{ 
      background: '#1e67cc', 
      color: 'white', 
      padding: '25px 0', 
      textAlign: 'center', 
      width: '100vw', 
      margin: 0,
      boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
      position: 'relative'
    }}>
      <h1 style={{ margin: 0, fontSize: '1.8rem' }}>QV Manager Content Editor</h1>
    </header>
  );
};

export default ManagerHeader;