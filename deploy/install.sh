#!/bin/bash

set -e

APP_NAME="openall.app"

ARM_URL="https://github.com/openall-ai/openall/releases/download/v0.1.0/openall-mac.app.zip"
INTEL_URL="https://github.com/openall-ai/openall/releases/download/v0.1.0/openall-mac64.app.zip"

TMP_DIR=$(mktemp -d)
ZIP_FILE="$TMP_DIR/openall-app.zip"

# Detect architecture
ARCH=$(uname -m)

if [[ "$ARCH" == "arm64" ]]; then
    DOWNLOAD_URL="$ARM_URL"
    echo "Detected Apple Silicon"
else
    DOWNLOAD_URL="$INTEL_URL"
    echo "Detected Intel"
fi

echo "Downloading..."
curl -L "$DOWNLOAD_URL" -o "$ZIP_FILE"

echo "Unzipping..."
unzip -q "$ZIP_FILE" -d "$TMP_DIR"

echo "Installing..."
rm -rf "/Applications/$APP_NAME"
mv "$TMP_DIR/$APP_NAME" /Applications/

echo "Removing quarantine..."
xattr -dr com.apple.quarantine "/Applications/$APP_NAME"

echo "Done!"
