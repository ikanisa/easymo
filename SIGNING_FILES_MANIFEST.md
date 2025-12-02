# macOS Code Signing - Complete File Manifest

**Created:** 2025-12-02  
**Total Files:** 11  
**Total Size:** ~50 KB  

## Scripts (6 files)

| File | Size | Purpose | Entry Point |
|------|------|---------|-------------|
| `scripts/list_identities.sh` | 890 B | List code-signing identities | ✓ Yes |
| `scripts/check_certificate.sh` | 2.6 KB | Verify certificate setup | ✓ Yes |
| `scripts/sign_app.sh` | 2.8 KB | Sign single app + verify | Called by sign_all_apps.sh |
| `scripts/sign_all_apps.sh` | 3.3 KB | Sign both apps | ✓ Yes (main) |
| `scripts/verify_apps.sh` | 2.5 KB | Post-signing verification | ✓ Yes |
| `scripts/test_signing_workflow.sh` | 7.1 KB | End-to-end test suite | ✓ Yes |

**Total Scripts:** 19.2 KB

## Documentation (5 files)

| File | Size | Audience | Reading Time |
|------|------|----------|--------------|
| `SIGNING_QUICK_START.md` | 3.0 KB | All users | 2 min |
| `docs/internal_mac_signing.md` | 8.4 KB | All users | 10 min |
| `docs/github_actions_signing.md` | 6.5 KB | DevOps | 5 min |
| `docs/SIGNING_REFERENCE.md` | 11.6 KB | Reference | As needed |
| `docs/SIGNING_WORKFLOW_DIAGRAM.md` | 7.8 KB | Visual learners | 5 min |

**Total Docs:** 37.3 KB

## CI/CD (1 file)

| File | Size | Purpose |
|------|------|---------|
| `.github/workflows/macos-signing.yml` | 6.9 KB | Automated signing on GitHub |

## Security

- `.gitignore` updated to block: `*.p12`, `*.cer`, `*.mobileprovision`, etc.

---

## Quick Navigation

### I want to...

- **Get started quickly** → `SIGNING_QUICK_START.md`
- **Learn everything** → `docs/internal_mac_signing.md`
- **Set up CI/CD** → `docs/github_actions_signing.md`
- **Find specific info** → `docs/SIGNING_REFERENCE.md`
- **See visual workflow** → `docs/SIGNING_WORKFLOW_DIAGRAM.md`
- **Test setup** → `./scripts/test_signing_workflow.sh`
- **Sign apps** → `./scripts/sign_all_apps.sh`

---

## File Tree

```
easymo/
├── scripts/
│   ├── list_identities.sh           ✓ Executable
│   ├── check_certificate.sh         ✓ Executable
│   ├── sign_app.sh                  ✓ Executable
│   ├── sign_all_apps.sh             ✓ Executable (main entry)
│   ├── verify_apps.sh               ✓ Executable
│   └── test_signing_workflow.sh     ✓ Executable
│
├── docs/
│   ├── internal_mac_signing.md      Complete reference
│   ├── github_actions_signing.md    CI/CD guide
│   ├── SIGNING_REFERENCE.md         Master index
│   └── SIGNING_WORKFLOW_DIAGRAM.md  Visual diagrams
│
├── .github/workflows/
│   └── macos-signing.yml            GitHub Actions workflow
│
├── SIGNING_QUICK_START.md           Start here!
├── SIGNING_FILES_MANIFEST.md        This file
└── .gitignore                       Updated with security rules
```

---

## Dependencies

**Required on macOS:**
- `security` (built-in)
- `codesign` (built-in with Xcode Command Line Tools)
- `spctl` (built-in)

**Optional (for DMG creation):**
- `create-dmg` (install via Homebrew: `brew install create-dmg`)

**For CI/CD:**
- GitHub account with Actions enabled
- GitHub Secrets (3 required)

---

## Verification Checklist

Run these commands to verify everything is set up correctly:

```bash
# 1. Check scripts exist and are executable
ls -lh scripts/sign_*.sh scripts/check_certificate.sh scripts/verify_apps.sh

# 2. Check documentation exists
ls -lh SIGNING_QUICK_START.md docs/*signing*.md

# 3. Check CI/CD workflow exists
ls -lh .github/workflows/macos-signing.yml

# 4. Verify gitignore blocks certificates
grep "\.p12" .gitignore

# 5. Run test suite
./scripts/test_signing_workflow.sh
```

All checks should pass. ✓

---

## Maintenance

### Adding a third app

1. Edit `scripts/sign_all_apps.sh`
2. Add new app path variable (line ~30)
3. Call `sign_app.sh` for new app (line ~75)
4. Update `scripts/verify_apps.sh` with new path

### Changing identity name

1. Edit `scripts/sign_all_apps.sh` line 33:
   ```bash
   DEFAULT_IDENTITY="Your New Identity Name"
   ```
2. No other changes needed!

### Adding entitlements

1. Create `entitlements.plist` file
2. Edit `scripts/sign_all_apps.sh` line 40:
   ```bash
   ENTITLEMENTS="./entitlements.plist"
   ```

---

## Support

- **Issues:** Check `docs/internal_mac_signing.md` Troubleshooting section
- **Questions:** See `docs/SIGNING_REFERENCE.md` FAQ-style layout
- **Examples:** All docs include copy-paste examples

---

## License

Same as parent repository.

---

**Last updated:** 2025-12-02  
**Maintainer:** EasyMO DevOps Team  
**Status:** Production Ready ✓
