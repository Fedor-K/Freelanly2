# Freelanly - Remote Job Board

## Overview
Freelanly is a Next.js 16 job board application that aggregates remote job listings from LinkedIn and top companies. It features user authentication (NextAuth v5), Stripe integration for subscriptions, and Prisma ORM with PostgreSQL.

## Tech Stack
- **Framework**: Next.js 16 (React 19)
- **Database**: PostgreSQL with Prisma ORM v5
- **Authentication**: NextAuth v5 (next-auth beta) with Google OAuth and Magic Link (Resend)
- **Styling**: Tailwind CSS v4
- **Payments**: Stripe
- **UI Components**: Radix UI, Lucide React icons

## Project Structure
```
src/
├── app/           # Next.js App Router pages
├── components/    # React components
├── lib/           # Utilities, auth, database
├── config/        # Site configuration
prisma/
├── schema.prisma  # Database schema
├── seed.ts        # Database seeding script
public/            # Static assets
```

## Development Commands
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run db:push` - Push Prisma schema to database
- `npm run db:generate` - Generate Prisma client
- `npm run db:seed` - Seed database with sample data

## Environment Variables Required
- `DATABASE_URL` - PostgreSQL connection string (auto-configured by Replit)
- `AUTH_SECRET` - NextAuth.js secret key
- `GOOGLE_CLIENT_ID` - Google OAuth client ID (optional, for Google sign-in)
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret (optional)
- `STRIPE_SECRET_KEY` - Stripe API key (optional, for payments)

## Recent Changes (Dec 25, 2025)
- Configured for Replit environment
- Set up PostgreSQL database
- Added AUTH_SECRET for authentication
- Configured Next.js for Replit proxy with allowedDevOrigins
- Set up deployment configuration for autoscale

## Port Configuration
- Development: Port 5000 (0.0.0.0)
- The app is configured to accept requests from Replit proxy domains
