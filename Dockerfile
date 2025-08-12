FROM node:20-alpine

WORKDIR /app

# Copy package files and prisma schema first
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies (use npm ci for production builds)
RUN npm ci --only=production

# Generate Prisma client
RUN npx prisma generate

# Copy the rest of your source code
COPY . .

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001
USER nextjs

# Expose the app port
EXPOSE 3000

# Start the app with database migration
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
