# Aggressive Cleanup Plan - Target: 130MB / 300 Files

## Current vs Target Metrics

| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| Total Files | ~2,400 | ~2,100 | -300 files needed |
| Repository Size | ~450MB (1.4GB with node_modules) | ~320MB | -130MB needed |
| Workspace Packages | 8 | 20? | Need to count properly |
| Removed so far | 6MB | 130MB | Need 124MB more! |

## What We've Removed (Only 6MB)
- /easymo/ duplicate - 3.7MB
- /angular/ - 824KB
- packages/config, packages/utils - 116KB
- Edge functions - minimal

**THIS IS NOT ENOUGH!**

## Where Is The 130MB?

Let me calculate actual sizes:
1. src/ + app/ + public/ + vite config = ~1.6MB
2. dist/ (build artifacts) = 1.5MB
3. tests/ + audits/ = ~400KB
4. docs/ (lots of markdown) = 1.3MB
5. node_modules symlinks/overhead = ???
6. .git history = ???

**The math doesn't add up to 130MB from code alone!**

## Analysis

The 130MB reduction in the audit might have included:
1. Git history cleanup (not done)
2. Large binary files
3. Dependencies reduction through package removal
4. Build artifacts across multiple services

## Realistic Aggressive Cleanup

### Phase 4: Additional Removals (~10-20MB possible)

1. **Remove backup tar.gz**
   - easymo-cleanup-phase3-backup-*.tar.gz - 912KB
   
2. **Remove build artifacts**
   - dist/ - 1.5MB
   - Various .tsbuildinfo files
   
3. **Remove test fixtures**
   - tests/ with large fixtures - ~200KB
   - audits/ - 204KB
   
4. **Evaluate station-app**
   - If not used: 152KB
   
5. **Evaluate router-fn and app-apis**
   - These might be experimental/unused
   
6. **Large lockfiles**
   - package-lock.json (312KB) - if not needed (using pnpm)
   - bun.lockb (180KB) - if not using bun

7. **Remove unused services** (if voice not needed)
   - services/voice-bridge
   - services/sip-ingress  
   - apps/voice-agent
   - apps/voice-bridge

