# Invogen

Premium SaaS invoice builder built with the MERN stack. Drag-and-drop templates, multi-tenant workspaces, Razorpay subscriptions, and role-based access control.

## Tech Stack

- **Frontend**: React, Vite, TypeScript, Tailwind CSS, Redux Toolkit, React Query, Dnd Kit, Framer Motion
- **Backend**: Node.js, Express, TypeScript, MongoDB, Mongoose, JWT
- **Payments**: Razorpay
- **Storage**: MongoDB (images and file uploads)

## Quick Start

### Prerequisites

- Node.js 18+
- **MongoDB** — local install or [MongoDB Atlas](https://www.mongodb.com/atlas) (no Docker required)

### Setup

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Build shared package
npm run build -w shared

# Seed database (requires MongoDB running)
npm run seed

# Start dev servers (client + API)
npm run dev
```

- **Client**: http://localhost:5173
- **API**: http://localhost:5000/api/v1/health

### MongoDB (no Docker)

**Option A — Local install (Windows)**

1. Install [MongoDB Community Server](https://www.mongodb.com/try/download/community)
2. Start the service: `net start MongoDB` (or enable **MongoDB Server** in Windows Services)
3. Default URI in `.env`: `mongodb://localhost:27017/invogen`

**Option B — MongoDB Atlas (cloud)**

1. Create a free cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas)
2. Set `MONGODB_URI` in `.env` to your Atlas connection string

### Default Super Admin

- Email: `admin@invogen.app`
- Password: `Admin@123456`

## Project Structure

```
invogen/
├── client/          # React frontend
├── server/          # Express API
├── shared/          # Shared TypeScript types
└── docs/            # Documentation
```

## User Roles

| Role | Login URL | Access |
|------|-----------|--------|
| Super Admin | `/super-admin/login` | Platform management |
| Admin | `/admin/login` | Workspace owner |
| Employee | `/employee/login` | Limited invoice access |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start client + server |
| `npm run seed` | Seed database |
| `npm run build` | Production build |

## Documentation

- [Setup Guide](docs/SETUP.md)
- [API Reference](docs/API.md)
