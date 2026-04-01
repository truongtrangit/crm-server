# CRM Server

Node.js + Express + MongoDB backend for the CRM client.

## Features

- Customer CRUD
- Staff CRUD
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

- The server seeds starter data automatically when collections are empty.
- IDs are kept compatible with the client mock format such as `CUST001`, `STAFF001`, `LEAD001`, and `#00001`.
