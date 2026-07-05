# Invogen Setup Guide

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB connection string |
| `JWT_ACCESS_SECRET` | JWT access token secret (min 32 chars) |
| `JWT_REFRESH_SECRET` | JWT refresh token secret |
| `RAZORPAY_KEY_ID` | Razorpay API key |
| `RAZORPAY_KEY_SECRET` | Razorpay API secret |
| `API_PUBLIC_URL` | Public base URL for uploaded file links |
| `SMTP_*` | Email configuration (optional in dev) |

## MongoDB (no Docker)

### Local install

**Windows**

1. Download and install [MongoDB Community Server](https://www.mongodb.com/try/download/community)
2. Start MongoDB:
   ```powershell
   net start MongoDB
   ```
   Or start **MongoDB Server** from Windows Services (`services.msc`).
3. Use in `.env`:
   ```
   MONGODB_URI=mongodb://localhost:27017/invogen
   ```

**macOS (Homebrew)**

```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

**Linux**

```bash
sudo systemctl start mongod
sudo systemctl enable mongod
```

### MongoDB Atlas (cloud)

1. Create a cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas)
2. Add your IP to the allowlist and create a database user
3. Copy the connection string into `.env`:
   ```
   MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/invogen
   ```

## Development

1. Ensure MongoDB is running (local service or Atlas)
2. `npm install`
3. `npm run build -w shared`
4. `npm run seed`
5. `npm run dev`

## Email (optional in dev)

Registration and password-reset emails use SMTP. Without a mail server, those flows still work in the API but emails won't be delivered.

## File uploads

Logos, signatures, and images are stored in MongoDB (`Media` collection), not an external CDN. Upload via `POST /api/v1/uploads/image`; use the returned `url` in templates and company settings.

## Production

```bash
npm run build
npm run start -w server
```

Serve client `dist/` via nginx or CDN.

## Razorpay Webhooks

Configure webhook URL: `https://your-domain.com/api/v1/webhooks/razorpay`

Events: `payment.captured`, `subscription.activated`, `subscription.cancelled`
