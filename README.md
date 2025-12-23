# Polymarket Live Visualizer

A treemap-based, real-time visualizer for Polymarket prediction markets that highlights where interest and money are flowing in real-time.

## Features
- **Volume-Weighted Treemap**: Market box size corresponds to total trading volume.
- **Probability Heatmap**: Tiles are colored on a Red (NO) to Blue (YES) gradient based on outcome probability.
- **Real-Time Polling**: Automatically refreshes data from the Polymarket API every 15 seconds.
- **Dynamic Filters**: Volume threshold slider to filter out noise and focus on high-impact markets.
- **API Proxy**: Built-in Next.js proxy route to handle CORS and normalize data.

## Tech Stack
- **Framework**: [Next.js](https://nextjs.org/) (App Router, TypeScript)
- **Visualization**: [D3.js](https://d3js.org/) for Treemap layout & calculations.
- **Data Fetching**: [SWR](https://swr.vercel.app/) for polling and stale-while-revalidate caching.
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)

## Running Locally

### 1. Installation
Navigate to the `web` directory and install dependencies:
```bash
cd web
npm install
```

### 2. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3001](http://localhost:3001) in your browser.

## Project Structure
- `web/src/app/api/markets`: Next.js Proxy route for API requests.
- `web/src/components/viz/MarketMap.tsx`: Main D3-based Treemap component.
- `web/src/hooks/useMarketData.ts`: Data management and polling hook.
- `web/src/lib/api.ts`: Polymarket API client with data normalization.

