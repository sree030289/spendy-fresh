#!/bin/bash
# scripts/env-status.sh - Check current environment status

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

check_environment() {
    echo -e "${BLUE}🔧 Meet-n-Split Environment Status${NC}"
    echo ""
    
    # Check .env file
    if [ ! -f ".env" ]; then
        echo -e "${RED}❌ .env file not found!${NC}"
        exit 1
    fi
    
    # Get current environment
    current_env=$(grep '^SPENDY_ENV=' .env 2>/dev/null | cut -d'=' -f2 || echo "not set")
    
    echo -e "${CYAN}📋 Configuration:${NC}"
    echo -e "  Environment: ${GREEN}$current_env${NC}"
    
    # Show environment-specific info
    case $current_env in
        "local")
            echo -e "  Firebase: ${GREEN}Emulator (localhost)${NC}"
            echo -e "  Project: ${GREEN}spendy-develop (emulated)${NC}"
            echo -e "  API: ${GREEN}http://192.168.0.144:5001/spendy-develop/us-central1/meetnsplitApi${NC}"
            
            # Check if emulator is running
            echo ""
            echo -e "${CYAN}🔍 Service Status:${NC}"
            if curl -s http://127.0.0.1:5001/spendy-develop/us-central1/meetnsplitApi/health >/dev/null 2>&1; then
                echo -e "  Firebase Emulator: ${GREEN}✅ Running${NC}"
            else
                echo -e "  Firebase Emulator: ${RED}❌ Not running${NC}"
                echo -e "    Start with: ${YELLOW}firebase emulators:start --only functions${NC}"
            fi
            ;;
        "development")
            echo -e "  Firebase: ${YELLOW}Cloud Functions${NC}"
            echo -e "  Project: ${YELLOW}spendy-develop${NC}"
            echo -e "  API: ${YELLOW}https://us-central1-spendy-develop.cloudfunctions.net/meetnsplitApi${NC}"
            
            # Check if API is reachable
            echo ""
            echo -e "${CYAN}🔍 Service Status:${NC}"
            if curl -s https://us-central1-spendy-develop.cloudfunctions.net/meetnsplitApi/health >/dev/null 2>&1; then
                echo -e "  Development API: ${GREEN}✅ Reachable${NC}"
            else
                echo -e "  Development API: ${RED}❌ Not reachable${NC}"
            fi
            ;;
        "production")
            echo -e "  Firebase: ${RED}Cloud Functions${NC}"
            echo -e "  Project: ${RED}spendy-97913${NC}"
            echo -e "  API: ${RED}https://us-central1-spendy-97913.cloudfunctions.net/meetnsplitApi${NC}"
            
            # Check if API is reachable
            echo ""
            echo -e "${CYAN}🔍 Service Status:${NC}"
            if curl -s https://us-central1-spendy-97913.cloudfunctions.net/meetnsplitApi/health >/dev/null 2>&1; then
                echo -e "  Production API: ${GREEN}✅ Reachable${NC}"
            else
                echo -e "  Production API: ${RED}❌ Not reachable${NC}"
            fi
            ;;
        *)
            echo -e "  ${RED}❌ Unknown environment: $current_env${NC}"
            ;;
    esac
    
    # Check if Expo is running
    echo ""
    if pgrep -f "expo start" >/dev/null 2>&1; then
        echo -e "  Expo Server: ${GREEN}✅ Running${NC}"
    else
        echo -e "  Expo Server: ${YELLOW}⚠️ Not running${NC}"
        echo -e "    Start with: ${YELLOW}npx expo start --clear${NC}"
    fi
    
    echo ""
    echo -e "${BLUE}🔄 Quick Actions:${NC}"
    echo -e "  Switch environment: ${GREEN}./scripts/env-switch.sh [local|development|production]${NC}"
    echo -e "  Restart Expo: ${GREEN}npx expo start --clear${NC}"
    echo -e "  Start emulator: ${GREEN}firebase emulators:start --only functions${NC}"
}

# Run the check
check_environment
