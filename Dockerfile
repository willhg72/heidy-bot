# syntax = docker/dockerfile:1

# Adjust NODE_VERSION as desired
ARG NODE_VERSION=18.0.0
FROM node:${NODE_VERSION}-slim AS base

LABEL fly_launch_runtime="NestJS"

# NestJS app lives here
WORKDIR /app

# Set production environment
ENV NODE_ENV="production"
ENV NODE_OPTIONS="--max-old-space-size=768"

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

# Build the application using the local NestJS CLI
RUN npx nest build

# Final stage for app image
FROM base

# Install Puppeteer dependencies for WhatsApp Web
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y \
    chromium \
    fonts-freefont-ttf \
    ca-certificates \
    libfreetype6 \
    libharfbuzz0b \
    libnss3 \
    procps \
    && rm -rf /var/lib/apt/lists/*

# Tell Puppeteer to use installed Chrome instead of downloading it
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Copy built application
COPY --from=build /app/node_modules/ ./node_modules/
COPY --from=build /app/dist/ ./dist/
COPY --from=build /app/package*.json ./

# Create directory for WhatsApp sessions and ensure proper permissions
RUN mkdir -p /app/whatsapp-sessions && chmod 777 /app/whatsapp-sessions
RUN mkdir -p /app/public && chmod 777 /app/public

# Create a startup script that handles volume mounting issues and keeps the process alive
RUN echo '#!/bin/sh\n\
# Ensure the volume is properly mounted\n\
if [ -d "/app/whatsapp-sessions" ]; then\n\
  echo "WhatsApp sessions directory exists"\n\
  # Set proper permissions\n\
  chmod -R 777 /app/whatsapp-sessions\n\
fi\n\
\n\
# Start the application in the background\n\
node dist/main.js &\n\
NODE_PID=$!\n\
\n\
# Keep the container running\n\
echo "Application started with PID: $NODE_PID"\n\
\n\
# Create a trap to handle signals properly\n\
trap "kill $NODE_PID; exit" SIGINT SIGTERM\n\
\n\
# Simple heartbeat to keep the container alive\n\
while true; do\n\
  if ! kill -0 $NODE_PID 2>/dev/null; then\n\
    echo "Node process died, restarting..."\n\
    node dist/main.js &\n\
    NODE_PID=$!\n\
    echo "Application restarted with PID: $NODE_PID"\n\
  fi\n\
  echo "Heartbeat: $(date)"\n\
  sleep 30\n\
done\n\
' > /app/start.sh

RUN chmod +x /app/start.sh

# Expose the port
EXPOSE 8080

# Start the application with the startup script
CMD ["/app/start.sh"]
