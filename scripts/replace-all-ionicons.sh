#!/bin/bash

# Comprehensive Ionicons to Icon replacement script
echo "🔧 Starting comprehensive Ionicons replacement..."

# Define the source directory
SRC_DIR="src"

# List of common Ionicons to Icon mappings
declare -A ICON_MAPPINGS=(
    ["add-circle-outline"]="add"
    ["add-circle"]="add"
    ["person-add"]="person"
    ["person-remove"]="person"
    ["arrow-up-circle"]="arrowUp"
    ["arrow-down-circle"]="arrowDown"
    ["chevron-back"]="back"
    ["chevron-forward"]="forward"
    ["chevron-up"]="arrowUp"
    ["chevron-down"]="arrowDown"
    ["close"]="close"
    ["create-outline"]="edit"
    ["create"]="edit"
    ["trash-outline"]="trash"
    ["document-text-outline"]="document"
    ["calendar-outline"]="calendar"
    ["repeat-outline"]="refresh"
    ["swap-horizontal-outline"]="refresh"
    ["pricetag-outline"]="card"
    ["phone-portrait"]="call"
    ["chatbubble-outline"]="mail"
    ["chatbubble"]="mail"
    ["chatbubbles"]="mail"
    ["flash-outline"]="camera"
    ["flash"]="camera"
    ["pie-chart-outline"]="analytics"
    ["pie-chart"]="analytics"
    ["sad-outline"]="warning"
    ["alarm-outline"]="calendar"
    ["bulb-outline"]="information"
    ["bulb"]="information"
    ["shield-checkmark"]="shield"
    ["today-outline"]="calendar"
    ["logo-usd"]="cash"
    ["logo-whatsapp"]="share"
    ["logo-google"]="mail"
    ["play-circle"]="play"
    ["camera-reverse"]="camera"
    ["hourglass"]="time"
    ["ellipsis-horizontal"]="menu"
    ["open-outline"]="share"
    ["exit"]="logout"
    ["wallet"]="wallet"
    ["pencil"]="edit"
    ["remove-circle"]="close"
)

# Function to replace Ionicons with Icon in a file
replace_ionicons_in_file() {
    local file="$1"
    echo "Processing: $file"
    
    # Replace the import statement first (if it exists)
    sed -i '' 's/import { Ionicons } from '\''@expo\/vector-icons'\'';/\/\/ Icon import handled by existing Icon component/g' "$file"
    
    # Replace each icon mapping
    for old_icon in "${!ICON_MAPPINGS[@]}"; do
        new_icon="${ICON_MAPPINGS[$old_icon]}"
        sed -i '' "s/Ionicons name=\"$old_icon\"/Icon name=\"$new_icon\"/g" "$file"
    done
    
    # Replace generic Ionicons with Icon (for cases not covered above)
    sed -i '' 's/<Ionicons/<Icon/g' "$file"
    
    # Replace keyof typeof Ionicons.glyphMap with string
    sed -i '' 's/keyof typeof Ionicons\.glyphMap/string/g' "$file"
}

# Find all TypeScript files and process them
find "$SRC_DIR" -name "*.tsx" -type f | while read -r file; do
    # Skip the Icon.tsx file itself and test files
    if [[ "$file" != *"Icon.tsx"* ]] && [[ "$file" != *"__tests__"* ]] && [[ "$file" != *".test."* ]]; then
        # Check if file contains Ionicons
        if grep -q "Ionicons" "$file"; then
            replace_ionicons_in_file "$file"
        fi
    fi
done

echo "✅ Comprehensive Ionicons replacement completed!"
echo "📋 Summary: Replaced common Ionicons usage with Icon component"
echo "⚠️  Manual review may be needed for uncommon icon names"
