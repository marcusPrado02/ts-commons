#!/usr/bin/env bash
# scripts/trivy-scan.sh
# Runs Trivy security scan against a Docker image.
# Usage: ./scripts/trivy-scan.sh [image:tag] [severity]
#   image:tag  – Docker image to scan (default: ts-commons:latest)
#   severity   – Comma-separated severity levels (default: CRITICAL,HIGH)
set -euo pipefail

IMAGE="${1:-ts-commons:latest}"
SEVERITY="${2:-CRITICAL,HIGH}"
REPORT_DIR="$(dirname "$0")/../reports/trivy"
REPORT_FILE="${REPORT_DIR}/trivy-$(date +%Y%m%d-%H%M%S).json"

echo "═══════════════════════════════════════════"
echo " Trivy Security Scan"
echo " Image    : ${IMAGE}"
echo " Severity : ${SEVERITY}"
echo "═══════════════════════════════════════════"

# Ensure Trivy is installed
if ! command -v trivy &>/dev/null; then
  echo "⚠  Trivy not found. Installing via aquasecurity repository..."
  if command -v apt-get &>/dev/null; then
    sudo apt-get install -y wget apt-transport-https gnupg lsb-release
    wget -qO - https://aquasecurity.github.io/trivy-repo/deb/public.key | sudo apt-key add -
    echo "deb https://aquasecurity.github.io/trivy-repo/deb $(lsb_release -sc) main" \
      | sudo tee /etc/apt/sources.list.d/trivy.list
    sudo apt-get update && sudo apt-get install -y trivy
  elif command -v brew &>/dev/null; then
    brew install aquasecurity/trivy/trivy
  else
    echo "✗ Cannot install Trivy automatically. Please install manually:"
    echo "  https://aquasecurity.github.io/trivy/latest/getting-started/installation/"
    exit 1
  fi
fi

# Ensure report directory exists
mkdir -p "${REPORT_DIR}"

echo ""
echo "▶ Running vulnerability scan..."
trivy image \
  --exit-code 1 \
  --severity "${SEVERITY}" \
  --format json \
  --output "${REPORT_FILE}" \
  "${IMAGE}" || SCAN_EXIT=$?

echo ""
echo "▶ Human-readable summary:"
trivy image \
  --exit-code 0 \
  --severity "${SEVERITY}" \
  --format table \
  "${IMAGE}"

if [[ "${SCAN_EXIT:-0}" -ne 0 ]]; then
  echo ""
  echo "✗ Vulnerabilities of severity ${SEVERITY} found in ${IMAGE}"
  echo "  Full report: ${REPORT_FILE}"
  exit 1
fi

echo ""
echo "✔ No ${SEVERITY} vulnerabilities found in ${IMAGE}"
echo "  Report saved to: ${REPORT_FILE}"
