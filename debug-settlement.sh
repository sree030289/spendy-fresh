#!/bin/bash
# Debug script to monitor settlement-related logs

echo "🔍 Monitoring settlement debug logs..."
echo "📝 Log file: expo-debug.log"
echo "🚀 Waiting for settlement calculations..."
echo ""

# Monitor the log file for settlement-related messages with new DEBUG patterns
tail -f expo-debug.log | grep -E "(💰.*DEBUG|📊.*DEBUG|🔄.*DEBUG|💸.*DEBUG|✅.*DEBUG|❌.*DEBUG|Settlement|Balance|Group.*Settlement|getGroupSettlementSuggestions|GroupBalanceOverviewModal)" --color=always
