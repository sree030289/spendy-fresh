#!/bin/bash

# Let'Split App Icon Generator
# This script converts the SVG icon to all required sizes for iOS and Android

echo "🎨 Generating Let'Split app icons..."

# Check if svg2png or rsvg-convert is available
if command -v rsvg-convert &> /dev/null; then
    CONVERTER="rsvg-convert"
    echo "✅ Using rsvg-convert"
elif command -v svg2png &> /dev/null; then
    CONVERTER="svg2png"
    echo "✅ Using svg2png"
elif command -v inkscape &> /dev/null; then
    CONVERTER="inkscape"
    echo "✅ Using inkscape"
else
    echo "❌ No SVG converter found. Please install one of the following:"
    echo "   - rsvg-convert: brew install librsvg"
    echo "   - inkscape: brew install inkscape"
    echo "   - Or use an online SVG to PNG converter"
    exit 1
fi

# Source SVG file
SVG_FILE="./assets/icon-letssplit.svg"

# Create assets directory if it doesn't exist
mkdir -p ./assets

# Function to convert SVG to PNG
convert_svg() {
    local size=$1
    local output=$2
    
    if [ "$CONVERTER" = "rsvg-convert" ]; then
        rsvg-convert -w $size -h $size "$SVG_FILE" -o "$output"
    elif [ "$CONVERTER" = "svg2png" ]; then
        svg2png "$SVG_FILE" -w $size -h $size -o "$output"
    elif [ "$CONVERTER" = "inkscape" ]; then
        inkscape --export-png="$output" --export-width=$size --export-height=$size "$SVG_FILE"
    fi
    
    if [ $? -eq 0 ]; then
        echo "✅ Generated: $output (${size}x${size})"
    else
        echo "❌ Failed to generate: $output"
    fi
}

# Generate main app icons
echo "📱 Generating main app icons..."
convert_svg 1024 "./assets/icon-letssplit-1024.png"
convert_svg 512 "./assets/icon-letssplit-512.png"
convert_svg 192 "./assets/icon-letssplit-192.png"
convert_svg 180 "./assets/icon-letssplit-180.png"
convert_svg 152 "./assets/icon-letssplit-152.png"
convert_svg 144 "./assets/icon-letssplit-144.png"
convert_svg 120 "./assets/icon-letssplit-120.png"
convert_svg 114 "./assets/icon-letssplit-114.png"
convert_svg 96 "./assets/icon-letssplit-96.png"
convert_svg 76 "./assets/icon-letssplit-76.png"
convert_svg 72 "./assets/icon-letssplit-72.png"
convert_svg 60 "./assets/icon-letssplit-60.png"
convert_svg 57 "./assets/icon-letssplit-57.png"
convert_svg 48 "./assets/icon-letssplit-48.png"
convert_svg 40 "./assets/icon-letssplit-40.png"
convert_svg 36 "./assets/icon-letssplit-36.png"
convert_svg 29 "./assets/icon-letssplit-29.png"

# Generate adaptive icon (Android)
echo "🤖 Generating Android adaptive icon..."
convert_svg 1024 "./assets/adaptive-icon-letssplit.png"

# Generate favicon
echo "🌐 Generating favicon..."
convert_svg 16 "./assets/favicon-letssplit.ico"
convert_svg 32 "./assets/favicon-letssplit-32.png"

# Copy main icon for easy access
cp "./assets/icon-letssplit-1024.png" "./assets/icon-letssplit.png"

echo ""
echo "🎉 Icon generation complete!"
echo ""
echo "📋 Next steps:"
echo "1. Update app.json to use the new icon:"
echo "   \"icon\": \"./assets/icon-letssplit.png\""
echo ""
echo "2. Update app name in app.json:"
echo "   \"name\": \"Let'Split\""
echo ""
echo "3. For production, consider using EAS Build icon generation:"
echo "   https://docs.expo.dev/guides/app-icons/"
echo ""
echo "📱 Generated icons:"
ls -la ./assets/icon-letssplit* ./assets/adaptive-icon-letssplit* ./assets/favicon-letssplit*
