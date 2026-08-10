# Connectify — Complete Step-by-Step AWS & Docker Deployment Master Guide

This guide provides a single, unified, end-to-end walkthrough for deploying the **Connectify** application to AWS. It combines the local build and containerization workflows with exact AWS Console steps.

---

## Architecture Overview & Roadmap

```
                          ┌────────────────────────────────────────────────────────┐
                          │                   Route 53 (DNS)                       │
                          └───────────┬────────────────────────────────┬───────────┘
                                      │                                │
                       yourdomain.com │                                │ api.yourdomain.com
                                      ▼                                ▼
┌───────────────────────────────────────────────┐     ┌───────────────────────────────────┐
│     CloudFront CDN + S3 (Static Frontend)     │     │ Application Load Balancer (ALB)   │
│     Serves compiled React code (client/dist)  │     │ SSL Termination & Sticky Sessions │
└───────────────────────────────────────────────┘     └─────────────────┬─────────────────┘
                                                                        │ (Public Subnet)
────────────────────────────────────────────────────────────────────────┼──────────────────────────
                                                                        │ (Private Subnets)
                                                                        ▼
                                                      ┌───────────────────────────────────┐
                                                      │     ECS Fargate Tasks (Backend)   │
                                                      │   Docker Image from AWS ECR       │
                                                      └───────┬───────────────────┬───────┘
                                                              │                   │
                                                              ▼                   ▼
                                                      ┌───────────────┐   ┌───────────────┐
                                                      │ RDS PostgreSQL│   │ Redis (Cache) │
                                                      └───────────────┘   └───────────────┘
```

### Folder & Tool Responsibility Matrix
| Component | Folder | Build / Package Tool | Where Executed | AWS Destination |
|---|---|---|---|---|
| **Frontend** | `client/` | Vite (`npm run build`) | Your PC (Terminal) | **S3 + CloudFront** |
| **Backend** | `server/` | Docker (`docker build & push`) | Your PC (Terminal) | **AWS ECR + ECS Fargate** |
| **Database** | N/A | AWS Managed RDS | AWS Console | **AWS RDS (PostgreSQL)** |
| **Cache & Pub/Sub** | N/A | AWS Managed ElastiCache | AWS Console | **AWS ElastiCache (Redis)** |

---

## Phase 0: Prerequisites & Environment Preparation

1. **AWS Account**: Log into [aws.amazon.com](https://aws.amazon.com).
2. **Select AWS Region**: In the top-right corner of the AWS Console, pick your target region (e.g., `us-east-1` or `ap-south-1`). **Use the exact same region for every service.**
3. **Install Local Tools**:
   - Install [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/) and start it.
   - Install the [AWS CLI](https://aws.amazon.com/cli/). Run `aws configure` in PowerShell/CMD and enter your AWS Access Keys and region.
4. **Domain Setup (Purchased External Domain like Namecheap / Namespace)**:
   - **Step A (AWS Route 53)**: Console Search → **Route 53** → **Hosted zones** → Click **Create hosted zone**. Enter your domain name (e.g., `yourdomain.com`) → Click **Create hosted zone**.
   - **Step B (Copy NS Records)**: Inside your new Hosted Zone, look at the **NS** record type. AWS provides **4 Name Server URLs** (e.g., `ns-123.awsdns-15.com`). Copy all 4.
   - **Step C (Registrar Dashboard)**: Log into Namecheap/Namespace → Domain Management → **Custom DNS / Nameservers** → Paste the 4 AWS Name Servers and save.
   - *Result: AWS Route 53 now controls DNS routing for your external domain!*

---

## Phase 1: Network Foundation (VPC Setup)

The VPC isolates your backend and databases from direct public internet attacks.

1. Console Search → **VPC** → Click **Create VPC**.
2. Select **"VPC and more"** (Wizard mode).
3. Settings (*These are the **exact factory default values** populated by AWS Console*):
   - **Name tag**: `connectify-vpc`
   - **IPv4 CIDR block**: `10.0.0.0/16` *(AWS default)*
   - **Number of Availability Zones (AZs)**: `2` *(AWS default)*
   - **Number of Public subnets**: `2` *(AWS default)*
   - **Number of Private subnets**: `2` *(AWS default)*
   - **NAT Gateways**: 
     - ⚠️ **Free Tier Cost Note**: NAT Gateways cost ~$32/month.
     - **For $0 / Lowest Cost during Free Tier**: Set NAT Gateways to **None** or **1 in 1 AZ**.
4. Click **Create VPC**. AWS will automatically build your subnets, route tables, and Internet Gateway.

---

## Phase 2: Database & Redis Setup

Setting up database endpoints first ensures you have connection strings ready when configuring the backend environment variables later.

### Step 2.1 — Amazon RDS (PostgreSQL)
1. Console Search → **RDS** → **Databases** → **Create database**.
2. Options:
   - **Engine**: PostgreSQL
   - **Templates**: Free Tier (testing) or Production
   - **DB Instance Identifier**: `connectify-db`
   - **Master Username**: `postgres` (or your choice)
   - **Master Password**: Set a strong password (save this string!).
3. **Connectivity**:
   - **VPC**: Choose `connectify-vpc`
   - **Subnet Group**: Choose Private Subnets
   - **Public Access**: **No**
   - **VPC Security Group**: Create new → Name it `rds-sg`
4. Click **Create database**.
5. Once status is **Available**, click into `connectify-db` and copy the **Endpoint** (e.g., `connectify-db.xxxx.region.rds.amazonaws.com`). This is your `DB_HOST`.

### Step 2.2 — Amazon ElastiCache (Redis)
1. Console Search → **ElastiCache** → **Redis caches** → **Create Redis cache**.
2. Options:
   - Choose **Design your own cache** → **Cluster mode disabled**
   - Name: `connectify-redis`
   - **Subnet Group**: Choose `connectify-vpc` private subnets
   - **Security Group**: Create new → Name it `redis-sg`
3. Click **Create**.
4. Once status is **Available**, copy the **Primary Endpoint** (e.g., `connectify-redis.xxxx.ng.0001.region.cache.amazonaws.com:6379`). This becomes your `REDIS_URL`.

---

## Phase 3: Backend Containerization & ECR Deployment

### Step 3.1 — Verify the `server/Dockerfile`
Ensure the file `server/Dockerfile` exists with the following content:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

### Step 3.2 — Create AWS ECR Repository
1. Console Search → **ECR (Elastic Container Registry)** → **Create repository**.
2. Repository Name: `connectify-backend`
3. Tag immutability: Optional (Disabled by default)
4. Click **Create repository**.

### Step 3.3 — Package & Push Image from Terminal
Open PowerShell or Terminal in your project's `server/` directory:

1. **Navigate to server directory**:
   ```bash
   cd server
   ```

2. **Authenticate Docker with AWS ECR**:
   *(Replace `<region>` and `<account_id>` with your AWS details)*
   ```bash
   aws ecr get-login-password --region <region> | docker login --username AWS --password-stdin <account_id>.dkr.ecr.<region>.amazonaws.com
   ```

3. **Build the Docker image**:
   ```bash
   docker build -t connectify-backend .
   ```

4. **Tag the image for ECR**:
   ```bash
   docker tag connectify-backend:latest <account_id>.dkr.ecr.<region>.amazonaws.com/connectify-backend:latest
   ```

5. **Push the image to ECR**:
   ```bash
   docker push <account_id>.dkr.ecr.<region>.amazonaws.com/connectify-backend:latest
   ```

---

## Phase 4: Application Load Balancer & ECS Fargate Setup

### Step 4.1 — Request SSL Certificate (ACM)
1. Console Search → **Certificate Manager (ACM)** → **Request certificate**.
2. Certificate Type: **Request a public certificate**.
3. Fully qualified domain name: `api.yourdomain.com`
4. Validation method: **DNS validation**.
5. Click **Request**. On the detail page, click **Create records in Route 53** to automatically validate ownership. Wait for status = **Issued**.

### Step 4.2 — Create Target Group & Application Load Balancer (ALB)
1. Console Search → **EC2** → Left sidebar: **Target Groups** → **Create target group**.
   - Target type: **IP addresses**
   - Target group name: `connectify-backend-tg`
   - Protocol: **HTTP** | Port: `5000`
   - VPC: `connectify-vpc`
   - Health check path: `/health` (or `/`)
   - Click **Next** → **Create target group**.
2. **Enable Cookie Stickiness (CRITICAL for Socket.IO WebSockets)**:
   - Select `connectify-backend-tg` → **Attributes** tab → Edit.
   - Turn ON **Stickiness** → Type: **Load balancer generated cookie** → Save.

3. Console Search → **EC2** → Left sidebar: **Load Balancers** → **Create load balancer**.
   - Select **Application Load Balancer (ALB)**.
   - Name: `connectify-alb`
   - Scheme: **Internet-facing**
   - VPC: `connectify-vpc`
   - Mapping: Select **Public Subnets** across both Availability Zones.
   - Security Group: Create new → Name `alb-sg` → Allow Inbound **HTTP (80)** and **HTTPS (443)** from `0.0.0.0/0`.
   - Listeners:
     - **Port 80**: Action = Redirect to HTTPS (443).
     - **Port 443**: Action = Forward to `connectify-backend-tg`. Select ACM Certificate `api.yourdomain.com`.
   - Click **Create load balancer**.

### Step 4.3 — Interlock Security Groups
Lock down network access so database and backend containers only talk to authorized components:

1. Console Search → **VPC** → **Security Groups**.
2. **Create/Edit `ecs-sg`** (for ECS tasks):
   - Inbound Rule: Allow Port `5000` from `alb-sg` ONLY.
3. **Edit `rds-sg`** (for PostgreSQL):
   - Inbound Rule: Allow Port `5432` from `ecs-sg` ONLY.
4. **Edit `redis-sg`** (for Redis):
   - Inbound Rule: Allow Port `6379` from `ecs-sg` ONLY.

### Step 4.4 — Create ECS Task Definition & Service
1. Console Search → **ECS** → **Clusters** → **Create Cluster**.
   - Cluster Name: `connectify-cluster`
   - Infrastructure: **AWS Fargate (serverless)** → Create.

2. Console Search → **ECS** → Left sidebar: **Task Definitions** → **Create new task definition**.
   - Task definition family: `connectify-backend-task`
   - Infrastructure requirements: **AWS Fargate**
   - CPU: `0.5 vCPU` | Memory: `1 GB`
   - Container details:
     - Name: `connectify-container`
     - Image URI: `<account_id>.dkr.ecr.<region>.amazonaws.com/connectify-backend:latest`
     - Port mapping: `5000` | Protocol: `TCP` | App Protocol: `HTTP`
   - Environment variables: Add key-value pairs:
     - `NODE_ENV` = `production`
     - `PORT` = `5000`
     - `DB_HOST` = `<your_rds_endpoint>`
     - `DB_USER` = `postgres`
     - `DB_PASSWORD` = `<your_db_password>`
     - `DB_NAME` = `connectify`
     - `REDIS_URL` = `redis://<your_redis_endpoint>:6379`
     - Add Cloudinary & Google OAuth keys.
   - Click **Create**.

3. Go to **ECS** → **Clusters** → `connectify-cluster` → **Services** tab → **Create**.
   - Deployment configuration: Family `connectify-backend-task` | Revision `Latest`
   - Service name: `connectify-backend-service`
   - Desired tasks: `2`
   - Networking: Select `connectify-vpc` and **Private Subnets**.
   - Security group: Select `ecs-sg`.
   - **Load Balancing**:
     - Load balancer type: **Application Load Balancer**
     - Select `connectify-alb`
     - Container to load balance: `connectify-container 5000:5000`
     - Target group: Choose existing `connectify-backend-tg`.
   - Click **Create**. ECS will now pull your Docker image and launch 2 tasks.

---

## Phase 5: Backend DNS Record (Route 53)

1. Console Search → **Route 53** → **Hosted zones** → Click `yourdomain.com`.
2. Click **Create record**.
   - Record name: `api` (creates `api.yourdomain.com`)
   - Record type: **A**
   - Toggle **Alias**: **ON**
   - Route traffic to: **Alias to Application Load Balancer**
   - Choose your region and select `connectify-alb`.
3. Click **Create records**.

---

## Phase 6: Frontend Build & S3 + CloudFront Deployment

### Step 6.1 — Configure Frontend Environment & Build
Open terminal in your project's `client/` directory:

1. Create or update `client/.env.production`:
   ```env
   VITE_API_URL=https://api.yourdomain.com
   ```

2. Run the Vite build:
   ```bash
   cd client
   npm run build
   ```
   *This compiles your React application into the static folder **`client/dist/`**.*

### Step 6.2 — Create S3 Bucket & Upload Build
1. Console Search → **S3** → **Create bucket**.
   - Bucket name: `connectify-frontend-bucket` (must be globally unique)
   - Object Ownership: ACLs disabled
   - **Block *all* public access**: **KEEP ON** (CloudFront will access it privately via OAC).
   - Click **Create bucket**.
2. Click into `connectify-frontend-bucket` → Click **Upload**.
3. Drag and drop all files and subfolders from inside `client/dist/` into S3 → Click **Upload**.

### Step 6.3 — Create CloudFront Distribution & SSL Cert
1. **Request CloudFront SSL Certificate**:
   - Console Search → **ACM** → Switch Region in top-right to **`us-east-1` (N. Virginia)** *(CloudFront requires SSL certs in us-east-1)*.
   - Request public certificate for `yourdomain.com` and `*.yourdomain.com`. Validate via Route 53.
2. Console Search → **CloudFront** → **Create distribution**.
   - **Origin domain**: Select `connectify-frontend-bucket.s3.amazonaws.com`.
   - **Origin access**: Select **Origin Access Control settings (OAC)** → Click **Create control setting** → Create.
   - *CloudFront will show a banner to copy the S3 bucket policy — click **Copy policy** and paste it into S3 Bucket -> Permissions -> Bucket Policy.*
   - **Viewer protocol policy**: **Redirect HTTP to HTTPS**.
   - **Alternate domain name (CNAME)**: Add `yourdomain.com`.
   - **Custom SSL certificate**: Select the ACM cert created in `us-east-1`.
   - **Default root object**: `index.html`
3. **Configure SPA Single Page Application Routing**:
   - Under distribution settings → **Custom error responses** tab → **Create custom error response**:
     - HTTP error code: `403` → Customize response: Yes → Response page path: `/index.html` → HTTP Response code: `200`.
     - HTTP error code: `404` → Customize response: Yes → Response page path: `/index.html` → HTTP Response code: `200`.
4. Click **Create distribution**.

### Step 6.4 — Connect Root Domain to CloudFront
1. Console Search → **Route 53** → **Hosted zones** → `yourdomain.com`.
2. Click **Create record**.
   - Record name: Leave **blank** (points to root `yourdomain.com`)
   - Record type: **A**
   - Toggle **Alias**: **ON**
   - Route traffic to: **Alias to CloudFront distribution** → Select your distribution.
3. Click **Create records**.

---

## Phase 7: Verification & Troubleshooting

### Sanity Checks
1. **API Health Check**: Visit `https://api.yourdomain.com/health` in your browser. It should return a 200 OK status from your backend.
2. **Frontend App**: Visit `https://yourdomain.com`. Your React application should load cleanly over HTTPS.
3. **Real-time WebSockets**: Test sending chat messages or logging in. Verify that connections remain sticky and cross-instance messages work via Redis.

### Debugging Quick Guide
- **Backend crashes or won't start**: Go to **ECS** → **Clusters** → `connectify-cluster` → **Tasks** → Click task ID → **Logs** tab to view live Node.js logs.
- **Frontend changes not updating**: Go to **CloudFront** → **Distributions** → Select distribution → **Invalidations** tab → Click **Create invalidation** → Enter `/*`.
- **Database Connection Timeout**: Check Security Groups. Ensure `rds-sg` allows port 5432 from `ecs-sg`.
