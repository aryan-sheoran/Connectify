# Docker — The Complete Guide

> Everything you need to never ask anyone about Docker again.

---

## Table of Contents

1. [What is Docker & Why Should You Care?](#1-what-is-docker--why-should-you-care)
2. [Core Concepts (The Mental Model)](#2-core-concepts-the-mental-model)
3. [Installing Docker](#3-installing-docker)
4. [The Dockerfile — Your Blueprint](#4-the-dockerfile--your-blueprint)
5. [Building Images](#5-building-images)
6. [Running Containers](#6-running-containers)
7. [Docker Compose — Multi-Container Apps](#7-docker-compose--multi-container-apps)
8. [Volumes & Persistent Data](#8-volumes--persistent-data)
9. [Networking](#9-networking)
10. [Environment Variables & Secrets](#10-environment-variables--secrets)
11. [.dockerignore](#11-dockerignore)
12. [Multi-Stage Builds](#12-multi-stage-builds)
13. [Pushing to Docker Hub / Registry](#13-pushing-to-docker-hub--registry)
14. [Debugging Containers](#14-debugging-containers)
15. [Production Best Practices](#15-production-best-practices)
16. [Connectify — Full Docker Setup](#16-connectify--full-docker-setup)
17. [Quick Reference Cheat Sheet](#17-quick-reference-cheat-sheet)

---

## 1. What is Docker & Why Should You Care?

### The Problem Docker Solves

You build an app on your machine. It works perfectly. You send it to a friend or deploy it to a server and... it breaks. Different Node version, missing dependency, wrong OS config. The classic **"it works on my machine"** problem.

### What Docker Actually Does

Docker packages your app **along with its entire environment** (OS libraries, runtime, dependencies, config) into a single portable unit called a **container**. This container runs identically everywhere — your laptop, your friend's laptop, AWS, anywhere.

Think of it like this:

| Without Docker | With Docker |
|---|---|
| "Install Node 18, then Redis 7, then Postgres 15, configure pg_hba.conf, set these 12 env vars..." | `docker compose up` — done. |
| Different behavior on different machines | Identical behavior everywhere |
| Conflicts between projects (Node 16 vs 18) | Each project is fully isolated |

### Why Developers Use Docker

- **Consistency** — Same environment from dev to production
- **Isolation** — Projects can't interfere with each other
- **Portability** — Ship your app as a single unit to any cloud
- **Easy onboarding** — New teammate runs one command to get the full stack running
- **Scalability** — Spin up 10 copies of your server instantly

---

## 2. Core Concepts (The Mental Model)

Before touching any commands, understand these 5 things:

### Image

A **read-only template** — like a class in OOP. It contains your code, runtime, libraries, and OS tools. You don't run an image directly; you create containers from it.

```
Image = Snapshot of your app + everything it needs to run
```

### Container

A **running instance** of an image — like an object created from a class. You can start, stop, restart, and delete containers. Each container is isolated from others.

```
Container = A live, running copy of an image
```

### Dockerfile

A **text file with instructions** to build an image. It's your recipe — "start with Ubuntu, install Node, copy my code, run npm install."

### Docker Compose

A **YAML file** that defines multiple containers (your app, database, Redis) and how they talk to each other. One command starts everything.

### Registry (Docker Hub)

A **cloud storage for images** — like GitHub for Docker images. You push images there so others (or your servers) can pull and run them.

### How They Relate

```
Dockerfile  →  (docker build)  →  Image  →  (docker run)  →  Container
                                     ↓
                              Push to Registry
                                     ↓
                              Pull on any server → Run Container
```

---

## 3. Installing Docker

### Linux (Ubuntu/Debian)

```bash
# Remove old versions
sudo apt-get remove docker docker-engine docker.io containerd runc

# Install using the official script (easiest way)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Run docker without sudo (log out and back in after this)
sudo usermod -aG docker $USER

# Verify
docker --version
docker run hello-world
```

### macOS / Windows

Download **Docker Desktop** from [docker.com](https://www.docker.com/products/docker-desktop/). Install it. Done.

### Verify Installation

```bash
docker --version          # Docker CLI version
docker compose version    # Compose version (V2 is built-in now)
```

---

## 4. The Dockerfile — Your Blueprint

A Dockerfile is a plain text file named `Dockerfile` (no extension). Each line is an **instruction**.

### Anatomy of a Dockerfile

```dockerfile
# Every Dockerfile starts with a base image
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy dependency files first (for caching — explained below)
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy the rest of your source code
COPY . .

# Tell Docker which port your app listens on
EXPOSE 5000

# The command to run when the container starts
CMD ["node", "src/server.js"]
```

### Every Instruction Explained

| Instruction | What it does | Example |
|---|---|---|
| `FROM` | Base image to start from. Always first line. | `FROM node:20-alpine` |
| `WORKDIR` | Sets the current directory inside the container. Creates it if it doesn't exist. | `WORKDIR /app` |
| `COPY` | Copies files from your machine into the image. | `COPY . .` |
| `RUN` | Executes a command during **build time** (installing deps, compiling). | `RUN npm ci` |
| `CMD` | The default command when a container **starts**. Only one per Dockerfile. | `CMD ["node", "app.js"]` |
| `EXPOSE` | Documents which port the app uses. Doesn't actually publish it. | `EXPOSE 3000` |
| `ENV` | Sets environment variables. | `ENV NODE_ENV=production` |
| `ARG` | Build-time variables (not available at runtime). | `ARG API_VERSION=v1` |
| `ENTRYPOINT` | Like CMD but harder to override. Used for "this container IS this command." | `ENTRYPOINT ["nginx"]` |
| `ADD` | Like COPY but can also extract tar files and fetch URLs. Use COPY unless you need this. | `ADD app.tar.gz /app` |
| `VOLUME` | Creates a mount point for persistent data. | `VOLUME /data` |
| `USER` | Switch to a non-root user (security). | `USER node` |

### CMD vs ENTRYPOINT vs RUN

- **RUN** — Executes during `docker build`. Used for setup (install deps, compile code). Creates a new **layer** in the image.
- **CMD** — Executes when `docker run` starts a container. Can be overridden from command line.
- **ENTRYPOINT** — Also executes at container start, but is harder to override. CMD arguments get appended to ENTRYPOINT.

```dockerfile
# RUN = build time
RUN npm ci                  # Installs packages ONCE when building image

# CMD = runtime (can be overridden)
CMD ["node", "server.js"]   # Default command, but user can override:
                            # docker run myapp node other-script.js

# ENTRYPOINT = runtime (fixed command)
ENTRYPOINT ["node"]         # Always runs node
CMD ["server.js"]           # Default arg, can be overridden:
                            # docker run myapp other-script.js
```

### Layer Caching (Why Order Matters!)

Docker caches each instruction as a **layer**. If a layer hasn't changed, Docker reuses the cached version. This is why we copy `package.json` BEFORE copying source code:

```dockerfile
# ✅ GOOD — deps are cached until package.json changes
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# ❌ BAD — any code change invalidates npm ci cache
COPY . .
RUN npm ci
```

**Rule of thumb**: Put things that change less frequently at the top.

### Choosing a Base Image

```dockerfile
FROM node:20           # Full Debian — ~350MB. Has everything, good for debugging.
FROM node:20-slim      # Slim Debian — ~80MB. Missing some tools but much smaller.
FROM node:20-alpine    # Alpine Linux — ~50MB. Minimal. Best for production.
```

**Use `alpine` for production** (small, secure). Use full image if you need debugging tools.

---

## 5. Building Images

### Basic Build

```bash
# Build an image from a Dockerfile in the current directory
docker build -t my-app .

# Breaking it down:
# docker build     → the build command
# -t my-app        → tag/name the image "my-app"
# .                → build context (current directory)
```

### Tagging

Tags are like version labels. Format: `name:tag`

```bash
docker build -t my-app:1.0 .          # Tagged as version 1.0
docker build -t my-app:latest .       # Tagged as latest
docker build -t myuser/my-app:1.0 .   # With Docker Hub username prefix
```

### Listing Images

```bash
docker images                # List all local images
docker image ls              # Same thing

# Output:
# REPOSITORY    TAG       IMAGE ID       SIZE
# my-app        1.0       a1b2c3d4e5     150MB
# node          20-alpine 9f8e7d6c5b     50MB
```

### Removing Images

```bash
docker rmi my-app:1.0              # Remove specific image
docker image prune                  # Remove all dangling (untagged) images
docker image prune -a               # Remove ALL unused images (careful!)
```

---

## 6. Running Containers

### Basic Run

```bash
docker run my-app
```

### Common Flags (You'll Use These Daily)

```bash
# Run in detached mode (background)
docker run -d my-app

# Map port: -p HOST_PORT:CONTAINER_PORT
docker run -p 3000:5000 my-app
# Your machine's port 3000 → container's port 5000

# Set environment variables
docker run -e NODE_ENV=production -e DB_HOST=localhost my-app

# Use an env file
docker run --env-file .env my-app

# Give it a name (instead of random names like "zealous_einstein")
docker run --name my-server my-app

# Auto-remove container when it stops
docker run --rm my-app

# Interactive mode (get a shell)
docker run -it my-app /bin/sh

# Mount a volume (persist data or share files)
docker run -v /host/path:/container/path my-app

# All together — a realistic example:
docker run -d \
  --name connectify-server \
  -p 5000:5000 \
  --env-file .env \
  -v ./uploads:/app/uploads \
  connectify-server:latest
```

### Managing Running Containers

```bash
docker ps                    # List running containers
docker ps -a                 # List ALL containers (including stopped)

docker stop my-server        # Gracefully stop a container
docker start my-server       # Start a stopped container
docker restart my-server     # Restart

docker rm my-server          # Delete a stopped container
docker rm -f my-server       # Force delete (even if running)

docker logs my-server        # View container logs
docker logs -f my-server     # Follow logs (like tail -f)
docker logs --tail 50 my-server  # Last 50 lines

docker exec -it my-server /bin/sh    # Open a shell inside a running container
docker exec my-server ls /app        # Run a command inside a container
```

### Container Lifecycle

```
Created → Running → Paused → Stopped → Removed
  ↑         ↓                   ↓
  └─── docker start ←── docker stop
```

---

## 7. Docker Compose — Multi-Container Apps

Real apps need multiple services. Connectify needs: **Node server + React client + PostgreSQL + Redis**. Running 4 separate `docker run` commands with all those flags is painful. Docker Compose solves this.

### The docker-compose.yml File

```yaml
# docker-compose.yml

services:
  # --- PostgreSQL Database ---
  db:
    image: postgres:16-alpine           # Use official Postgres image
    restart: unless-stopped
    environment:
      POSTGRES_USER: connectify
      POSTGRES_PASSWORD: secret123
      POSTGRES_DB: connectify_db
    ports:
      - "5432:5432"
    volumes:
      - pg_data:/var/lib/postgresql/data   # Persist database data

  # --- Redis ---
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    ports:
      - "6379:6379"

  # --- Backend Server ---
  server:
    build: ./server                      # Build from server/Dockerfile
    restart: unless-stopped
    ports:
      - "5000:5000"
    env_file:
      - ./server/.env
    depends_on:
      - db
      - redis

  # --- Frontend Client ---
  client:
    build: ./client                      # Build from client/Dockerfile
    ports:
      - "3000:3000"
    depends_on:
      - server

# Named volumes (Docker manages the storage location)
volumes:
  pg_data:
```

### Compose Commands

```bash
# Start everything (build if needed)
docker compose up

# Start in background
docker compose up -d

# Rebuild images before starting
docker compose up --build

# Stop everything
docker compose down

# Stop and remove volumes (⚠️ deletes database data!)
docker compose down -v

# View logs
docker compose logs
docker compose logs server          # Logs for one service
docker compose logs -f server       # Follow logs

# Restart a single service
docker compose restart server

# Run a one-off command in a service
docker compose exec server /bin/sh

# List running services
docker compose ps

# Scale a service (run 3 copies of server)
docker compose up -d --scale server=3
```

### depends_on — Startup Order

```yaml
server:
  depends_on:
    - db
    - redis
```

This ensures `db` and `redis` **start before** `server`. But it does NOT wait for them to be **ready** — just started. For readiness checks, use healthchecks:

```yaml
db:
  image: postgres:16-alpine
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U connectify"]
    interval: 5s
    timeout: 5s
    retries: 5

server:
  depends_on:
    db:
      condition: service_healthy    # Wait until DB is actually ready
```

---

## 8. Volumes & Persistent Data

Containers are **ephemeral** — when a container is removed, all data inside it is lost. Volumes solve this.

### Types of Storage

```bash
# 1. Named Volume — Docker manages storage location (RECOMMENDED for databases)
docker run -v pg_data:/var/lib/postgresql/data postgres

# 2. Bind Mount — Maps a specific folder from your machine
docker run -v /home/luffy/uploads:/app/uploads my-app

# 3. tmpfs Mount — Stored in memory only (for sensitive data)
docker run --tmpfs /app/temp my-app
```

### Volume Commands

```bash
docker volume ls                    # List all volumes
docker volume create my_volume      # Create a volume
docker volume inspect my_volume     # See details (mount point, etc.)
docker volume rm my_volume          # Delete a volume
docker volume prune                 # Delete all unused volumes
```

### When to Use What

| Use Case | Type | Example |
|---|---|---|
| Database storage | Named Volume | `pg_data:/var/lib/postgresql/data` |
| Sharing code during development | Bind Mount | `./src:/app/src` |
| File uploads | Named Volume or Bind Mount | `uploads:/app/uploads` |
| Temporary files | tmpfs | `--tmpfs /tmp` |

---

## 9. Networking

Containers in the same Docker Compose file can talk to each other using **service names** as hostnames.

```yaml
services:
  server:
    environment:
      DB_HOST: db           # ← Not "localhost"! Use the service name.
      REDIS_HOST: redis     # ← Same here
  db:
    image: postgres:16-alpine
  redis:
    image: redis:7-alpine
```

Inside the `server` container, `db` resolves to the database container's IP, `redis` resolves to the Redis container's IP. Docker handles DNS automatically.

### Network Types

```bash
# Bridge (default) — containers can talk to each other
# Host — container uses the host's network directly
# None — no networking

# List networks
docker network ls

# Create a custom network
docker network create my-network

# Run container on a specific network
docker run --network my-network my-app
```

---

## 10. Environment Variables & Secrets

### Three Ways to Pass Env Vars

```yaml
# 1. Inline in compose file (OK for non-sensitive values)
services:
  server:
    environment:
      NODE_ENV: production
      PORT: 5000

# 2. From an env file (GOOD for development)
services:
  server:
    env_file:
      - .env

# 3. From the host environment
services:
  server:
    environment:
      API_KEY: ${API_KEY}    # Reads from host's environment
```

### ⚠️ NEVER Put Secrets in Your Dockerfile

```dockerfile
# ❌ BAD — secrets are baked into the image and visible to anyone
ENV DB_PASSWORD=supersecret

# ✅ GOOD — pass at runtime
# docker run -e DB_PASSWORD=supersecret my-app
```

---

## 11. .dockerignore

Like `.gitignore`, but for Docker builds. Prevents unnecessary files from being copied into the image.

```gitignore
# .dockerignore

node_modules
npm-debug.log
.env
.git
.gitignore
dist
*.md
.vscode
.DS_Store
```

**Why this matters:**
- `node_modules` — you `npm ci` inside the container anyway; copying 200MB of modules is wasteful
- `.env` — secrets shouldn't be baked into images
- `.git` — history is irrelevant inside a container

---

## 12. Multi-Stage Builds

Build your app in one stage, run it in another. The final image only contains what's needed to **run** — not the build tools.

### React Client Example

```dockerfile
# ---- Stage 1: Build ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
# At this point, /app/dist contains the built static files

# ---- Stage 2: Serve ----
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**Result**: Final image is ~25MB (just nginx + static files) instead of ~400MB (Node + all dev dependencies).

### Why Multi-Stage?

| Single Stage | Multi-Stage |
|---|---|
| Image: 400MB+ | Image: 25MB |
| Contains Node, npm, dev deps, source code | Contains only nginx + built files |
| Larger attack surface | Minimal attack surface |

---

## 13. Pushing to Docker Hub / Registry

### Push to Docker Hub

```bash
# 1. Create account at hub.docker.com

# 2. Login from CLI
docker login

# 3. Tag your image with your username
docker tag my-app:latest yourusername/my-app:latest

# 4. Push
docker push yourusername/my-app:latest

# 5. Anyone can now pull and run it
docker pull yourusername/my-app:latest
docker run yourusername/my-app:latest
```

### Private Registries (AWS ECR, GCP, etc.)

```bash
# AWS ECR example
aws ecr get-login-password | docker login --username AWS --password-stdin 123456.dkr.ecr.us-east-1.amazonaws.com
docker tag my-app:latest 123456.dkr.ecr.us-east-1.amazonaws.com/my-app:latest
docker push 123456.dkr.ecr.us-east-1.amazonaws.com/my-app:latest
```

---

## 14. Debugging Containers

### Container Won't Start?

```bash
# Check logs
docker logs my-container

# Check what went wrong
docker inspect my-container

# Run it interactively to debug
docker run -it my-app /bin/sh
```

### Something Wrong Inside a Running Container?

```bash
# Get a shell inside the container
docker exec -it my-container /bin/sh

# Check processes
docker exec my-container ps aux

# Check network
docker exec my-container ping db

# Check environment variables
docker exec my-container env

# Check file system
docker exec my-container ls -la /app
```

### Image Too Large?

```bash
# See what's taking space
docker history my-app

# Use multi-stage builds (Section 12)
# Use alpine base images
# Add .dockerignore
```

### Common Errors & Fixes

| Error | Cause | Fix |
|---|---|---|
| `port is already allocated` | Another process uses that port | Change host port or stop conflicting process |
| `ECONNREFUSED` to database | Using `localhost` instead of service name | Use `db` (service name) not `localhost` |
| `npm ci` fails | No `package-lock.json` | Run `npm install` locally first to generate it |
| Container exits immediately | CMD crashes or no foreground process | Check logs, ensure CMD runs in foreground |
| Permission denied | File ownership mismatch | Add `USER node` or fix permissions with `chown` |

---

## 15. Production Best Practices

### 1. Use Specific Image Tags

```dockerfile
# ❌ BAD — "latest" can change anytime
FROM node:latest

# ✅ GOOD — pinned version
FROM node:20.11-alpine
```

### 2. Run as Non-Root User

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY --chown=node:node . .
RUN npm ci
USER node                    # Switch to non-root user
CMD ["node", "src/server.js"]
```

### 3. Use npm ci Instead of npm install

```dockerfile
# ❌ npm install — can produce different results on different machines
RUN npm install

# ✅ npm ci — clean install from lockfile, deterministic
RUN npm ci --only=production
```

### 4. Handle Signals Properly

```dockerfile
# Use array syntax for CMD so Node receives SIGTERM properly
CMD ["node", "src/server.js"]     # ✅ exec form — Node is PID 1

# NOT this:
CMD node src/server.js             # ❌ shell form — runs under /bin/sh
```

### 5. Add Health Checks

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -qO- http://localhost:5000/health || exit 1
```

### 6. Use .dockerignore (Section 11)

### 7. Keep Images Small (Alpine + Multi-Stage)

---

## 16. Connectify — Full Docker Setup

Here's the complete Docker setup for the Connectify project.

### Project Structure

```
Connectify/
├── client/
│   ├── Dockerfile
│   ├── .dockerignore
│   └── ...
├── server/
│   ├── Dockerfile
│   ├── .dockerignore
│   └── ...
├── docker-compose.yml
└── .env                    (optional: root-level shared env)
```

### server/Dockerfile

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy dependency files first for layer caching
COPY package.json package-lock.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy source code
COPY . .

# Document the port
EXPOSE 5000

# Run as non-root user
USER node

# Start the server
CMD ["node", "src/server.js"]
```

### server/.dockerignore

```gitignore
node_modules
npm-debug.log
.env
.git
*.md
refrenece
```

### client/Dockerfile (Multi-Stage)

```dockerfile
# Stage 1: Build the React app
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html

# Custom nginx config for SPA routing
RUN echo 'server { \
    listen 80; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### client/.dockerignore

```gitignore
node_modules
dist
.git
*.md
```

### docker-compose.yml (Root level)

```yaml
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: connectify
      POSTGRES_PASSWORD: ${DB_PASSWORD:-changeme}
      POSTGRES_DB: connectify_db
    ports:
      - "5432:5432"
    volumes:
      - pg_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U connectify"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  server:
    build: ./server
    restart: unless-stopped
    ports:
      - "5000:5000"
    env_file:
      - ./server/.env
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy

  client:
    build: ./client
    ports:
      - "80:80"
    depends_on:
      - server

volumes:
  pg_data:
```

### Running Connectify with Docker

```bash
# From the Connectify root directory:

# Start everything (first time will build images)
docker compose up --build -d

# Check all services are running
docker compose ps

# View server logs
docker compose logs -f server

# Stop everything
docker compose down

# Stop and wipe database
docker compose down -v
```

---

## 17. Quick Reference Cheat Sheet

### Images

```bash
docker build -t name:tag .           # Build image
docker images                         # List images
docker rmi name:tag                   # Remove image
docker image prune -a                 # Remove all unused images
docker tag old:tag new:tag            # Rename/retag image
docker push user/name:tag             # Push to registry
docker pull user/name:tag             # Pull from registry
```

### Containers

```bash
docker run -d -p 3000:5000 --name c1 img    # Run container
docker ps                                     # List running
docker ps -a                                  # List all
docker stop c1                                # Stop
docker start c1                               # Start
docker restart c1                              # Restart
docker rm c1                                   # Remove
docker rm -f c1                                # Force remove
docker logs -f c1                              # Follow logs
docker exec -it c1 /bin/sh                     # Shell into container
docker inspect c1                              # Full details
```

### Compose

```bash
docker compose up -d                  # Start all services
docker compose up --build -d          # Rebuild and start
docker compose down                   # Stop all
docker compose down -v                # Stop + delete volumes
docker compose logs -f service_name   # Follow service logs
docker compose exec service_name sh   # Shell into service
docker compose ps                     # List services
docker compose restart service_name   # Restart one service
```

### Volumes & Cleanup

```bash
docker volume ls                      # List volumes
docker volume rm vol_name             # Remove volume
docker system prune -a                # ⚠️ Remove ALL unused data
docker system df                      # Show disk usage
```

---

## Glossary

| Term | Meaning |
|---|---|
| **Image** | Read-only template containing code + environment |
| **Container** | Running instance of an image |
| **Dockerfile** | Instructions to build an image |
| **Layer** | Each Dockerfile instruction creates a cached layer |
| **Volume** | Persistent storage that survives container removal |
| **Bind Mount** | Maps a host directory into a container |
| **Registry** | Cloud storage for images (Docker Hub, ECR) |
| **Tag** | Version label on an image (e.g., `1.0`, `latest`) |
| **Compose** | Tool for defining multi-container applications |
| **Bridge Network** | Default Docker network; containers can communicate |
| **Alpine** | Tiny Linux distro (~5MB) used as base for small images |
| **Multi-stage build** | Using multiple FROM statements to reduce final image size |
| **Healthcheck** | Periodic test to verify a container is functioning |
| **Orchestration** | Managing multiple containers at scale (Kubernetes, Swarm) |

---

*Now go build and ship something.* 🐳
