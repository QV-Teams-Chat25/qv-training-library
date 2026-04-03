import React, { useState } from 'react';

const RebuttalsEditor: React.FC = () => {
  // Placeholder for rich text editor value
  const [editorValue, setEditorValue] = useState('');
  // List of 18 clients (replace with real names as needed)
  const clients = [
    'Client 1', 'Client 2', 'Client 3', 'Client 4', 'Client 5', 'Client 6', 'Client 7', 'Client 8', 'Client 9', 'Client 10',
    'Client 11', 'Client 12', 'Client 13', 'Client 14', 'Client 15', 'Client 16', 'Client 17', 'Client 18',
  ];
  const [title, setTitle] = useState('');
  const [selectedClient, setSelectedClient] = useState('');
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'white' }}>
      {/* Sidebar */}
      <aside style={{ width: 260, background: '#f5f5f5', padding: '60px 18px 32px 18px', borderRight: '2px solid #e0e0e0' }}>
        <h3 style={{ fontSize: '1.3rem', color: '#1565c0', fontWeight: 700, marginBottom: 18 }}>QV Saved Rebuttals</h3>
        {/* Placeholder for saved rebuttals list */}
        <div style={{ color: '#888', fontSize: '1rem' }}>[Saved rebuttals will appear here]</div>
      </aside>
      {/* Main content */}
      <main style={{ flex: 1, padding: '32px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <header style={{ width: '100%', backgroundColor: '#1565c0', color: 'white', padding: '18px 0', textAlign: 'center', marginBottom: 32 }}>
          <h2 style={{ margin: 0, fontSize: '2rem', letterSpacing: '1px' }}>QV Manager Content Editor</h2>
        </header>
        <div style={{ width: '80%', maxWidth: 700, background: '#fff', borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.07)', padding: 24 }}>
          <h3 style={{ fontSize: '1.4rem', color: '#1565c0', fontWeight: 700, marginBottom: 18 }}>Rebuttals Editor</h3>
          {/* Title and Client Row */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18, gap: 18 }}>
            <input
              type="text"
              placeholder="Title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              style={{ fontSize: '1.1rem', padding: '8px 12px', borderRadius: 6, border: '1px solid #1565c0', flex: 2 }}
            />
            <select
              value={selectedClient}
              onChange={e => setSelectedClient(e.target.value)}
              style={{ fontSize: '1.1rem', padding: '8px 12px', borderRadius: 6, border: '1px solid #1565c0', flex: 1, minWidth: 160 }}
            >
              <option value="">Select Client</option>
              {clients.map(client => (
                <option key={client} value={client}>{client}</option>
              ))}
            </select>
          </div>
          {/* Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <button style={{ fontWeight: 'bold', fontSize: '1.1rem', border: '1px solid #1565c0', background: 'white', color: '#1565c0', borderRadius: 4, padding: '4px 10px', cursor: 'pointer' }}>B</button>
            <button style={{ fontStyle: 'italic', fontSize: '1.1rem', border: '1px solid #1565c0', background: 'white', color: '#1565c0', borderRadius: 4, padding: '4px 10px', cursor: 'pointer' }}>I</button>
            <button style={{ textDecoration: 'underline', fontSize: '1.1rem', border: '1px solid #1565c0', background: 'white', color: '#1565c0', borderRadius: 4, padding: '4px 10px', cursor: 'pointer' }}>U</button>
            <select style={{ fontSize: '1.1rem', border: '1px solid #1565c0', borderRadius: 4, padding: '4px 10px', color: '#1565c0', background: 'white', cursor: 'pointer' }}>
              <option value="">Font Size</option>
              <option value="12">12</option>
              <option value="14">14</option>
              <option value="16">16</option>
              <option value="18">18</option>
              <option value="20">20</option>
              <option value="24">24</option>
            </select>
            <select style={{ fontSize: '1.1rem', border: '1px solid #1565c0', borderRadius: 4, padding: '4px 10px', color: '#1565c0', background: 'white', cursor: 'pointer' }}>
              <option value="">Highlight</option>
              <option value="#ffff00">Yellow</option>
              <option value="#ffb347">Orange</option>
              <option value="#90ee90">Green</option>
              <option value="#add8e6">Blue</option>
              <option value="#ff6961">Red</option>
              <option value="#ffffff">None</option>
            </select>
          </div>
          {/* Rich Text Editor placeholder */}
          <div style={{ border: '1px solid #1565c0', borderRadius: 6, minHeight: 180, padding: 12, marginBottom: 18 }}>
            <span style={{ color: '#aaa' }}>[Rich Text Editor will go here]</span>
          </div>
        </div>
      </main>
    </div>
  );
};

export default RebuttalsEditor;
