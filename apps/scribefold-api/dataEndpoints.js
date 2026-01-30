// Releases endpoint - proxies GitHub releases for web portal downloads page
const express = require('express');
const router = express.Router();

// Use native fetch (Node 18+) or node-fetch v2 for older versions
const fetch = global.fetch || require('node-fetch');

// Proxy endpoint to fetch GitHub releases
router.get('/releases', async (req, res) => {
  console.log('=== [GET /releases] Incoming request ===');

  try {
    const owner = process.env.GITHUB_REPO_OWNER || 'AbeApple';
    const repo = process.env.GITHUB_REPO_NAME || 'scribefold-ai-monorepo';
    const token = process.env.GITHUB_DOWNLOAD_TOKEN;

    console.log('[/releases] Env check:', {
      owner,
      repo,
      hasToken: !!token,
    });

    if (!token) {
      console.error('[/releases] Missing GITHUB_DOWNLOAD_TOKEN');
      return res.status(500).json({ error: 'GitHub download token not configured' });
    }

    const url = `https://api.github.com/repos/${owner}/${repo}/releases`;
    console.log('[/releases] Fetching from GitHub URL:', url);

    const ghRes = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'scribefold-api'
      }
    });

    console.log('[/releases] GitHub response status:', ghRes.status);

    if (!ghRes.ok) {
      const text = await ghRes.text().catch(() => '');
      console.error('[/releases] GitHub error body:', text);
      return res.status(ghRes.status).json({ error: 'GitHub API error', status: ghRes.status });
    }

    const data = await ghRes.json();
    console.log('[/releases] Successfully fetched releases. Count:', Array.isArray(data) ? data.length : 'n/a');
    return res.json(data);
  } catch (err) {
    console.error('[/releases] Unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
