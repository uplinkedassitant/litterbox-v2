# 🔐 Security Guidelines

## What's Protected

### .gitignore Rules
The following are **excluded** from git:
- ✅ `.env` and `.env.*` files (environment variables)
- ✅ `*.json` except `package.json`, `tsconfig.json`, `vercel.json`
- ✅ Keypair files (`*.key`, `*.pem`, keypairs/)
- ✅ Build artifacts (`target/`, `dist/`, `*.so`)
- ✅ IDE settings (`.vscode/`, `.idea/`)
- ✅ Logs (`*.log`)

### What's Safe to Commit
- ✅ `package.json` (no secrets)
- ✅ `tsconfig.json` (no secrets)
- ✅ `vercel.json` (no secrets)
- ✅ `Cargo.toml` (no secrets)
- ✅ Source code (`.rs`, `.ts`, `.tsx`)
- ✅ Documentation (`.md`)

### What's NEVER Committed
- ❌ `.env` files with real values
- ❌ Keypair JSON files (`~/.config/solana/*.json`)
- ❌ Private keys
- ❌ API keys or tokens
- ❌ Passwords or credentials

---

## Environment Variables

### Development
Create `frontend/.env.local` (gitignored):
```bash
VITE_PROGRAM_ID=your_program_id
VITE_CONFIG_PDA=your_config_pda
VITE_POOL_PDA=your_pool_pda
VITE_RPC_URL=https://api.devnet.solana.com
VITE_NETWORK=devnet
```

### Production (Vercel)
Add in Vercel Dashboard → Settings → Environment Variables:
- Set for all environments (Preview, Production)
- Mark as "Sensitive" if available
- Never expose to browser unless prefixed with `VITE_`

---

## Keypair Security

### Location
Keypairs are stored in:
- `~/.config/solana/id_litterbox_v2.json` (program authority)

### Best Practices
1. **NEVER** commit keypair files to git
2. **NEVER** share keypair JSON files
3. **NEVER** log keypair contents
4. Use separate keypairs for dev/test/prod
5. Backup keypairs securely (encrypted storage)

### If Compromised
If a keypair is accidentally committed:
1. **Immediately** deploy new program with new keypair
2. **Immediately** move funds to new accounts
3. **Revoke** any associated authority
4. **Document** the incident

---

## Program Security

### Current Program
- **Program ID:** `AX6vgdmqDXRVd3kNwT8Xt7B49GcDTDFR4LwV7caxmZCG`
- **Network:** Solana Devnet
- **Authority:** `9y2YgLd4x5rB4yKDj4nipzGPRYjtBfGmRs28LTX73cf7`

### Upgrade Authority
The program authority controls:
- Program upgrades
- Account initialization
- Fee configuration (if implemented)

**Keep the authority keypair secure!**

---

## Vercel Security

### Environment Variables
Add these in Vercel Dashboard:
```bash
VITE_PROGRAM_ID=AX6vgdmqDXRVd3kNwT8Xt7B49GcDTDFR4LwV7caxmZCG
VITE_CONFIG_PDA=GSyYSVVz9yrk6XSeF9zMi9GzvtUk47mKVhjKJVW4HTGZ
VITE_POOL_PDA=H3LwN5cS6zyX3iU8PwnDMXh4RbFAmwBKGkg81UzGuwFt
VITE_RPC_URL=https://api.devnet.solana.com
VITE_NETWORK=devnet
```

### Deployment Security
- ✅ Use Vercel's environment variables (not `.env` files)
- ✅ Enable Vercel's security features
- ✅ Monitor deployment logs
- ✅ Use branch protection rules

---

## GitHub Security

### Repository Settings
- ✅ Enable two-factor authentication
- ✅ Use branch protection for `main`
- ✅ Require pull request reviews
- ✅ Scan for secrets in commits

### What's Public
The following are visible on GitHub:
- ✅ Source code (`.rs`, `.ts`, `.tsx`)
- ✅ Configuration files (no secrets)
- ✅ Documentation
- ✅ Build scripts

### What's Private (Not Committed)
- ❌ Environment variables
- ❌ Keypairs
- ❌ API keys
- ❌ Database credentials

---

## Audit Trail

### Git History
Check what's been committed:
```bash
# List all tracked files
git ls-files

# Check for sensitive patterns
git log --all --full-history -- "*.env"
git log --all --full-history -- "*.json"
```

### Clean History (if needed)
If sensitive data was committed:
```bash
# Remove from history
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch PATH_TO_FILE' \
  --prune-empty --tag-name-filter cat -- --all

# Force push (dangerous!)
git push origin --force --all
```

---

## Checklist

### Before Committing
- [ ] No `.env` files with real values
- [ ] No keypair JSON files
- [ ] No API keys or tokens
- [ ] No passwords or credentials
- [ ] `.gitignore` is up to date

### Before Deploying
- [ ] Environment variables set in Vercel
- [ ] Keypairs stored securely
- [ ] Program authority backed up
- [ ] Monitoring enabled

### Regular Audits
- [ ] Review git history for leaks
- [ ] Check Vercel environment variables
- [ ] Verify keypair security
- [ ] Update dependencies

---

## Contact

If you find a security vulnerability:
1. Do **NOT** create a public issue
2. Contact the maintainer directly
3. Allow time for a fix before disclosure

---

**Security is everyone's responsibility!** 🔐
