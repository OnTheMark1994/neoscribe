const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Health check endpoint that serves the landing page
router.get('/', (req, res) => {
  const htmlPath = path.join(__dirname, 'public', 'index.html');
  let html = fs.readFileSync(htmlPath, 'utf8');
  res.send(html);
});

module.exports = router;
