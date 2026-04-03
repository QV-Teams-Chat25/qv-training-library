import React from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';

const AgentHeader: React.FC = () => (
  <AppBar position="static" sx={{ backgroundColor: '#0057B8' }}>
    <Toolbar>
      <Typography variant="h6" sx={{ color: '#fff' }}>
        QV TRAINING LIBRARY
      </Typography>
    </Toolbar>
  </AppBar>
);

export default AgentHeader;
