# 🚀 Deploy Frontend to Vercel

## Quick Deploy (Recommended)

### Option 1: Vercel CLI (Fastest)

```bash
# Install Vercel CLI
npm install -g vercel

# Navigate to frontend
cd frontend

# Login to Vercel
vercel login

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

### Option 2: GitHub Integration (Automatic)

1. **Push to GitHub:**
   ```bash
   cd /home/jay/.openclaw/workspace/litterbox-v2
   git add -A
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Connect to Vercel:**
   - Go to https://vercel.com/new
   - Import your GitHub repository
   - Select `frontend` as the root directory
   - Add environment variables (see below)
   - Click "Deploy"

3. **Automatic Deployments:**
   - Every push to `main` triggers auto-deployment
   - Preview deployments for pull requests

---

## Environment Variables

### For Vercel Dashboard

Add these in Vercel → Settings → Environment Variables:

```
VITE_PROGRAM_ID=CyuzmNggCxLyupt8JBdMdisRn5yo1eUfBPne9BqTnt85
VITE_CONFIG_PDA=7bibs5dbBwaUuWCc3yjSH6nu649WmQ7ifVicU4MZ6Ueu
VITE_POOL_PDA=7DgLSphFDzXA29ausgLpeydKzuW3b42HXrLppZb527MQ
VITE_RPC_URL=https://api.devnet.solana.com
VITE_NETWORK=devnet
```

### For Local Development

Create `frontend/.env.local`:
```bash
cp frontend/.env.example frontend/.env.local
```

---

## Build Configuration

### Vite Configuration
The project uses Vite's default Vercel integration. No additional config needed!

### Build Command
```bash
npm run build
```

### Output Directory
```
dist/
```

---

## Post-Deployment Checklist

### 1. Verify Deployment
- [ ] Site loads at `https://your-project.vercel.app`
- [ ] Wallet connection works
- [ ] Pool stats display correctly
- [ ] No console errors

### 2. Test Functionality
- [ ] Connect wallet (Phantom/Solflare)
- [ ] View pool statistics
- [ ] Test deposit form (USDC → LITTER)
- [ ] Test withdraw form (LITTER → USDC)

### 3. Performance
- [ ] Page loads in < 3 seconds
- [ ] No large bundle warnings
- [ ] Assets cached properly

---

## Custom Domain (Optional)

1. Go to Vercel → Settings → Domains
2. Add your custom domain
3. Update DNS records as instructed
4. SSL is automatic!

---

## Environment-Specific Deployments

### Development
```bash
vercel --env development
```

### Preview
```bash
vercel --env preview
```

### Production
```bash
vercel --prod --env production
```

---

## Troubleshooting

### Build Fails
```bash
# Check Node version (should be 18+)
node --version

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Environment Variables Not Working
- Verify variable names match exactly (case-sensitive)
- Restart dev server after adding `.env.local`
- Check Vercel dashboard for typos

### Wallet Connection Issues
- Ensure site is served over HTTPS (Vercel does this automatically)
- Check browser console for errors
- Verify wallet adapter is configured correctly

---

## Monitoring

### Vercel Analytics
- Enable in Vercel → Analytics
- Track page views and performance

### Error Tracking
- Check Vercel → Functions → Logs
- Monitor browser console for errors
- Use Sentry or similar for production error tracking

---

## Next Steps After Deployment

1. ✅ Deploy program to Devnet (done)
2. ✅ Initialize pool (run init script)
3. ✅ Deploy frontend to Vercel (this guide)
4. ⏳ Test full flow on Devnet
5. ⏳ Deploy to Mainnet (when ready)
6. ⏳ Add monitoring and analytics

---

## Quick Commands

```bash
# Local development
cd frontend
npm run dev

# Build for production
npm run build

# Deploy to Vercel
vercel

# Deploy to production
vercel --prod

# View logs
vercel logs
```

---

**Your frontend is now live on Vercel!** 🎉

Check it at: `https://litterbox-v2.vercel.app` (or your custom domain)
