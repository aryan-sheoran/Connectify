# Connectify — Complete Step-by-Step Cloudflare Deployment Master Guide

This guide provides a complete, unified, end-to-end walkthrough for deploying the **Connectify** application using **Cloudflare** as the core edge network, DNS provider, security shield, and frontend host.

---

## Architecture Overview & Roadmap

```
                                 ┌────────────────────────────────────────────────────────┐
                                 │                   Cloudflare DNS                       │
                                 │       Global Anycast Network + DDoS & WAF Shield       │
                                 └───────────┬────────────────────────────────┬───────────┘
                                             │                                │
                              yourdomain.com │                                │ api.yourdomain.com
                                             ▼                                ▼
                      ┌───────────────────────────────┐     ┌───────────────────────────────────┐
                      │       Cloudflare Pages        │     │  Cloudflare Edge Proxy / CDN      │
                      │     (Static React Frontend)   │     │      (SSL/TLS + WebSockets)       │
                      └───────────────────────────────┘     └─────────────────┬─────────────────┘
                                                                              │
                                                                  ┌───────────┴───────────┐
                                                                  │ Cloudflare Tunnel OR  │
                                                                  │  Direct CNAME Ingress │
                                                                  └───────────┬───────────┘
                                                                              ▼
                                                            ┌───────────────────────────────────┐
                                                            │     Node.js Backend Container     │
                                                            │    (Express + Socket.IO Server)   │
                                                            │   Hosted on PaaS / Docker / VPS   │
                                                            └───────┬───────────────────┬───────┘
                                                                    │                   │
                                                                    ▼                   ▼
                                                            ┌───────────────┐   ┌───────────────┐
                                                            │ PostgreSQL DB │   │ Upstash Redis │
                                                            │(Neon/Supabase)│   │ (Pub/Sub)     │
                                                            └───────────────┘   └───────────────┘
```

### Component Responsibility Matrix

| Component | Folder | Technology / Service | Deployment Target | Role |
|---|---|---|---|---|
| **Frontend** | `client/` | React + Vite | **Cloudflare Pages** | Global CDN static asset hosting & SPA routing |
| **Backend** | `server/` | Express + Socket.IO | **Cloudflare Proxy + PaaS / Docker / VPS** | Real-time WebSocket connection & REST API server |
| **DNS & Security** | N/A | Cloudflare DNS / WAF | **Cloudflare Dashboard** | Free SSL, Anycast DNS, DDoS protection, Edge Caching |
| **Database** | N/A | PostgreSQL (Neon / Supabase / Render) | **Managed Postgres (+ Cloudflare Hyperdrive)** | Relational data persistence & connection pooling |
| **Cache & Real-time**| N/A | Redis (Upstash / Redis Cloud) | **Managed Redis** | Socket.IO Redis adapter & cache |
| **Media Storage** | N/A | Cloudinary | **Cloudinary CDN** | User avatar & post attachment media hosting |

---

## Phase 0: Domain Setup & Cloudflare Onboarding

### Step 0.1 — Add Domain to Cloudflare
1. Log into your [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. Click **Add a Site** in the top right corner.
3. Enter your registered domain name (e.g., `yourdomain.com`) and select the **Free Plan**.
4. Cloudflare will automatically scan your existing DNS records. Click **Continue**.

### Step 0.2 — Update Nameservers at Your Domain Registrar
1. Cloudflare will assign two custom Nameservers (e.g., `ada.ns.cloudflare.com` and `sam.ns.cloudflare.com`).
2. Log into your domain registrar (Namecheap, GoDaddy, NameSilo, Google Domains/Porkbun, etc.).
3. Navigate to **Domain Management** -> **Nameservers** -> Select **Custom DNS**.
4. Paste the 2 Cloudflare Nameservers and save.
5. Back in Cloudflare, click **Check nameservers now**. Propagation usually takes 2–15 minutes.

---

## Phase 1: Database & Redis Provisioning

Setting up your managed database and cache first ensures you have connection URIs ready when configuring the backend.

### Step 1.1 — Managed PostgreSQL Database
Since Cloudflare Workers edge runtime is serverless while your backend is an Express Node.js application, choose a cloud PostgreSQL provider with instant connection pooling:
- **Options**: [Neon.tech](https://neon.tech), [Supabase](https://supabase.com), or [Render Postgres](https://render.com).
1. Create a PostgreSQL database instance.
2. Copy the connection string (e.g., `postgres://username:password@ep-xyz.region.aws.neon.tech/connectify?sslmode=require`).
3. *(Optional)* **Cloudflare Hyperdrive**: If you wish to accelerate database connection latency from Cloudflare's edge, create a Hyperdrive binding in Cloudflare Dashboard under **Workers & Pages** -> **Hyperdrive**.

### Step 1.2 — Managed Redis (Upstash Redis)
Connectify uses Redis for Socket.IO multi-instance pub/sub state and caching.
1. Sign up at [Upstash](https://upstash.com) or [Redis Cloud](https://redis.com).
2. Create a new **Redis Database**.
3. Copy the Redis connection URL (e.g., `rediss://default:password@region.upstash.io:6379`).

---

## Phase 2: Deploying the Frontend (`client/`) to Cloudflare Pages

Cloudflare Pages provides free, high-performance static hosting for React + Vite apps with global CDN distribution.

### Step 2.1 — Prepare Frontend Build Configuration
1. In your `client/` folder, ensure your code reads the backend API URL from environment variables (`import.meta.env.VITE_API_URL`).
2. Create or verify `client/public/_redirects` to handle Single Page App (SPA) client-side routing on page refreshes:
   ```text
   /*    /index.html   200
   ```

### Step 2.2 — Deploy via Git Integration (Recommended)
1. Push your repository to GitHub or GitLab.
2. In Cloudflare Dashboard, go to **Workers & Pages** -> **Create application** -> **Pages** -> **Connect to Git**.
3. Select your `Connectify` repository.
4. Configure Build Settings:
   - **Framework preset**: `Vite`
   - **Root directory**: `client`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
5. Expand **Environment Variables (Advanced)** and add:
   - `VITE_API_URL` = `https://api.yourdomain.com`
6. Click **Save and Deploy**. Cloudflare will build and host your site at `connectify-client.pages.dev`.

### Step 2.3 — Deploy via Cloudflare Wrangler CLI (Alternative Direct CLI Method)
If you prefer deploying directly from your PC without linking GitHub:
1. Navigate to the `client/` folder:
   ```bash
   cd client
   ```
2. Build the production output:
   ```bash
   npm run build
   ```
3. Deploy the `dist` folder to Cloudflare Pages:
   ```bash
   npx wrangler pages deploy dist --project-name=connectify-client
   ```

### Step 2.4 — Bind Custom Domain to Cloudflare Pages
1. In Cloudflare Dashboard, select **Workers & Pages** -> Click your `connectify-client` project.
2. Go to **Custom Domains** tab -> Click **Set up a custom domain**.
3. Enter your domain name: `yourdomain.com` (and optionally `www.yourdomain.com`).
4. Click **Continue**. Cloudflare automatically configures DNS CNAME records and generates a free SSL certificate.

---

## Phase 3: Deploying the Backend (`server/`)

Your backend uses Express, `socket.io`, `pg`, `redis`, `passport`, and `multer`. To run standard Node.js & WebSockets without refactoring, host the server container/process on a Node provider while putting Cloudflare in front for DNS, SSL, WAF, and WebSocket proxying.

### Option A: Hosting on Managed Container PaaS (Render / Railway / Fly.io) + Cloudflare Edge

1. **Deploy `server/` to PaaS**:
   - Push your project to GitHub.
   - On **Render** / **Railway** / **Fly.io**, create a new Web Service pointing to `server/`.
   - Build Command: `npm install` (or Docker file build).
   - Start Command: `node src/server.js`.
   - Set Environment Variables:
     - `PORT` = `5000`
     - `DATABASE_URL` = `postgres://...`
     - `REDIS_URL` = `rediss://...`
     - `JWT_SECRET` = `your_secure_jwt_secret`
     - `CLIENT_URL` = `https://yourdomain.com`
     - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
2. **Obtain PaaS Endpoint**:
   - Save your server URL (e.g., `connectify-api.onrender.com` or `connectify-api.up.railway.app`).

### Option B: Hosting on VPS / Docker Host with Cloudflare Tunnel (Zero-Trust)

If hosting on a VPS (Hetzner, DigitalOcean, AWS EC2, or self-hosted server):
1. **Run Docker Container on Server**:
   ```bash
   cd server
   docker build -t connectify-backend .
   docker run -d -p 5000:5000 --name connectify-backend --env-file .env connectify-backend
   ```
2. **Install Cloudflare Tunnel (`cloudflared`)**:
   - Go to Cloudflare Dashboard -> **Zero Trust** -> **Networks** -> **Tunnels** -> **Create a Tunnel**.
   - Select **Cloudflared Connector** and run the install command on your server.
3. **Route Public Hostname**:
   - Domain: `api.yourdomain.com`
   - Service Type: `HTTP`
   - URL: `localhost:5000`
   - *Result: Your server backend is securely exposed to the web through Cloudflare without opening any inbound ports on your server firewall!*

---

## Phase 4: Cloudflare DNS & WebSockets Network Configuration

### Step 4.1 — Verify DNS Records in Cloudflare
Go to **Cloudflare Dashboard** -> **DNS** -> **Records**:

| Type | Name | Target / Content | Proxy Status | Purpose |
|---|---|---|---|---|
| **CNAME** | `@` | `connectify-client.pages.dev` | 🟠 Proxied (Orange Cloud) | Frontend Root Domain |
| **CNAME** | `www` | `connectify-client.pages.dev` | 🟠 Proxied (Orange Cloud) | Frontend WWW Subdomain |
| **CNAME** | `api` | `connectify-api.onrender.com` *(or Tunnel ID)* | 🟠 Proxied (Orange Cloud) | Backend API & WebSockets |

### Step 4.2 — Configure SSL/TLS Settings
1. Go to **SSL/TLS** -> **Overview**.
2. Change encryption mode to **Full (Strict)** (or **Full** if using self-signed cert on backend).
3. Go to **SSL/TLS** -> **Edge Certificates**:
   - Turn ON **Always Use HTTPS**.
   - Turn ON **Automatic HTTPS Rewrites**.
   - Minimum TLS Version: **TLS 1.2**.

### Step 4.3 — Enable WebSockets & Network Settings
Socket.IO requires WebSockets proxying through Cloudflare:
1. Go to **Network** settings in Cloudflare Dashboard.
2. Ensure **WebSockets** is toggled **ON** (Enabled by default on Cloudflare).
3. Ensure **gRPC** is toggled ON if using gRPC dependencies.
4. Set **Session Affinity (Sticky Sessions)**:
   - If hosting multiple backend instances behind a load balancer, enable Cloudflare Load Balancing Session Affinity or ensure Socket.IO uses the Redis Adapter for cross-instance state synchronization.

---

## Phase 5: Environment Variables & Security Configuration

### Step 5.1 — Client `.env.production` Setup
Location: `client/.env.production`
```env
VITE_API_URL=https://api.yourdomain.com
```

### Step 5.2 — Server `.env` Configuration
Location: `server/.env`
```env
PORT=5000
NODE_ENV=production

# Database & Cache
DATABASE_URL=postgres://username:password@host:5432/connectify?sslmode=require
REDIS_URL=rediss://default:password@host:6379

# Authentication & CORS
CLIENT_URL=https://yourdomain.com
JWT_SECRET=super_secret_jwt_token_key_change_in_production
JWT_EXPIRES_IN=7d

# Media Cloud Storage
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# OAuth (Google)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=https://api.yourdomain.com/api/auth/google/callback

# Mail Services
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
```

### Step 5.3 — Cloudflare WAF & Rate Limiting Rules
1. Go to **Security** -> **WAF** -> **Rate limiting rules**.
2. Create a rule to protect sensitive auth endpoints:
   - **Rule Name**: Protect Login & Register
   - **Expression**: `(http.request.uri.path contains "/api/auth/login")`
   - **Action**: Block / Managed Challenge if requests exceed `10 requests per 1 minute`.

---

## Phase 6: Verification & Final Testing Checklist

Execute the following checks after deployment is completed:

- [ ] **DNS Resolution**: Run `nslookup yourdomain.com` in PowerShell/Terminal. It should return Cloudflare Anycast IP addresses.
- [ ] **Frontend Loading**: Open `https://yourdomain.com` in browser. Verify styles, React routes, and dynamic components render cleanly without HTTP/HTTPS mixed-content warnings.
- [ ] **API Health Check**: Visit `https://api.yourdomain.com/health` (or check Network tab in browser developer tools). Verify CORS header `Access-Control-Allow-Origin: https://yourdomain.com` is present.
- [ ] **WebSockets Connection**: Open browser console on `https://yourdomain.com`. Verify Socket.IO establishes a WSS (`wss://api.yourdomain.com/socket.io/...`) connection with `status 101 Switching Protocols`.
- [ ] **Google OAuth Redirects**: Test Google Sign-In button. Ensure callback routes correctly to `https://api.yourdomain.com/api/auth/google/callback` and returns back to `https://yourdomain.com`.
- [ ] **Media Uploads**: Upload a profile photo or post attachment. Confirm images upload to Cloudinary and display via CDN URLs.

---

## Summary Cheat Sheet

| Task | Command / Action | Output / Destination |
|---|---|---|
| **Build Frontend** | `cd client && npm run build` | Static files in `client/dist/` |
| **Deploy Frontend** | `npx wrangler pages deploy dist --project-name=connectify-client` | Cloudflare Pages (`yourdomain.com`) |
| **Configure DNS** | Set NameServers to Cloudflare in registrar | Cloudflare Anycast CDN & WAF |
| **Backend API** | Run Express container on PaaS/VPS behind Cloudflare Proxy | `https://api.yourdomain.com` |
| **Database Connection**| Managed Postgres (Neon/Supabase) via `DATABASE_URL` | Cloudflare Hyperdrive accelerated DB |
