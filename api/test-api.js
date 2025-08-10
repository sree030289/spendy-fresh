// test-api.js
const express = require('express');

const app = express();
app.use(express.json());

// Simple test endpoint
app.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Spendy API is running',
    timestamp: new Date().toISOString()
  });
});

// Start server
const PORT = 8000;
app.listen(PORT, () => {
  console.log(`🚀 Test API Server running on port ${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});
