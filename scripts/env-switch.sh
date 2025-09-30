#!/bin/bash
# scripts/env-switch.sh - Easy environment switching script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_usage() {
    echo -e "${BLUE}🔧 Meet-n-Split Environment Switcher${NC}"
    echo ""
    echo "Usage: $0 [environment]"
    echo ""
    echo "Environments:"
    echo -e "  ${GREEN}local${NC}       - Firebase Emulator (for local development)"
    echo -e "  ${YELLOW}development${NC} - spendy-develop project (cloud)"
    echo -e "  ${RED}production${NC}  - spendy-97913 project (production)"
    echo ""
    echo "Examples:"
    echo "  $0 local        # Switch to local emulator"
    echo "  $0 development  # Switch to development cloud"
    echo "  $0 production   # Switch to production"
    echo ""
    echo "Current environment:"
    current_env=$(grep '^SPENDY_ENV=' .env 2>/dev/null | cut -d'=' -f2 || echo "not set")
    echo -e "  ${BLUE}$current_env${NC}"
}

update_env_file() {
    local new_env=$1
    
    if [ ! -f ".env" ]; then
        echo -e "${RED}❌ .env file not found!${NC}"
        exit 1
    fi
    
    # Update SPENDY_ENV in .env file
    if grep -q "^SPENDY_ENV=" .env; then
        # Replace existing SPENDY_ENV
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s/^SPENDY_ENV=.*/SPENDY_ENV=$new_env/" .env
        else
            sed -i "s/^SPENDY_ENV=.*/SPENDY_ENV=$new_env/" .env
        fi
    else
        # Add SPENDY_ENV if it doesn't exist
        echo "SPENDY_ENV=$new_env" >> .env
    fi
    
    echo -e "${GREEN}✅ Environment switched to: $new_env${NC}"
}

show_environment_info() {
    local env=$1
    
    echo ""
    echo -e "${BLUE}📋 Environment Details:${NC}"
    
    case $env in
        "local")
            echo -e "  ${GREEN}Name:${NC} Local Development"
            echo -e "  ${GREEN}Firebase:${NC} Emulator (localhost:5001)"
            echo -e "  ${GREEN}Project:${NC} spendy-develop (emulated)"
            echo -e "  ${GREEN}API URL:${NC} http://192.168.0.144:5001/spendy-develop/us-central1/meetnsplitApi"
            echo -e "  ${GREEN}Features:${NC} Full debugging, HTTP allowed"
            ;;
        "development")
            echo -e "  ${YELLOW}Name:${NC} Development Cloud"
            echo -e "  ${YELLOW}Firebase:${NC} Cloud Functions"
            echo -e "  ${YELLOW}Project:${NC} spendy-develop"
            echo -e "  ${YELLOW}API URL:${NC} https://us-central1-spendy-develop.cloudfunctions.net/meetnsplitApi"
            echo -e "  ${YELLOW}Features:${NC} Debugging enabled, HTTPS only"
            ;;
        "production")
            echo -e "  ${RED}Name:${NC} Production"
            echo -e "  ${RED}Firebase:${NC} Cloud Functions"
            echo -e "  ${RED}Project:${NC} spendy-97913"
            echo -e "  ${RED}API URL:${NC} https://us-central1-spendy-97913.cloudfunctions.net/meetnsplitApi"
            echo -e "  ${RED}Features:${NC} No debugging, HTTPS only, production security"
            ;;
    esac
    
    echo ""
    echo -e "${BLUE}📱 Next Steps:${NC}"
    echo -e "  1. Restart your development server: ${GREEN}npx expo start --clear${NC}"
    echo -e "  2. For local environment, ensure Firebase emulator is running: ${GREEN}firebase emulators:start --only functions${NC}"
    echo -e "  3. Check the app logs to confirm environment switch"
}

# Main script
if [ $# -eq 0 ]; then
    print_usage
    exit 0
fi

ENV=$1

case $ENV in
    "local"|"development"|"production")
        echo -e "${BLUE}🔄 Switching to $ENV environment...${NC}"
        update_env_file $ENV
        show_environment_info $ENV
        ;;
    *)
        echo -e "${RED}❌ Invalid environment: $ENV${NC}"
        echo ""
        print_usage
        exit 1
        ;;
esac
