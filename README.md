# ATU Pay Comparison — Monthly vs Fortnightly

Interactive tool showing how monthly and fortnightly pay systems deliver the same annual salary.

**Live demo:** `https://YOUR_USERNAME.github.io/pay-comparison/`

## Deploy to GitHub Pages

### One-time setup

1. **Create a GitHub repo** called `pay-comparison` (or whatever you like)

2. **Update two files** with your GitHub username:
   
   In `package.json`, replace `YOUR_USERNAME`:
   ```
   "homepage": "https://YOUR_USERNAME.github.io/pay-comparison"
   ```
   
   In `vite.config.js`, if you used a different repo name, update:
   ```
   base: '/your-repo-name/',
   ```

3. **Push the code to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/pay-comparison.git
   git push -u origin main
   ```

4. **Deploy:**
   ```bash
   npm run deploy
   ```

5. **Enable GitHub Pages:**
   - Go to your repo → Settings → Pages
   - Source: "Deploy from a branch"
   - Branch: `gh-pages` / `/ (root)`
   - Save

6. **Wait 1-2 minutes**, then visit `https://YOUR_USERNAME.github.io/pay-comparison/`

### Updating

After any changes:
```bash
npm run deploy
```

That's it — it rebuilds and pushes automatically.

## Local development

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`
