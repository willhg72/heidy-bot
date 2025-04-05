# syntax = docker/dockerfile:1

# Adjust NODE_VERSION as desired
ARG NODE_VERSION=18.0.0
FROM node:${NODE_VERSION}-slim AS base

LABEL fly_launch_runtime="NestJS"

# NestJS app lives here
WORKDIR /app

# Set production environment
ENV NODE_ENV="production"

# Throw-away build stage to reduce size of final image
FROM base AS build

# Install packages needed to build node modules
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp pkg-config python-is-python3

# Install node modules
COPY package*.json ./
RUN npm ci --include=dev

# Copy application code
COPY . .

# Build the application - add verbose logging to see what's happening
RUN npm run build && ls -la dist || echo "Build failed, checking directory structure:" && ls -la

# Final stage for app image
FROM base

# Copy built application
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist || echo "Warning: dist directory not found"
COPY --from=build /app/package*.json ./

# Install Puppeteer dependencies for WhatsApp Web
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y \
    chromium \
    fonts-freefont-ttf \
    ca-certificates \
    libfreetype6 \
    libharfbuzz0b \
    libnss3

# Tell Puppeteer to use installed Chrome instead of downloading it
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Create directory for WhatsApp sessions and public folder
RUN mkdir -p /app/whatsapp-sessions
RUN mkdir -p /app/public

# Expose the port
EXPOSE 8080

# Start the application
CMD ["node", "dist/main.js"]
