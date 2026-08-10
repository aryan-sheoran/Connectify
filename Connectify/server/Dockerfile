# 1. Use official lightweight Node.js 20 base image
FROM node:20-alpine

# 2. Set the working directory inside the container
WORKDIR /app

# 3. Copy package configuration files
COPY package*.json ./

# 4. Install production dependencies
RUN npm ci --only=production

# 5. Copy remaining server source code
COPY . .

# 6. Expose port 5000 (Express server port)
EXPOSE 5000

# 7. Start the backend server
CMD ["npm", "start"]
