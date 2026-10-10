# Connectify

Connectify is a real-time community chat platform that enables users to join interest-based groups, connect with people around the world, and communicate through live messaging. The app combines a modern React frontend with a scalable Node.js/Express backend, PostgreSQL for persistence, Redis for caching and session-related behavior, and Socket.IO for real-time messaging.

## Features

- Real-time group chat and instant messaging
- User authentication and session management
- Google OAuth sign-in support
- Public and private community rooms
- User profile management and avatar uploads
- Online presence tracking and room membership checks
- Rate limiting and security middleware
- Cloudinary-powered media uploads
- Email-based flows for verification and notifications
- Docker-ready backend deployment

## Tech Stack

### Frontend
- React
- Vite
- React Router
- Socket.IO client

### Backend
- Node.js
- Express
- Socket.IO
- PostgreSQL
- Redis
- JWT authentication
- Cloudinary
- Nodemailer

## Project Structure

```text
Connectify/
├── client/                 # React frontend
│   ├── src/
│   ├── package.json
│   └── vite.config.js
├── server/                 # Express + Socket.IO backend
│   ├── src/
│   ├── Dockerfile
│   ├── package.json
│   └── ...
├── AWS_Architecture_Explained (1).md
├── Connectify_AWS_Deployment_Master_Guide.md
├── Connectify_Cloudflare_Deployment_Master_Guide.md
├── DOCKER_GUIDE.md
├── Docker_and_Deployment_Guide.md
└── README.md              # This file
```

## Prerequisites

Before running the project locally, make sure you have the following installed:

- Node.js 18+
- npm
- PostgreSQL
- Redis
- A modern browser

## Environment Setup

Create a `.env` file inside the `server` directory with the values below:

```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
COOKIE_SECRET=your_cookie_secret

JWT_ACCESS_SECRET=your_access_secret
JWT_REFRESH_SECRET=your_refresh_secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

DB_HOST=localhost
DB_PORT=5432
DB_NAME=connectify
DB_USER=postgres
DB_PASSWORD=your_db_password

REDIS_URL=redis://localhost:6379

GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/v1/auth/google/callback

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@example.com
SMTP_PASS=your_email_password
EMAIL_FROM="Connectify <your_email@example.com>"
```

## Local Development

### 1. Install backend dependencies

```bash
cd server
npm install
```

### 2. Install frontend dependencies

```bash
cd client
npm install
```

### 3. Start the backend

```bash
cd server
npm run dev
```

The API server will run on:

- http://localhost:5000
- Health check: http://localhost:5000/health

### 4. Start the frontend

```bash
cd client
npm run dev
```

The frontend will run on:

- http://localhost:5173

## Production Build

### Frontend build

```bash
cd client
npm run build
```

The generated production files are placed in the `dist` folder.

## Docker and Deployment

This project includes deployment and infrastructure documentation for cloud hosting, including:

- `Docker_and_Deployment_Guide.md`
- `DOCKER_GUIDE.md`
- `Connectify_AWS_Deployment_Master_Guide.md`
- `Connectify_Cloudflare_Deployment_Master_Guide.md`

These guides cover deployment patterns and infrastructure setup for AWS and Cloudflare-based workflows.

## Notes

- The backend uses PostgreSQL as the main relational datastore for users, rooms, and messages.
- Redis is used for caching, rate limiting support, and real-time presence features.
- Socket.IO handles live room communication and user presence updates.
- Cloudinary is used for profile and media uploads.

