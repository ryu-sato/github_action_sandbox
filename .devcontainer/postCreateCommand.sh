#!/bin/bash
set -euo pipefail

# Install packages required for Claude Code sandboxing
sudo apt-get update
sudo apt-get install -y bubblewrap socat
