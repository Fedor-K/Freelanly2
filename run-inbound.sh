#!/bin/bash
cd /opt/worker
# Already serving — nothing to do.
if ss -tlnp 2>/dev/null | grep -q ":8025"; then
    exit 0
fi
# A boot may already be in progress (process exists but port not bound yet).
# Guard on the PROCESS, not just the port, so a slow tsx boot does NOT cause the
# cron to pile up a new instance every minute (that pile-up thrashes the box and
# makes boots even slower — a death spiral). Reap a clearly stuck boot (>180s old
# and still not bound) so a single wedged instance self-heals.
PIDS=$(pgrep -f "tsx inbound-server.ts")
if [ -n "$PIDS" ]; then
    REAP=0
    for pid in $PIDS; do
        et=$(ps -o etimes= -p "$pid" 2>/dev/null | tr -d ' ')
        [ -n "$et" ] && [ "$et" -gt 180 ] && REAP=1
    done
    if [ "$REAP" -eq 1 ]; then
        pkill -9 -f "tsx inbound-server.ts"; sleep 1
    else
        exit 0
    fi
fi
export $(grep -v "^#" .env | xargs)
echo "$(date) - Inbound server starting..." >> /var/log/inbound.log
# Direct tsx binary (NOT `npx tsx`) — avoids npm-exec resolution overhead on every boot.
nohup node_modules/.bin/tsx inbound-server.ts >> /var/log/inbound.log 2>&1 &
