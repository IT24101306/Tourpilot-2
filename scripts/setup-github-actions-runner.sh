#!/usr/bin/env bash
# One-time: install a GitHub Actions self-hosted runner on the TourPilot VPS.
# This removes remote SSH from CI deploys (permanent fix for dial tcp i/o timeout).
#
# Prerequisites:
#   - Run as the same user that owns /var/www/tourpilot (and docker group)
#   - Create a runner in GitHub: Repo → Settings → Actions → Runners → New self-hosted runner
#   - Copy the config token from that page into RUNNER_TOKEN below / env
#
# Usage:
#   export RUNNER_TOKEN=XXXX
#   export GITHUB_REPO_URL=https://github.com/OWNER/TourPilot
#   bash scripts/setup-github-actions-runner.sh
set -euo pipefail

REPO_URL="${GITHUB_REPO_URL:?Set GITHUB_REPO_URL e.g. https://github.com/OWNER/TourPilot}"
TOKEN="${RUNNER_TOKEN:?Set RUNNER_TOKEN from GitHub → Settings → Actions → Runners}"
RUNNER_DIR="${RUNNER_DIR:-$HOME/actions-runner}"
LABELS="${RUNNER_LABELS:-self-hosted,linux,tourpilot}"
NAME="${RUNNER_NAME:-tourpilot-vps}"

mkdir -p "$RUNNER_DIR"
cd "$RUNNER_DIR"

if [[ ! -f ./config.sh ]]; then
  echo "==> Downloading GitHub Actions runner"
  # Pin to a known release; bump when GitHub documents a newer LTS runner.
  VER="${RUNNER_VERSION:-2.323.0}"
  curl -fsSL -o actions-runner-linux-x64.tar.gz \
    "https://github.com/actions/runner/releases/download/v${VER}/actions-runner-linux-x64-${VER}.tar.gz"
  tar xzf ./actions-runner-linux-x64.tar.gz
  rm -f ./actions-runner-linux-x64.tar.gz
fi

if [[ ! -f .runner ]]; then
  echo "==> Configuring runner ($NAME) labels=$LABELS"
  ./config.sh --unattended \
    --url "$REPO_URL" \
    --token "$TOKEN" \
    --name "$NAME" \
    --labels "$LABELS" \
    --work _work
fi

echo "==> Installing systemd service"
sudo ./svc.sh install
sudo ./svc.sh start
sudo ./svc.sh status || true

echo
echo "Runner is online. Deploy jobs using:"
echo "  runs-on: [self-hosted, linux, tourpilot]"
echo
echo "Ensure this user can run docker without sudo:"
echo "  sudo usermod -aG docker \"\$USER\" && newgrp docker"
echo
echo "Firewall tip: you no longer need inbound SSH from the whole internet for CI."
echo "Keep SSH for your own laptop (restrict ufw to your IP if possible)."
