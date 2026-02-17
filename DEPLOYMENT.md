# Deployment Guide

## Quick Start (Fresh Deployment)

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Database & Seed
```bash
npm run setup
```

This command will:
- Apply database migrations
- Create a default user
- Add sample accounts (Broker, Crypto Exchange, Bank)

### 3. Start Development Server
```bash
npm run dev
```

Open http://localhost:3000

---

## Default User

After seeding, a default user is created:
- **Email**: `user@example.com`
- **Name**: Default User

---

## Database Commands

| Command | Description |
|---------|-------------|
| `npm run setup` | Full setup (install + migrate + seed) |
| `npm run db:setup` | Migrate + seed only |
| `npm run db:migrate` | Run migrations in dev mode |
| `npm run db:seed` | Seed database with default data |
| `npm run db:reset` | Reset DB and re-seed (⚠️ loses all data) |

---

## Manual Setup (If Needed)

### Step 1: Database Migration
```bash
npx prisma migrate deploy
```

### Step 2: Seed Data
```bash
npx tsx prisma/seed.ts
```

### Step 3: Generate Prisma Client
```bash
npx prisma generate
```

---

## Environment Variables (Optional)

Create `.env.local` for production API keys:
```bash
# Optional: For auto price fetching
FINNHUB_API_KEY="your_finnhub_api_key"
COINGECKO_API_KEY="your_coingecko_api_key"
```

---

## Production Build

```bash
npm run build
npm start
```

---

## SQLite Database Location

The database file is stored at:
- **Development**: `prisma/dev.db`
- **Production**: Set `DATABASE_URL` environment variable

---

## Troubleshooting

### Issue: "Database file not found"
Run: `npm run db:setup`

### Issue: "Migration already applied"
Run: `npm run db:reset` (⚠️ This deletes all data)

### Issue: "Prisma client not found"
Run: `npx prisma generate`
