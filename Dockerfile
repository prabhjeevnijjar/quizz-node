FROM node:20

WORKDIR /app

# Copy package files and prisma schema first
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies inside the container
RUN npm install

# Generate Prisma client
RUN npx prisma generate

# Copy the rest of your source code (excluding node_modules via .dockerignore)
COPY . .

# Expose the app port
EXPOSE 3000

# Start the app
CMD ["npm", "start"]
