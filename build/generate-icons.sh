#!/bin/bash

# Generate app icons from SVG source
# Requires: inkscape or ImageMagick (rsvg-convert)

set -e

SOURCE="build/icon-source.svg"
ICONSET="build/icon.iconset"

echo "🎨 Generating app icons from $SOURCE"
echo ""

# Check for required tools
if command -v rsvg-convert &> /dev/null; then
    CONVERTER="rsvg-convert"
    echo "✅ Using rsvg-convert"
elif command -v inkscape &> /dev/null; then
    CONVERTER="inkscape"
    echo "✅ Using inkscape"
elif command -v convert &> /dev/null; then
    CONVERTER="imagemagick"
    echo "✅ Using ImageMagick"
else
    echo "❌ No SVG converter found!"
    echo ""
    echo "Install one of:"
    echo "  • brew install librsvg (recommended)"
    echo "  • brew install inkscape"
    echo "  • brew install imagemagick"
    exit 1
fi

echo ""

# Function to convert SVG to PNG
convert_svg() {
    local size=$1
    local output=$2
    
    case $CONVERTER in
        rsvg-convert)
            rsvg-convert -w $size -h $size "$SOURCE" -o "$output"
            ;;
        inkscape)
            inkscape "$SOURCE" --export-filename="$output" --export-width=$size --export-height=$size
            ;;
        imagemagick)
            convert -background none -resize ${size}x${size} "$SOURCE" "$output"
            ;;
    esac
}

# Generate macOS .icns (requires iconset with specific sizes)
echo "📱 Generating macOS icons (.icns)..."
mkdir -p "$ICONSET"

# macOS iconset requires these specific sizes
convert_svg 16 "$ICONSET/icon_16x16.png"
convert_svg 32 "$ICONSET/icon_16x16@2x.png"
convert_svg 32 "$ICONSET/icon_32x32.png"
convert_svg 64 "$ICONSET/icon_32x32@2x.png"
convert_svg 128 "$ICONSET/icon_128x128.png"
convert_svg 256 "$ICONSET/icon_128x128@2x.png"
convert_svg 256 "$ICONSET/icon_256x256.png"
convert_svg 512 "$ICONSET/icon_256x256@2x.png"
convert_svg 512 "$ICONSET/icon_512x512.png"
convert_svg 1024 "$ICONSET/icon_512x512@2x.png"

# Convert iconset to .icns
iconutil -c icns "$ICONSET" -o build/icon.icns
echo "✅ Created build/icon.icns"

# Clean up iconset directory
rm -rf "$ICONSET"

# Generate Windows .ico (multi-resolution icon)
echo ""
echo "🪟 Generating Windows icon (.ico)..."
convert_svg 256 build/icon-256.png

if command -v convert &> /dev/null; then
    # ImageMagick can create multi-resolution .ico
    convert build/icon-256.png \
        \( -clone 0 -resize 16x16 \) \
        \( -clone 0 -resize 32x32 \) \
        \( -clone 0 -resize 48x48 \) \
        \( -clone 0 -resize 64x64 \) \
        \( -clone 0 -resize 128x128 \) \
        \( -clone 0 -resize 256x256 \) \
        -delete 0 build/icon.ico
    echo "✅ Created build/icon.ico"
else
    # Fallback: just copy 256px version as .ico (Windows will handle resizing)
    cp build/icon-256.png build/icon.ico
    echo "⚠️  Created single-resolution .ico (install ImageMagick for multi-res)"
fi

# Generate Linux .png (standard sizes)
echo ""
echo "🐧 Generating Linux icons (.png)..."
convert_svg 512 build/icon.png
echo "✅ Created build/icon.png (512x512)"

# Also create common sizes for Linux
mkdir -p build/icons
convert_svg 16 build/icons/16x16.png
convert_svg 32 build/icons/32x32.png
convert_svg 48 build/icons/48x48.png
convert_svg 64 build/icons/64x64.png
convert_svg 128 build/icons/128x128.png
convert_svg 256 build/icons/256x256.png
convert_svg 512 build/icons/512x512.png
echo "✅ Created Linux icon set in build/icons/"

# Cleanup temp file
rm -f build/icon-256.png

echo ""
echo "🎉 Icon generation complete!"
echo ""
echo "Generated files:"
echo "  • build/icon.icns (macOS)"
echo "  • build/icon.ico (Windows)"
echo "  • build/icon.png (Linux)"
echo "  • build/icons/*.png (Linux multi-size)"
echo ""
echo "You can now run: ./build-notarized.sh"
