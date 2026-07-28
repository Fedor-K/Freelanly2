#!/bin/bash
# Role-family classify tick. Shares the EMBED lock (/tmp/embed-tick.lock) so it NEVER runs concurrently
# with the embed cron: with OLLAMA_MAX_LOADED_MODELS=1 a concurrent run would thrash the single model
# slot (each qwen call cold-loads ~4s after embed evicts it). Mutual exclusion keeps qwen warm within a
# tick (~1.5s/call). Small batch + short timeout so the lock is handed back to embed quickly.
# Fail-soft: qwen down => rows stay NULL => feed shows them unfiltered.
cd /opt/worker || exit 1
export CLASSIFY_BATCH=${CLASSIFY_BATCH:-20}
exec 9>/tmp/embed-tick.lock
flock -n 9 || exit 0
export $(grep -v "^#" .env | xargs)
timeout 280 npx tsx run-classify.ts >> /var/log/feed-classify.log 2>&1
