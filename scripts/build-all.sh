#!/bin/bash

# Build script for ts-commons monorepo
# Builds all packages in dependency order

set -e

echo "🏗️  Building ts-commons monorepo..."
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Clean previous builds
echo -e "${BLUE}📦 Cleaning previous builds...${NC}"
pnpm -r run clean

echo ""
echo -e "${BLUE}🔨 Building packages in dependency order...${NC}"

# Build order (respecting dependencies)
packages=(
  "kernel"
  "application"
  "errors"
  "config"
  "observability"
  "resilience"
  "security"
  "messaging"
  "outbox"
  "persistence"
  "contracts"
  "web"
  "testing"
)

for pkg in "${packages[@]}"; do
  echo -e "${GREEN}Building @acme/$pkg...${NC}"
  cd "packages/$pkg"
  pnpm run build
  cd ../..
done

echo ""
echo -e "${GREEN}✅ All packages built successfully!${NC}"
echo ""
echo "📊 Package summary:"
echo "   - Total packages: ${#packages[@]}"
echo "   - Build system: TypeScript (ESM)"
echo "   - Package manager: pnpm"
echo ""
echo "🎉 Ready to publish!"
