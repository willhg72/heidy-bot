FROM node:18-alpine As build

# Create app directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy source files
COPY . .

# Build the application
RUN npm run build

# Remove development dependencies
RUN npm ci --only=production

FROM node:18-alpine As production

# Set NODE_ENV
ENV NODE_ENV production

# Create app directory
WORKDIR /app

# Copy from build stage
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package*.json ./

# Install Puppeteer dependencies for WhatsApp Web
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Tell Puppeteer to use installed Chrome instead of downloading it
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Create directory for WhatsApp sessions
RUN mkdir -p /app/whatsapp-sessions
RUN mkdir -p /app/public

# Run as non-root user
USER node

# Start the application
CMD ["node", "dist/main"]