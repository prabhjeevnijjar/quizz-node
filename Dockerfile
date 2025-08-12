FROM node:20

WORKDIR /app

# Copy package files first
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy prisma schema and migrations first (needed for generate)
COPY prisma ./prisma/

# Generate Prisma client in the container
RUN npx prisma generate

# Copy rest of the application
COPY . .

EXPOSE 3000

CMD ["npm", "start"]
