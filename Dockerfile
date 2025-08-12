# Use Node.js official image
FROM node:20

# Set working directory
WORKDIR /app

# Copy package files first
COPY package*.json ./

# Install dependencies inside container
RUN npm install

# Copy the rest of the code
COPY . .

# Expose app port
EXPOSE 3000

# Start app
CMD ["npm", "start"]
