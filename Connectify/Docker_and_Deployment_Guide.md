# Connectify — Docker, Folder Structure & Build Guide

This document answers the core questions regarding **Docker's role**, **AWS's role**, your **`client` vs `server` folder structure**, and **where & how to run build commands**.

---

## 1. Docker's Role vs. AWS's Role

### **Does AWS handle Docker, or do you need it locally?**

Think of Docker as a **packaging tool** and AWS as the **runner/manager**:

| Stage | Where it happens | What happens |
|---|---|---|
| **Packaging (You)** | On your computer | You install **Docker Desktop**. You run a single command (`docker build`) inside your `server/` folder to package your code, Node.js, and dependencies into a lightweight file called a **Docker Image**. |
| **Uploading (You)** | From your terminal | You run `docker push` to upload that Docker Image to **AWS ECR** (AWS's private image storage). |
| **Running (AWS)** | In the AWS Cloud | **AWS ECS Fargate** automatically downloads your image from ECR, provisions servers, starts your backend container, restarts it if it crashes, and scales it across multiple tasks. |

> **Summary:** You use Docker Desktop on your PC for 2 minutes just to package and push your backend image. **AWS handles 100% of running and managing Docker in the cloud.**

---

## 2. `client` vs `server` Folder Structure

Your project is structured into two main folders:
```
Connectify/
 ├── client/   (React + Vite Frontend)
 └── server/   (Express + Socket.IO + Node Backend)
```

### **Does having separate `client` and `server` folders add complexity?**
**No! It makes hosting faster, cheaper, and much simpler.**

- **`client` (Frontend)**: These are static files (HTML, CSS, JS). They don't need a running Node server. They are uploaded to **AWS S3** and served through **AWS CloudFront** (a global CDN). This costs almost $0 and loads instantly worldwide.
- **`server` (Backend)**: This is dynamic backend logic and WebSockets. It runs continuously as a Node process inside **AWS ECS Fargate** behind an Application Load Balancer (ALB).

Separating them ensures your backend server doesn't waste CPU/memory serving static images or JavaScript bundles to browsers.

---

## 3. Build & Deployment Commands: `client` vs `server`

### **Where do you run `npm run build`?**
You run `npm run build` **ONLY inside the `client/` folder.**

---

### **A. Building & Deploying the Frontend (`client/`)**

1. Open your terminal in the `client/` directory:
   ```bash
   cd client
   ```
2. Make sure `.env.production` contains your live backend domain:
   ```env
   VITE_API_URL=https://api.yourdomain.com
   ```
3. Run the build command:
   ```bash
   npm run build
   ```
4. **What happens:** Vite compiles your React code into static HTML/CSS/JS inside a newly created folder: **`client/dist/`**.
5. **Deployment:** Upload the contents of `client/dist/` to your **AWS S3 bucket** (which CloudFront serves).

---

### **B. Building & Deploying the Backend (`server/`)**

You **DO NOT** run `npm run build` in the `server/` folder! Your server uses plain Node.js (`node src/server.js`), which runs live inside Docker.

1. Open your terminal in the `server/` directory:
   ```bash
   cd server
   ```
2. Make sure a `Dockerfile` exists in `server/Dockerfile`:
   ```dockerfile
   FROM node:20-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --only=production
   COPY . .
   EXPOSE 5000
   CMD ["npm", "start"]
   ```
3. Build the Docker image locally:
   ```bash
   docker build -t connectify-backend .
   ```
4. Authenticate Docker with AWS ECR (copy the command from AWS ECR console):
   ```bash
   aws ecr get-login-password --region <your-region> | docker login --username AWS --password-stdin <aws_account_id>.dkr.ecr.<your-region>.amazonaws.com
   ```
5. Tag and push the image to AWS ECR:
   ```bash
   docker tag connectify-backend:latest <aws_account_id>.dkr.ecr.<your-region>.amazonaws.com/connectify-backend:latest
   docker push <aws_account_id>.dkr.ecr.<your-region>.amazonaws.com/connectify-backend:latest
   ```
6. **Deployment:** AWS ECS Fargate will pull this newly pushed image and launch your tasks.

---

## 4. Cheat Sheet Summary

| Folder | What it contains | Build / Package Command | Where to run | AWS Destination |
|---|---|---|---|---|
| **`client`** | React + Vite UI | `npm run build` | Inside `client/` | **AWS S3 + CloudFront** |
| **`server`** | Express + Socket.IO API | `docker build` & `docker push` | Inside `server/` | **AWS ECR + ECS Fargate** |
