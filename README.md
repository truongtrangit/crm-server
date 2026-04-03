# CRM Server

Node.js + Express + MongoDB backend for the CRM client.

API integration document for FE: [docs/API.md](docs/API.md)

## Features

- Customer CRUD
- User auth with login/register/logout/refresh session
- Staff CRUD backed by the user model
- Lead CRUD + status update
- Task CRUD
- Organization departments/groups
- Metadata endpoints for roles, departments, platforms and customer groups
- Seed data aligned with the current CRM client screens

## Setup

1. Copy `.env.example` to `.env`
2. Start MongoDB locally or update `MONGO_URI`
3. Install dependencies if needed:
   - `npm install`
4. Run the server:
   - `npm run dev`

## Scripts

- `npm run dev` - run with Node watch mode
- `npm start` - run normally
- `npm run check` - syntax check server files

## API

Base URL: `http://localhost:4000/api`

### Core routes

- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`
- `POST /auth/register`
- `GET /customers`
- `POST /customers`
- `GET /customers/:id`
- `PUT /customers/:id`
- `DELETE /customers/:id`
- `GET /staff`
- `POST /staff`
- `PUT /staff/:id`
- `DELETE /staff/:id`
- `GET /leads`
- `POST /leads`
- `PUT /leads/:id`
- `PATCH /leads/:id/status`
- `DELETE /leads/:id`
- `GET /tasks`
- `POST /tasks`
- `PUT /tasks/:id`
- `DELETE /tasks/:id`
- `GET /organization`
- `POST /organization/departments`
- `POST /organization/groups`
- `GET /metadata`
- `GET /metadata/roles`
- `GET /metadata/departments`
- `GET /metadata/customer-groups`
- `GET /functions`
- `POST /functions`

## Notes

- The server migrates legacy data from the `staffs` collection into `users` on startup, then cleans the old collection.
- Migrated accounts get the default password from `MIGRATED_USER_DEFAULT_PASSWORD`.
- The server seeds starter data automatically when required records are missing.
- Business APIs require a valid bearer access token.
- Refresh token can be sent by cookie for web or by body/header for mobile.
- Demo accounts:
  - Owner: `owner@crm.vn` / `Owner@123`
  - Admin: `admin@crm.vn` / `Admin@123`
  - Manager: `manager.sale@crm.vn` / `Manager@123`
  - Staff: `staff1@crm.vn` / `Staff@123`
- IDs are kept compatible with the client mock format such as `CUST001`, `USER001`, `LEAD001`, and `#00001`.
