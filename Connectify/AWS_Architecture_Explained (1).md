# Connectify — AWS Architecture & Deployment Explained

This document walks through **Section 3 (AWS Production Architecture)** and **Section 4 (Step-by-Step Deployment Guide)** of the Connectify hosting guide, explaining **what** each component is, **why** it's used, and **how** it works together.

---

## Part 1: AWS Production Architecture — Component by Component

### Amazon Route 53 (DNS)
Route 53 is AWS's DNS service. Its only job is answering "where does this domain name point?" It splits incoming traffic two ways:
- Frontend requests (e.g. `yourdomain.com`) → **CloudFront**
- API / WebSocket requests (e.g. `api.yourdomain.com`) → **ALB**

**Why split them?** The frontend (static React build) and backend (a running Node process) have completely different hosting needs — one is just files to serve, the other is dynamic compute. Separating them lets each be scaled, cached, and secured independently.

> **❓ Do I need to buy two domains?**
> No — **you only need to buy one domain** (e.g. `yourdomain.com`). `api.yourdomain.com` is not a second domain — it's a **subdomain**, which is free and created *inside* Route 53 once you own the main domain.
>
> Here's how the split actually works with a single purchased domain:
> - You buy `yourdomain.com` once (from Route 53, or elsewhere and then point it at Route 53).
> - Inside Route 53, you create two **DNS records** under that same domain:
>   - `yourdomain.com` (an A/Alias record) → points to **CloudFront**
>   - `api.yourdomain.com` (an A/Alias record) → points to your **ALB**
> - Both records live under the same **Hosted Zone**, which you only set up once per domain.
>
> So the "split" is a DNS routing rule, not a separate purchase.

---

### Amazon CloudFront + S3 (Frontend Delivery)
- **S3** stores your built React files (`client/dist/`) as plain static objects. No server is needed to "run" HTML/CSS/JS — they're just served as-is.
- **CloudFront** is a CDN that caches those files at edge locations around the world.

**Why:** A user in Mumbai shouldn't have to fetch files from a bucket sitting in `us-east-1` every time. CloudFront caches nearby, making load times fast globally. This combo is also extremely cheap and scales infinitely without you managing any servers.

**How it works:** CloudFront pulls from S3 as its "origin," caches the response, and serves subsequent requests from the edge location closest to the user — only re-fetching from S3 when the cache expires or files change.

---

### Application Load Balancer (ALB)
The ALB sits in front of your backend and distributes incoming HTTP/WebSocket requests across multiple running backend containers.

**Why you need it (not just one server):**
1. **High availability** — if one container dies, the ALB routes traffic to healthy ones.
2. **Horizontal scaling** — you can run 2, 5, or 20 backend instances, and the ALB spreads load across all of them.
3. **SSL termination** — it handles HTTPS certificates so your backend containers only need to speak plain HTTP internally.

---

### VPC (Virtual Private Cloud) — Public vs Private Subnets
This is the core security design of the whole architecture. Think of the VPC as your own private, isolated network inside AWS.

- **Public Subnet:** Has a route to the internet. **Only the ALB lives here**, because it's the one thing that *must* be reachable from outside.
- **Private Subnets:** No direct route to/from the internet. Your **ECS containers**, **RDS database**, and **Redis cache** all live here.

**Why hide everything else in private subnets?**
If your database or app servers can't be reached directly from the internet, they can't be attacked directly — the ALB becomes the *only* legitimate entry point, and you control exactly what passes through it via Security Groups.

This is also exactly why trusting `X-Forwarded-For` with `app.set('trust proxy', 1)` (from Section 1 of the original guide) is safe here: since the ALB is the only path in, that one hop of proxy headers can be trusted without opening the door to IP-spoofing attacks.

---

### ECS Fargate (Backend Containers)
Fargate is a "serverless containers" service — you hand AWS a Docker image, and it runs it without you provisioning or managing EC2 servers yourself.

- The ALB forwards HTTPS traffic to these containers on **port 5000** (the port your Express app listens on).
- Running multiple tasks (the guide recommends **2**) gives you both redundancy (if one crashes, the other keeps serving) and true load balancing.

> **❓ What is ECS, and what's the difference between ECS Fargate and Docker containers?**
> These are three different layers, not competing alternatives — think of them as a stack, each one built on top of the last:
>
> | Layer | What it is | Analogy |
> |---|---|---|
> | **Docker** | The technology that *packages and runs* a container — a portable box containing your code, dependencies, and runtime. | The shipping container itself |
> | **ECS (Elastic Container Service)** | AWS's **orchestrator** — the system that decides *which* containers run, *how many* copies, restarts them if they crash, and connects them to the ALB. ECS doesn't run containers itself; it manages them. | The port authority deciding which ships dock where |
> | **ECS Fargate** | The **compute engine** that actually provides the servers your containers run on — but fully managed, so you never see or patch an EC2 instance. | The dock workers/cranes — but you never have to hire or manage them yourself |
>
> So the real comparison isn't "ECS Fargate vs. Docker" — it's:
> - **Docker** = *what* runs (your packaged app).
> - **ECS** = *the manager* deciding where/how it runs (this is where Task Definitions, Services, and Clusters live).
> - **Fargate** = *the underlying compute* ECS uses to actually run it, so you skip managing servers. (The alternative would be "ECS on EC2" mode, where you *do* manage the underlying servers yourself — Fargate removes that burden.)
>
> In short: you build a **Docker** image → you tell **ECS** how to run it (via a Task Definition) → **ECS Fargate** supplies the actual compute to run it, with zero server management on your end.

---

### Amazon RDS (PostgreSQL)
A fully managed Postgres database — AWS handles patching, backups, and failover for you.

- Lives in a **private subnet**.
- Only accepts connections on port `5432` from the ECS security group — nothing else.
- This is your persistent store: users, rooms, and messages.

---

### Amazon ElastiCache (Redis)
Redis serves two purposes in this architecture:
1. **General caching**, if used elsewhere in the app.
2. **Cross-instance pub/sub for Socket.IO** — the critical role. Since you're running *multiple* backend containers, Redis becomes the shared communication layer that lets them talk to each other (explained fully in Part 3 below).

---

### Cloudinary & Google OAuth (External SaaS)
These live entirely outside your VPC — they're third-party APIs your backend calls out to:
- **Cloudinary**: image hosting/CDN for uploads.
- **Google OAuth**: login/authentication.

You don't host these; your backend simply makes outbound requests to them.

---

## Part 2: Step-by-Step Deployment — Why Each Step Exists

### Step 1: Set Up RDS (PostgreSQL)
You create the database first because everything downstream (your backend containers) needs a `DB_HOST` to connect to before it can even start successfully.

- **Not publicly accessible** + **private subnet** + **security group locked to port 5432 from ECS only** means that even if someone discovers your DB's endpoint, they physically cannot connect unless the traffic originates from your own backend containers. This is enforced at the network level — a much stronger guarantee than a password alone.

### Step 2: Set Up ElastiCache (Redis)
Same reasoning as Step 1 — created early so that when you configure your backend's Socket.IO Redis adapter later, `REDIS_URL` is already available as a ready-to-use environment variable.

### Step 3: Containerize the Backend (Docker + ECR)
- **Docker** packages your Node app (code + dependencies + runtime) into one portable image, so it runs identically anywhere — your laptop, ECS, or any other cloud. This eliminates "works on my machine" problems.
- **ECR (Elastic Container Registry)** is AWS's private Docker image registry. Fargate pulls your image from here whenever it starts a new task.
- The `build → tag → push` sequence is the standard Docker workflow:
  1. `docker build` compiles your Dockerfile into an image.
  2. `docker tag` labels it with the ECR repository's URL so Docker knows where to send it.
  3. `docker push` uploads it to ECR.

### Step 4: Deploy Backend on ECS Fargate
Three ECS concepts work together here:
- **Cluster**: A logical grouping of resources where your tasks run (with Fargate, AWS manages the actual servers underneath).
- **Task Definition**: The *blueprint* — which Docker image to use, how much CPU/memory to allocate, which port to expose (5000), which environment variables/secrets to inject, and what IAM permissions the container needs (e.g., to pull secrets or images from ECR).
- **Service**: The component that actually *runs* the task definition continuously — it keeps your desired number of tasks (2, per the guide) alive, restarts any that crash, and automatically registers/deregisters them with the ALB's target group as they start and stop.

**Security group note:** The ECS security group only allows inbound traffic on port 5000 *from the ALB's security group* — not from the open internet. This reinforces the private-subnet isolation described in Part 1.

### Step 5: Configure the Application Load Balancer
- **Target Group**: Defines *where* the ALB sends traffic — in this case, IP addresses of your Fargate tasks on port 5000. It also runs **health checks** (hitting `/health` every 30s) so the ALB knows which tasks are actually healthy and should receive traffic.
  - **Sticky sessions** (Target Group Cookie Stickiness) are enabled here because of a WebSocket-specific problem — explained in Part 3 below.
- **Load Balancer**: The internet-facing resource itself, placed in public subnets across multiple Availability Zones (for redundancy — if one AZ has an outage, the ALB still works from the other).
- **Listeners**: Rules for handling incoming connections.
  - Port 80 (HTTP) → redirects to port 443 (HTTPS). This forces all traffic to be encrypted.
  - Port 443 (HTTPS) → uses an SSL certificate from **ACM (AWS Certificate Manager)** and forwards decrypted traffic to your target group.

### Step 6: Deploy the Frontend (S3 + CloudFront)
1. **Set the production API URL** in `.env.production` so the built frontend knows where to send API requests (your ALB's domain).
2. **Build the app** (`npm run build`) — this compiles React source into static HTML/CSS/JS bundles.
3. **Upload to S3** — the bucket stores these static files. Public access is disabled because...
4. **CloudFront + Origin Access Control (OAC)** is the *only* thing allowed to read from the bucket. This prevents people from bypassing your CDN and hitting S3 directly (which would be slower, more expensive, and harder to secure).
5. **Custom error page fallback** (404/403 → `/index.html` with a 200 status) exists because of how **client-side routing** works: if a user directly visits `yourdomain.com/chat/room123`, S3 has no literal file at that path (React Router handles that route *in the browser*, not on the server). Without this fallback, the user would see a raw S3 404 error instead of your app.
6. **ACM SSL certificate** attached to CloudFront ensures the frontend is also served over HTTPS.

---

## Part 3: Why WebSockets Need Special Handling (Ties Steps 4–5 Together)

This explains *why* two specific configurations above exist — sticky sessions and the Redis adapter.

### Problem A: The Handshake vs. Upgrade Mismatch
Socket.IO doesn't jump straight to a WebSocket connection. It starts with an HTTP long-polling handshake, then *upgrades* to a full WebSocket.

If your ALB has 2 backend tasks behind it and:
- The initial handshake request lands on **Task 1**
- The follow-up upgrade request lands on **Task 2** (because the ALB, by default, has no memory of which task served the last request)

...then Task 2 has no idea about the session Task 1 just created, and the connection fails with a `Session ID unknown` error.

**Fix:** Enable **Stickiness** (Load Balancer generated cookie) on the Target Group. This makes the ALB remember, via a cookie, which specific task a given client should always be routed to — so the handshake and the upgrade both land on the same task.

### Problem B: Messages Don't Cross Instances
Even with sticky sessions solving connection stability, a *new* problem emerges: if User A is stuck to Task 1 and User B is stuck to Task 2, and User A sends a message, `io.to(roomId).emit(...)` running on Task 1 has no way to reach User B's socket — because that socket physically lives in Task 2's memory.

**Fix:** The **Redis Pub/Sub Adapter** (`@socket.io/redis-adapter`). Every backend task connects to the *same* Redis instance. When Task 1 emits a message, it also publishes it to Redis; every other task (including Task 2) is subscribed and receives that message, then delivers it to its own locally-connected sockets.

**How it works step by step:**
1. All ECS tasks connect to the same Redis endpoint (`pubClient` and `subClient`).
2. `io.adapter(createAdapter(pubClient, subClient))` wires Socket.IO to use Redis instead of in-memory state for cross-instance broadcasting.
3. Now, `io.to(roomId).emit(...)` transparently works across *any* number of backend instances — a message from a user on Task 1 reaches a user on Task 2, Task 3, etc.

This is precisely why Redis appears twice in the architecture: once conceptually as a cache, and once as the critical nervous system connecting all your otherwise-isolated backend containers.

---

## Part 4: Complete Beginner's Console Walkthrough (Exact Clicks)

You've never used AWS before, so this section tells you **exactly where to click**, in order. Do these in sequence — later steps depend on earlier ones.

### 4.0 Before you start
1. Go to **aws.amazon.com** → **Create an AWS Account** → add a payment method (AWS has a free tier, but RDS/ALB/NAT Gateway will incur small charges).
2. Once logged in, use the **search bar at the top of the AWS Console** (not the sidebar) to jump to any service by typing its name — this is how you'll navigate everything below.
3. In the top-right corner, pick a **Region** close to your users (e.g. `us-east-1` or `ap-south-1`) and use the **same region for every step** below. Mixed regions is the #1 beginner mistake.
4. **Buy your domain** (if you don't have one): Console search → **Route 53** → **Domains → Register Domain** → search your desired name → purchase. This automatically creates a **Hosted Zone** for it.

### 4.1 Create the VPC (networking foundation)
1. Console search → **VPC** → **Create VPC**.
2. Choose **"VPC and more"** (the wizard) — not "VPC only."
3. Set: 2 Availability Zones, 2 Public Subnets, 2 Private Subnets, **1 NAT gateway** (needed so private-subnet resources like ECS can still reach the internet for things like Google OAuth/Cloudinary, without being reachable *from* it).
4. Click **Create VPC**. AWS builds subnets, route tables, and the internet gateway automatically — you don't need to configure these by hand.

### 4.2 Step 1 — Create the RDS Database
1. Console search → **RDS** → **Create database**.
2. Engine: **PostgreSQL**. Templates: **Free tier** (for testing) or **Production**.
3. Set a master username/password (save these — you'll need them for `DB_HOST`/`DB_USER`/`DB_PASSWORD`).
4. Under **Connectivity**: choose the VPC you just made, select the **private subnets**, and set **Public access = No**.
5. Under **VPC security group**: choose "Create new," name it something like `rds-sg` — you'll lock this down in step 4.4.
6. Click **Create database**. Wait for status = "Available" (a few minutes), then copy the **Endpoint** shown on the DB's detail page — this is your `DB_HOST`.

### 4.3 Step 2 — Create ElastiCache (Redis)
1. Console search → **ElastiCache** → **Redis caches** → **Create Redis cache**.
2. Choose **Design your own cache** → Deployment: single node is fine to start.
3. Under **Subnet group**: pick your VPC's **private subnets**.
4. Security group: create a new one, e.g. `redis-sg`.
5. Click **Create**. Once available, copy the **Primary Endpoint** — this becomes your `REDIS_URL`.

### 4.4 Step 3 — Containerize and Push to ECR
1. On your own computer (not the console): write your `Dockerfile`, then run:
   ```
   docker build -t connectify-backend .
   ```
2. Console search → **ECR** → **Create repository** → name it `connectify-backend` → Create.
3. Click into the repo → **View push commands** — AWS shows you the *exact* copy-paste commands (login, tag, push) for your image. Run them in order in your terminal.
4. After pushing, you'll see your image listed in the repository with a tag (e.g. `latest`).

### 4.5 Step 4 — Deploy on ECS Fargate
1. Console search → **ECS** → **Clusters** → **Create cluster** → name it, keep **AWS Fargate (serverless)** selected → Create.
2. **Task Definitions** → **Create new task definition**:
   - Launch type: **Fargate**.
   - Container image URI: paste your **ECR image URI** (from 4.4).
   - Container port: **5000**.
   - Add environment variables here: `DB_HOST`, `REDIS_URL`, Cloudinary keys, Google OAuth keys, etc. (Use "Secrets" instead of plain env vars for passwords.)
3. Back in your cluster → **Service** tab → **Create**:
   - Task definition: the one you just made.
   - Desired tasks: **2**.
   - Networking: select your VPC's **private subnets**.
   - Security group: create new, name it `ecs-sg` — leave it open for now, you'll restrict it in 4.6.
   - **Load balancer**: choose "Application Load Balancer" here — this is actually where you'll create the ALB (see 4.6), so if the ALB doesn't exist yet, pick "Create new load balancer" right from this screen.
4. Click **Create service**. ECS will start pulling your image and launching tasks — watch the **Tasks** tab until status = "Running."

### 4.6 Step 5 — Configure the ALB
If you didn't create it inline in 4.5, do it here: Console search → **EC2** → **Load Balancers** (left sidebar) → **Create load balancer** → **Application Load Balancer**.
1. Scheme: **Internet-facing**. VPC: yours. Subnets: your **public subnets** (across 2 AZs).
2. **Listeners**: add one for port 80 and one for port 443.
   - Edit the port 443 listener → attach an SSL certificate. If you don't have one yet, click **Request new certificate** — this takes you to **ACM (AWS Certificate Manager)**, where you request a cert for `api.yourdomain.com` and validate it via a DNS record (ACM gives you a CNAME to paste into Route 53 → Hosted Zone → Create record).
   - Edit the port 80 listener → set action = **Redirect to HTTPS (443)**.
3. **Target group**: create one, type "IP," port 5000, health check path `/health`, interval 30s. This is what ECS registers tasks into automatically.
4. On the **Target Group → Attributes** tab, enable **Stickiness → Load balancer generated cookie** (this is the WebSocket fix from Part 3).
5. **Security group** on the ALB itself: allow inbound 80 and 443 from `0.0.0.0/0` (anywhere) — it's meant to be public.
6. Go back to your **ECS security group** (`ecs-sg` from 4.5) → edit inbound rules → allow port 5000 **only from the ALB's security group** (select it by name, not an IP range).
7. Similarly, edit `rds-sg` and `redis-sg` → allow inbound only from `ecs-sg` on ports 5432 and 6379 respectively.

### 4.7 Connect Route 53 to the ALB
1. Console search → **Route 53** → **Hosted zones** → click your domain.
2. **Create record**: name `api`, type **A**, toggle **Alias = Yes**, route to your Application Load Balancer. This creates `api.yourdomain.com`.

### 4.8 Step 6 — Deploy the Frontend
1. Build locally: set `VITE_API_URL=https://api.yourdomain.com` (or your framework's equivalent) in `.env.production`, then run `npm run build`.
2. Console search → **S3** → **Create bucket** → name it (e.g. `yourdomain-frontend`) → keep **Block all public access = ON**.
3. Upload the contents of your `dist`/`build` folder into the bucket root.
4. Console search → **CloudFront** → **Create distribution**:
   - Origin: select your S3 bucket from the dropdown.
   - Origin access: choose **Origin Access Control (OAC)** → CloudFront will prompt you to auto-update the S3 bucket policy — accept it.
   - Under **Custom error responses**, add two: for HTTP 403 and 404, response page path `/index.html`, response code `200`.
   - Under **Custom SSL certificate**, request/select an ACM cert for `yourdomain.com` (this must be requested in the **us-east-1** region specifically — CloudFront requires this regardless of your main region).
5. Go back to **Route 53 → Hosted zone** → **Create record**: name blank (root domain), type **A**, Alias → route to your CloudFront distribution.

### 4.9 Sanity check
- `https://yourdomain.com` → should load your React app.
- `https://api.yourdomain.com/health` → should return your backend's health check response.
- If either fails, the fastest debugging path is: **ECS → Cluster → Service → Tasks → click a task → Logs** for backend issues, or **CloudFront → Distribution → Invalidations** (create `/*`) if frontend changes aren't showing up.

---

## Summary: The Big Picture

| Layer | Component | Core Purpose |
|---|---|---|
| DNS | Route 53 | Routes domain traffic to the right service |
| Frontend | S3 + CloudFront | Serves static files fast, globally, cheaply |
| Entry Point | ALB | Distributes backend traffic, terminates SSL, enables scaling |
| Isolation | VPC (public/private subnets) | Keeps backend/DB unreachable except through the ALB |
| Compute | ECS Fargate | Runs your backend containers without managing servers |
| Data | RDS (Postgres) | Persistent, managed relational database |
| Real-time Glue | ElastiCache (Redis) | Lets multiple backend instances share WebSocket state |
| External | Cloudinary, Google OAuth | Offloaded third-party services (images, auth) |

Together, this design lets Connectify scale horizontally (add more ECS tasks as traffic grows), stay secure (nothing but the ALB is internet-facing), and support real-time chat reliably across multiple servers.
