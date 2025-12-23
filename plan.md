Phase 0 MVP: Live Polymarket Volume Visualizer
What this MVP is (very specific)

A live market map where:

Each market = box or circle

Size = current trading volume / liquidity

Color = YES/NO probability

Blue = YES leaning

Red = NO leaning

Motion = volume change

Growing/shrinking size in near-real time

This answers one question only:

“Where is attention and money flowing right now?”

No signals. No AI. No explanations.
Just attention flow.

What this MVP is NOT

❌ No predictions
❌ No alerts
❌ No dependency graphs
❌ No hedging
❌ No opinions

If you add these now, you will kill velocity.

Who this MVP is for

Power users scanning markets

Journalists watching narratives

Crypto-native traders looking for attention shifts

You (as a foundation for later signal layers)

Casual users will not care yet. That’s fine.

Core design decisions (lock these)
1. Visualization type

Pick one for MVP:

Grid of rectangles (Finviz-style) recommended

Circles (bubble chart) harder to read

Rectangles:

Better density

Easier hover / click

Familiar mental model

2. Market inclusion rules (critical)

If you show everything → noise.

Hard filters

Minimum volume (e.g. > $5k)

Active markets only

Exclude resolved / near-expiry junk

This is not optional.

3. Encoding rules (simple & consistent)
Visual	Meaning
Box size	Total volume or open interest
Box color	YES vs NO probability
Color intensity	Strength of probability
Border pulse	Recent volume spike

Do not encode more than this.

Live-ness: what “live” actually means

True real-time WebSockets is overkill for MVP.

Definition of live (acceptable)

Poll Polymarket every 10–30 seconds

Animate transitions smoothly

Show “updated X seconds ago”

Users perceive this as live.

Technical MVP plan (very concrete)
Frontend (main work)

Next.js + TypeScript

Canvas or SVG-based grid

D3 for layout, not charts

CSS transitions for smooth resizing

Backend (minimal)

Thin proxy to Polymarket API

Cache responses

Normalize data

You could even skip backend initially and call Polymarket directly.

Data model (minimal)
type MarketNode = {
  id: string
  question: string
  volume: number
  volumeDelta: number
  yesProb: number
  lastUpdated: number
}

Rendering logic (pseudo)
size = sqrt(volume)
color = interpolateRedBlue(yesProb)
pulse = volumeDelta > threshold

MVP feature checklist (must-have only)
✅ Must-have

Volume-weighted grid

Live updates

Hover tooltip

Category filter

Volume threshold slider

❌ Not now

Search

Deep market pages

Alerts

Wallets

AI

UX flow (10 seconds max)

User opens site

Immediately sees:

Where boxes are growing

Where color is shifting

Hovers → sees:

Market question

Volume

Δ volume (last 10m / 1h)

If this takes >10 seconds, you failed.