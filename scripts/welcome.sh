#!/usr/bin/env bash
#
# welcome.sh
# Interactive welcome script for macOS code signing setup
# Shows status and guides users through first-time setup

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Clear screen for better presentation
clear

# ASCII Art Banner
cat << 'EOF'
╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║   ███████╗ █████╗ ███████╗██╗   ██╗███╗   ███╗ ██████╗          ║
║   ██╔════╝██╔══██╗██╔════╝╚██╗ ██╔╝████╗ ████║██╔═══██╗         ║
║   █████╗  ███████║███████╗ ╚████╔╝ ██╔████╔██║██║   ██║         ║
║   ██╔══╝  ██╔══██║╚════██║  ╚██╔╝  ██║╚██╔╝██║██║   ██║         ║
║   ███████╗██║  ██║███████║   ██║   ██║ ╚═╝ ██║╚██████╔╝         ║
║   ╚══════╝╚═╝  ╚═╝╚══════╝   ╚═╝   ╚═╝     ╚═╝ ╚═════╝          ║
║                                                                   ║
║              macOS Code Signing Infrastructure                   ║
║                    Welcome & Setup Guide                         ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
EOF

echo
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}                         SYSTEM CHECK                              ${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}"
echo

# Check 1: Scripts exist
echo -n "Checking scripts... "
SCRIPTS_OK=true
for script in list_identities.sh check_certificate.sh sign_app.sh sign_all_apps.sh verify_apps.sh test_signing_workflow.sh; do
    if [ ! -x "$SCRIPT_DIR/$script" ]; then
        SCRIPTS_OK=false
        break
    fi
done

if [ "$SCRIPTS_OK" = true ]; then
    echo -e "${GREEN}✓ All 6 scripts found${NC}"
else
    echo -e "${RED}✗ Missing or non-executable scripts${NC}"
fi

# Check 2: Documentation exists
echo -n "Checking documentation... "
DOCS_OK=true
for doc in SIGNING_QUICK_START.md docs/internal_mac_signing.md docs/github_actions_signing.md; do
    if [ ! -f "$REPO_ROOT/$doc" ]; then
        DOCS_OK=false
        break
    fi
done

if [ "$DOCS_OK" = true ]; then
    echo -e "${GREEN}✓ All documentation found${NC}"
else
    echo -e "${RED}✗ Missing documentation${NC}"
fi

# Check 3: Certificate exists
echo -n "Checking certificate... "
if "$SCRIPT_DIR/check_certificate.sh" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Certificate 'Inhouse Dev Signing' found${NC}"
    CERT_EXISTS=true
else
    echo -e "${YELLOW}⚠ Certificate not found (normal for first run)${NC}"
    CERT_EXISTS=false
fi

# Check 4: .gitignore security
echo -n "Checking security (.gitignore)... "
if grep -q "*.p12" "$REPO_ROOT/.gitignore" 2>/dev/null; then
    echo -e "${GREEN}✓ .p12 files blocked from git${NC}"
else
    echo -e "${YELLOW}⚠ .gitignore may need updating${NC}"
fi

echo
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}                         YOUR STATUS                               ${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}"
echo

if [ "$CERT_EXISTS" = true ]; then
    echo -e "${GREEN}✓ YOU'RE READY TO SIGN!${NC}"
    echo
    echo "Quick commands:"
    echo -e "  ${BLUE}./scripts/sign_all_apps.sh${NC}      Sign both apps"
    echo -e "  ${BLUE}./scripts/verify_apps.sh${NC}        Verify signatures"
    echo
    echo "Documentation:"
    echo -e "  ${BLUE}open docs/SIGNING_REFERENCE.md${NC}  Complete reference"
else
    echo -e "${YELLOW}⚠ SETUP NEEDED${NC}"
    echo
    echo "To get started:"
    echo -e "  1. ${BLUE}open SIGNING_QUICK_START.md${NC}     (5-minute guide)"
    echo -e "  2. Create certificate in Keychain Access"
    echo -e "  3. ${BLUE}./scripts/check_certificate.sh${NC}  (verify setup)"
    echo -e "  4. ${BLUE}./scripts/test_signing_workflow.sh${NC} (run tests)"
fi

echo
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}                    INTERACTIVE MENU                               ${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}"
echo
echo "What would you like to do?"
echo
echo -e "  ${GREEN}[1]${NC} Open Quick Start Guide (recommended for first-time users)"
echo -e "  ${GREEN}[2]${NC} Check certificate status"
echo -e "  ${GREEN}[3]${NC} List available signing identities"
echo -e "  ${GREEN}[4]${NC} Run test suite"
echo -e "  ${GREEN}[5]${NC} Sign both apps"
echo -e "  ${GREEN}[6]${NC} Verify signatures"
echo -e "  ${GREEN}[7]${NC} View documentation index"
echo -e "  ${GREEN}[8]${NC} Show file manifest"
echo -e "  ${GREEN}[Q]${NC} Quit"
echo
echo -n "Enter your choice [1-8, Q]: "
read -r choice

case "$choice" in
    1)
        echo
        echo -e "${BLUE}Opening Quick Start Guide...${NC}"
        if command -v open &> /dev/null; then
            open "$REPO_ROOT/SIGNING_QUICK_START.md"
        else
            cat "$REPO_ROOT/SIGNING_QUICK_START.md"
        fi
        ;;
    2)
        echo
        "$SCRIPT_DIR/check_certificate.sh"
        ;;
    3)
        echo
        "$SCRIPT_DIR/list_identities.sh"
        ;;
    4)
        echo
        "$SCRIPT_DIR/test_signing_workflow.sh"
        ;;
    5)
        echo
        if [ "$CERT_EXISTS" = false ]; then
            echo -e "${YELLOW}⚠ Certificate not found. Please create certificate first.${NC}"
            echo -e "See: ${BLUE}SIGNING_QUICK_START.md${NC}"
        else
            "$SCRIPT_DIR/sign_all_apps.sh"
        fi
        ;;
    6)
        echo
        "$SCRIPT_DIR/verify_apps.sh"
        ;;
    7)
        echo
        echo -e "${BLUE}Opening Documentation Index...${NC}"
        if command -v open &> /dev/null; then
            open "$REPO_ROOT/docs/INDEX.md"
        else
            cat "$REPO_ROOT/docs/INDEX.md"
        fi
        ;;
    8)
        echo
        if [ -f "$REPO_ROOT/SIGNING_FILES_MANIFEST.md" ]; then
            cat "$REPO_ROOT/SIGNING_FILES_MANIFEST.md"
        else
            echo -e "${RED}Manifest not found${NC}"
        fi
        ;;
    [Qq])
        echo
        echo -e "${GREEN}Thanks for using EasyMO Code Signing!${NC}"
        echo
        echo "Quick reference:"
        echo -e "  Documentation: ${BLUE}docs/INDEX.md${NC}"
        echo -e "  Scripts:       ${BLUE}scripts/README.md${NC}"
        echo -e "  Quick start:   ${BLUE}SIGNING_QUICK_START.md${NC}"
        echo
        exit 0
        ;;
    *)
        echo
        echo -e "${YELLOW}Invalid choice. Run ./scripts/welcome.sh to try again.${NC}"
        exit 1
        ;;
esac

echo
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}"
echo
echo -e "${GREEN}Run ${BLUE}./scripts/welcome.sh${GREEN} anytime to return to this menu.${NC}"
echo
