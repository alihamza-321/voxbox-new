# Multi-stage Dockerfile for VoxBox Frontend (React + Vite)

# Stage 1: Build
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (skip postinstall scripts to avoid patch-package issue)
RUN npm install --legacy-peer-deps --ignore-scripts

# Copy source code
COPY . .

# Build arguments for environment variables
ARG VITE_API_URL=https://neweaxq6ym.eu-west-2.awsapprunner.com/api/v1
ARG VITE_API_BASE_URL=https://neweaxq6ym.eu-west-2.awsapprunner.com
ARG VITE_APP_NAME=VoxBox-Staging
ARG VITE_NODE_ENV=staging
ARG VITE_FRONTEND_URL=https://gtv3f6gmns.eu-west-2.awsapprunner.com

# Set environment variables from build args
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_APP_NAME=${VITE_APP_NAME}
ENV VITE_NODE_ENV=${VITE_NODE_ENV}
ENV VITE_FRONTEND_URL=${VITE_FRONTEND_URL}

# Build the application
RUN npm run build

# Stage 2: Production with Nginx
FROM nginx:alpine AS production

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Create a non-root user
RUN addgroup -g 1001 -S nginx-user && \
    adduser -S nginx-user -u 1001 && \
    chown -R nginx-user:nginx-user /usr/share/nginx/html && \
    chown -R nginx-user:nginx-user /var/cache/nginx && \
    chown -R nginx-user:nginx-user /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R nginx-user:nginx-user /var/run/nginx.pid

# Switch to non-root user
USER nginx-user

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
