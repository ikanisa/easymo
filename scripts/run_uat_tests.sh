#!/bin/bash

# UAT Test Execution Script
# Provides interactive test execution guide

set -e

echo "🧪 WhatsApp Webhooks - UAT Test Execution"
echo "=========================================="
echo ""
echo "This script will guide you through UAT test execution."
echo ""

# Check prerequisites
echo "Checking prerequisites..."
echo ""

# Check Supabase CLI
if ! command -v supabase &> /dev/null; then
    echo "⚠️  Supabase CLI not found"
    echo "   Install: npm install -g supabase"
    exit 1
fi

# Check if logged in
if ! supabase projects list &>/dev/null; then
    echo "⚠️  Not logged into Supabase"
    echo "   Run: supabase login"
    exit 1
fi

echo "✓ Prerequisites met"
echo ""

# Display test plan
echo "Test Execution Plan:"
echo "===================="
echo ""
echo "1. Pre-Test Setup"
echo "   - Verify all functions deployed"
echo "   - Verify all migrations applied"
echo "   - Prepare test data"
echo ""
echo "2. Execute Tests"
echo "   - Use WhatsApp to send test messages"
echo "   - Follow UAT_TEST_EXECUTION_PLAN.md"
echo "   - Document results in UAT_TEST_RESULTS.md"
echo ""
echo "3. Monitor Logs"
echo "   - Run: ./scripts/monitor_logs.sh"
echo "   - Watch for errors"
echo ""
echo "4. Review Results"
echo "   - Check UAT_TEST_RESULTS.md"
echo "   - Fix any issues found"
echo "   - Re-test if needed"
echo ""

# Interactive menu
while true; do
    echo ""
    echo "Select an option:"
    echo "1. Check webhook health"
    echo "2. Monitor logs"
    echo "3. View test plan"
    echo "4. Open test results file"
    echo "5. Exit"
    echo ""
    read -p "Enter choice [1-5]: " choice
    
    case $choice in
        1)
            echo ""
            echo "Checking webhook health..."
            ./scripts/check_webhook_health.sh || echo "Health check script not found"
            ;;
        2)
            echo ""
            echo "Starting log monitoring..."
            echo "Press Ctrl+C to stop"
            ./scripts/monitor_logs.sh || echo "Log monitoring script not found"
            ;;
        3)
            echo ""
            echo "Opening test plan..."
            if command -v open &> /dev/null; then
                open UAT_TEST_EXECUTION_PLAN.md
            elif command -v xdg-open &> /dev/null; then
                xdg-open UAT_TEST_EXECUTION_PLAN.md
            else
                echo "Please open UAT_TEST_EXECUTION_PLAN.md manually"
            fi
            ;;
        4)
            echo ""
            echo "Opening test results..."
            if command -v open &> /dev/null; then
                open UAT_TEST_RESULTS.md
            elif command -v xdg-open &> /dev/null; then
                xdg-open UAT_TEST_RESULTS.md
            else
                echo "Please open UAT_TEST_RESULTS.md manually"
            fi
            ;;
        5)
            echo ""
            echo "Exiting..."
            exit 0
            ;;
        *)
            echo "Invalid choice. Please enter 1-5."
            ;;
    esac
done

