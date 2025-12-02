# macOS Code Signing - Visual Workflow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          COMPLETE WORKFLOW DIAGRAM                            │
└──────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: ONE-TIME SETUP (5 minutes)                                         │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌──────────────────┐
    │ Keychain Access  │
    │ Create Cert      │──────┐
    └──────────────────┘      │
                              ├──> "Inhouse Dev Signing" created
    ┌──────────────────┐      │
    │ Mark "Always     │──────┘
    │ Trust"           │
    └──────────────────┘
            │
            ▼
    ┌──────────────────────────┐
    │ ./scripts/               │
    │ check_certificate.sh     │────> ✓ Certificate verified
    └──────────────────────────┘
            │
            ▼
    ┌──────────────────────────┐
    │ ./scripts/               │
    │ test_signing_workflow.sh │────> ✓ All tests pass
    └──────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 2: LOCAL DEVELOPMENT WORKFLOW (daily)                                 │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌──────────────────┐
    │  Build Apps      │
    │  npm run build   │
    └────────┬─────────┘
             │
             ├─────────────────────────────────────────────┐
             │                                             │
             ▼                                             ▼
    ┌─────────────────────┐                    ┌─────────────────────┐
    │ AdminPanel.app      │                    │ ClientPortal.app    │
    │ (unsigned)          │                    │ (unsigned)          │
    └──────────┬──────────┘                    └──────────┬──────────┘
               │                                           │
               └────────────────┬──────────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │ scripts/              │
                    │ sign_all_apps.sh      │
                    └───────────┬───────────┘
                                │
                    ┌───────────┴───────────┐
                    │                       │
                    ▼                       ▼
        ┌──────────────────────┐ ┌──────────────────────┐
        │ sign_app.sh          │ │ sign_app.sh          │
        │ AdminPanel.app       │ │ ClientPortal.app     │
        └──────────┬───────────┘ └──────────┬───────────┘
                   │                        │
                   │  1. codesign --sign   │
                   │  2. codesign --verify │
                   │  3. spctl --assess    │
                   │                        │
                   └────────────┬───────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │ scripts/              │
                    │ verify_apps.sh        │────> ✓ Both apps signed
                    └───────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │ Ready for             │
                    │ Distribution          │
                    └───────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 3: TEAM DISTRIBUTION (once per team member)                           │
└─────────────────────────────────────────────────────────────────────────────┘

    Developer Mac                      Team Member Mac
    ──────────────                     ────────────────
    
    ┌──────────────────┐
    │ Export .p12      │
    │ from Keychain    │
    └────────┬─────────┘
             │
             ▼
    ┌──────────────────┐              ┌──────────────────┐
    │ InhouseDev       │──────────────>│ Import .p12      │
    │ Signing.p12      │  (secure)     │ Double-click     │
    │ + password       │               └────────┬─────────┘
    └──────────────────┘                        │
                                                ▼
                                       ┌──────────────────┐
                                       │ Mark "Always     │
                                       │ Trust"           │
                                       └────────┬─────────┘
                                                │
                                                ▼
                                       ┌──────────────────┐
                                       │ check_           │
                                       │ certificate.sh   │──> ✓ Ready
                                       └──────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 4: CI/CD AUTOMATION (optional, recommended)                           │
└─────────────────────────────────────────────────────────────────────────────┘

    Developer                GitHub Actions                    Artifacts
    ─────────                ───────────────                   ─────────
    
    ┌──────────┐
    │ git tag  │
    │ v1.0.0   │
    └────┬─────┘
         │
         ▼
    ┌──────────┐            ┌─────────────────────────┐
    │ git push │───────────>│ Workflow Triggered      │
    │ --tags   │            └──────────┬──────────────┘
    └──────────┘                       │
                                       ├──> Checkout code
                                       │
                                       ├──> Import cert (from secrets)
                                       │    • MACOS_CERTIFICATE_BASE64
                                       │    • MACOS_CERTIFICATE_PASSWORD
                                       │
                                       ├──> Build Admin Panel
                                       │
                                       ├──> Build Client Portal
                                       │
                                       ├──> Run sign_all_apps.sh
                                       │
                                       ├──> Run verify_apps.sh
                                       │
                                       ├──> Create DMG files
                                       │
                                       └──> Upload artifacts
                                              │
                                              ▼
                                    ┌─────────────────────┐
                                    │ ✓ AdminPanel.dmg    │
                                    │ ✓ ClientPortal.dmg  │
                                    │ (signed, verified)  │
                                    └─────────────────────┘
                                              │
                                              ▼
                                    ┌─────────────────────┐
                                    │ Download & Deploy   │
                                    └─────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│ UPGRADE PATH: DEVELOPER ID + NOTARIZATION (future)                          │
└─────────────────────────────────────────────────────────────────────────────┘

    Current: Self-Signed                Future: Developer ID
    ────────────────────                ────────────────────
    
    ┌──────────────────┐                ┌──────────────────┐
    │ Inhouse Dev      │                │ Apple Developer  │
    │ Signing (free)   │───upgrade─────>│ ID ($99/year)    │
    └────────┬─────────┘                └────────┬─────────┘
             │                                    │
             │  • Right-click to open             │  • No warnings
             │  • Team must import cert           │  • Works instantly
             │  • Internal only                   │  • Public ready
             │                                    │
             │                                    ├──> Notarize
             │                                    │    (optional)
             │                                    │
             │                                    └──> Max trust
             
    Change 1 variable in sign_all_apps.sh:
    DEFAULT_IDENTITY="Developer ID Application: Company (TEAMID)"


┌─────────────────────────────────────────────────────────────────────────────┐
│ SCRIPT RELATIONSHIPS                                                         │
└─────────────────────────────────────────────────────────────────────────────┘

    list_identities.sh ─────────> (info only)
    
    check_certificate.sh ────────> (validation)
                                      │
                                      ├──> Pre-flight check
                                      └──> Troubleshooting
    
    sign_app.sh ─────────────────> (core signer)
         ▲                              │
         │                              ├──> codesign
         │                              ├──> verify
         │                              └──> spctl assess
         │
    sign_all_apps.sh ────────────> (orchestrator)
         │                              │
         └──────calls 2x────────────────┘
                                        │
                                        ▼
    verify_apps.sh ──────────────> (post-check)
                                        │
                                        ├──> Detailed report
                                        └──> CI/CD validation
    
    test_signing_workflow.sh ────> (E2E test)
         │
         ├──> Creates mock apps
         ├──> Tests all scripts
         └──> Verifies .gitignore


┌─────────────────────────────────────────────────────────────────────────────┐
│ FILE DEPENDENCY TREE                                                         │
└─────────────────────────────────────────────────────────────────────────────┘

    .
    ├── scripts/
    │   ├── list_identities.sh      (standalone)
    │   ├── check_certificate.sh    (standalone)
    │   ├── sign_app.sh             (used by sign_all_apps.sh)
    │   ├── sign_all_apps.sh        (calls sign_app.sh)
    │   ├── verify_apps.sh          (standalone)
    │   └── test_signing_workflow.sh (tests all above)
    │
    ├── docs/
    │   ├── internal_mac_signing.md     (master guide)
    │   ├── github_actions_signing.md   (CI/CD guide)
    │   └── SIGNING_REFERENCE.md        (index)
    │
    ├── .github/workflows/
    │   └── macos-signing.yml       (uses scripts/)
    │
    ├── SIGNING_QUICK_START.md      (entry point)
    └── .gitignore                  (security)


┌─────────────────────────────────────────────────────────────────────────────┐
│ TYPICAL WORKFLOW TIMELINE                                                    │
└─────────────────────────────────────────────────────────────────────────────┘

    Day 1 (setup):
        09:00 ─> Read SIGNING_QUICK_START.md       (2 min)
        09:02 ─> Create certificate                 (3 min)
        09:05 ─> Run check_certificate.sh           (10 sec)
        09:06 ─> Run test_signing_workflow.sh       (15 sec)
        09:07 ─> Update app paths in scripts        (1 min)
        09:08 ─> DONE ✓
    
    Day 2 (first build):
        14:00 ─> Build apps                         (5 min)
        14:05 ─> Run sign_all_apps.sh               (30 sec)
        14:06 ─> Run verify_apps.sh                 (10 sec)
        14:07 ─> Distribute to team                 (10 min)
        14:17 ─> DONE ✓
    
    Week 2 (CI/CD):
        10:00 ─> Read github_actions_signing.md     (5 min)
        10:05 ─> Export cert, add GitHub secrets    (5 min)
        10:10 ─> Push tag, trigger workflow         (1 min)
        10:11 ─> Wait for build                     (5 min)
        10:16 ─> Download artifacts                 (1 min)
        10:17 ─> DONE ✓ (fully automated)


┌─────────────────────────────────────────────────────────────────────────────┐
│ DOCUMENTATION READING ORDER                                                  │
└─────────────────────────────────────────────────────────────────────────────┘

    START
      │
      ├──> SIGNING_QUICK_START.md
      │      │
      │      ├──> Need more detail? ──> docs/internal_mac_signing.md
      │      │
      │      ├──> Setting up CI/CD? ──> docs/github_actions_signing.md
      │      │
      │      └──> Looking for X? ────> docs/SIGNING_REFERENCE.md
      │
      └──> DONE (you have everything you need)


═══════════════════════════════════════════════════════════════════════════════

                           🚀 YOU'RE ALL SET! 🚀

═══════════════════════════════════════════════════════════════════════════════
```
