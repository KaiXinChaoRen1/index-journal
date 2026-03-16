# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **First, read [AGENTS.md](./AGENTS.md)** for project philosophy, product principles, and what we explicitly do NOT do. Then return here for practical commands and workflows.

## Project Overview

Index Journal is a personal market observation dashboard focused on US index ETFs (SPY for S&P 500, QQQ for Nasdaq 100). It is both a real tool for daily market checking and a learning project for AI collaboration and TypeScript/Next.js development.

Key characteristics:
- Uses ETFs as index proxies due to lower API complexity
- Stores historical data locally in SQLite for self-computed metrics
- Emphasizes code readability and learning value over cleverness
- Minimalist UI design - "more buttons makes it a tool, not a product"

## Common Commands

```bash
# Development
npm run dev:restart      # Recommended: kills existing process if needed, then starts
npm run dev              # Standard start (fails if port 3000 is occupied)

# Building
npm run build            # Build for production
npm run start            # Start production server

# Code Quality
npm run lint             # Run ESLint
npm run test             # Run Vitest tests

# Database
npm run db:generate      # Generate Prisma client after schema changes
npm run db:push          # Push schema changes to SQLite

# Data Sync (requires TWELVE_DATA_API_KEY in .env)
npm run sync:data        # Full sync - backfills history + incremental update
npm run sync:morning     # Morning snapshot only (SPY/QQQ quote)
npm run sync:eod         # End-of-day official data sync
npm run setup:data       # Setup: generate + push + sync
```

## Project Structure

```
app/                     # Next.js App Router
  page.tsx               # Home page - market dashboard
  log/page.tsx           # Development log page
  forex/page.tsx         # Forex observation page
  btc/page.tsx           # BTC observation page
  cn-funds/page.tsx      # Domestic fund quarterly reports
  otc-funds/page.tsx     # OTC fund quarterly reports
  api/                   # API routes
    market/              # Market data endpoints
    forex/               # Forex data endpoints
    btc/                 # BTC data endpoints
    manual-snapshot/     # Manual refresh control
    cn-funds/            # Fund report endpoints
  components/            # React components

lib/                     # Service layer - core business logic
  index-data.ts          # Home page data service (most important)
  forex-data.ts          # Forex data service
  btc-data.ts            # BTC data service
  price-analytics.ts     # Metric calculations (returns, drawdowns)
  market-shared.ts       # Shared market utilities
  manual-snapshot.ts     # Manual refresh logic with throttling
  dual-track-sync.ts     # Morning snapshot vs EOD compensation
  cn-fund-quarterly.ts   # Fund report parsing from CSRC
  prisma.ts              # Prisma client singleton

scripts/                 # Data synchronization scripts
  sync-index-data.mjs    # Twelve Data time_series sync
  sync-morning-snapshot.mjs  # Morning quote snapshot

prisma/
  schema.prisma          # SQLite schema definition

docs/                    # Documentation
  architecture.md        # Data flow and module responsibilities
  reading-guide.md       # Reading order for new maintainers
  development.md         # Development workflow and troubleshooting
```

## Key Architecture Decisions

### Dual-Track Data Strategy
The project maintains two parallel data sources for the home page header:
- **MorningCloseSnapshot**: Quick morning view of previous close (from `quote` API)
- **DailyPrice**: Official EOD data for metrics and charts (from `time_series` API)

See `lib/dual-track-sync.ts` for the compensation logic that handles timing gaps.

### Local Metric Calculation
All metrics (daily/weekly/monthly returns, CAGR, drawdowns) are computed locally from SQLite data in `lib/price-analytics.ts`. This ensures stable methodology even if data sources change.

### Manual Refresh with Throttling
User-initiated refreshes are grouped by page (`market`/`forex`/`btc`) and throttled to 5-minute intervals. Failed requests don't break the UI - they show error states while keeping historical data visible. See `lib/manual-snapshot.ts`.

### Page Group Refresh Rules
- **BTC**: 7x24 refresh allowed
- **Market/Forex**: Only during NY regular trading hours (9:30-16:00 ET, weekdays)

## Development Guidelines

### Adding a New Page
1. Create `app/[page]/page.tsx`
2. Add service functions in `lib/[page]-data.ts`
3. Add API routes in `app/api/[page]/route.ts` if needed
4. Update `app/components/site-menu.tsx` for navigation

### Adding a Database Table
1. Modify `prisma/schema.prisma`
2. Run `npm run db:generate && npm run db:push`
3. Add service functions in `lib/`
4. Never write DB access directly in page components

### Code Style
- Prefer clear, readable code over terse expressions
- Comment "why", not "what" - especially for business rules, time boundaries, and product constraints
- Keep page components thin - heavy lifting belongs in `lib/`
- Use Chinese comments for business logic to support learning/review

### Commit and Verification Workflow
- After completing a round of changes, check if a commit is appropriate (unless explicitly told "don't commit yet")
- Before committing page/interactive changes, ensure the dev server is running and pages are accessible for browser verification
- Verify `npm run lint` and `npm run build` pass before committing
- Form meaningful commit messages that explain what was solved, not just "update"
- This preserves rollback points and makes debugging easier

### Data Flow Pattern
```
Page (app/) -> Service (lib/) -> Prisma -> SQLite
                |
                v
         API Route (app/api/) for JSON endpoints
```

## Testing

Tests use Vitest. Run with `npm run test`. Current test files follow the pattern `lib/*.test.ts`.

## Environment Setup

Required in `.env`:
```
DATABASE_URL="file:./dev.db"
TWELVE_DATA_API_KEY="your_twelve_data_api_key"
```

Initial setup:
```bash
npm install
npm run db:generate
npm run db:push
npm run sync:data
npm run dev
```

## Troubleshooting

- **No data on home page**: Check if `npm run sync:data` has been run
- **Sync failures**: Verify `TWELVE_DATA_API_KEY` is set and valid
- **10Y metrics show "insufficient data"**: Check if historical data covers the period
- **Manual refresh unavailable**: Check trading hours (BTC 7x24, others NY hours only)
- **Fund reports not parsing**: Ensure `pdf-parse@1.1.1` is installed (not newer versions)

## Important Files for Understanding

1. `lib/index-data.ts` - Core home page data logic
2. `lib/price-analytics.ts` - All metric calculations
3. `lib/manual-snapshot.ts` - Refresh control and throttling
4. `lib/dual-track-sync.ts` - Morning/EOD data reconciliation
5. `app/page.tsx` - Home page component
6. `prisma/schema.prisma` - Database structure
