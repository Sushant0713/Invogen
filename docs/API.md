# Invogen API Reference

Base URL: `/api/v1`

## Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Admin registration |
| POST | `/auth/login/:portal` | Login (super-admin, admin, employee) |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/logout` | Logout |
| GET | `/auth/me` | Current user |
| POST | `/auth/forgot-password` | Request password reset |
| POST | `/auth/reset-password/:token` | Reset password |
| GET | `/auth/verify-email/:token` | Verify email |

## Super Admin

Prefix: `/super-admin` (requires super_admin role)

- `GET /dashboard` - Platform analytics
- `GET /clients` - List tenant admins
- `PATCH /clients/:id/status` - Suspend/activate
- CRUD `/plans`, `/components`, `/templates`
- `GET /revenue`, `/invoices`, `/activity-logs`, `/support-tickets`
- `GET /settings`, `PATCH /settings/:key`

## Admin

Prefix: `/admin` (requires admin role)

- `GET /dashboard` - Workspace analytics
- CRUD `/employees`, `/customers`, `/products`
- CRUD `/invoices`, `/templates`
- `GET /reports/:type` - sales, gst, customers, products, outstanding
- `GET /subscription`, `POST /subscription/checkout`, `POST /subscription/verify`

## Employee

Prefix: `/employee` (requires employee role)

- `GET /dashboard`, `/invoices`, `/templates`
- `POST /invoices` - Create invoice (with permission)

## Uploads (MongoDB storage)

Files (logos, signatures, images) are stored in the `Media` collection.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/uploads/image` | Upload image (`multipart/form-data`, field: `file`) — returns `{ id, url }` |
| GET | `/uploads/:id` | Serve stored file by ID |
| DELETE | `/uploads/:id` | Delete file (authenticated, tenant-scoped) |

Uploaded file URLs look like: `http://localhost:5000/api/v1/uploads/{mediaId}`

## Webhooks

- `POST /webhooks/razorpay` - Razorpay payment events

## Response Format

```json
{
  "success": true,
  "data": {},
  "message": "Success",
  "meta": { "page": 1, "limit": 10, "total": 100, "totalPages": 10 }
}
```
