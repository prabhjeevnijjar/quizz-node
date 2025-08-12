# Quiz Backend API

A Node.js + Express backend service for managing quizzes, with **PostgreSQL** as the database and **Prisma ORM**.  
Includes authentication, admin-only quiz creation, and user quiz attempts.  

---

## Features
- JWT-based authentication
- Role-based access (Admin/User)
- Quiz creation, assignment, and status updates
- User quiz attempt tracking and scoring
- Swagger API documentation
- Dockerized setup with PostgreSQL

# Quiz Backend - Setup Guide

This guide explains how to set up and run the Quiz Backend API manually or using Docker.

---

## 🐳 Docker Setup [Need to have docker installed on your machine]
1. **Clone the repository**
   ```bash
   git clone https://github.com/prabhjeevnijjar/quizz-node.git
   cd quizz-node
   ```
2. **Configure Environment Variables**
   - Create a `.env` file in the project root and add the required environment variables.

3. **Build and run containers**
   ```bash
   docker-compose up --build
   ```

4. **Access the API**
   - API: [http://localhost:3000](http://localhost:3000)
   - Swagger Docs: [http://localhost:3000/api-docs](http://localhost:3000/api-docs)

5. **Stop containers**
   ```bash
   docker-compose down
   ```

---

## 📦 Manual Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/prabhjeevnijjar/quizz-node.git
   cd quizz-node
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   - Create a `.env` file in the project root and add the required environment variables (DB connection, JWT secret, etc.).

4. **Run Prisma migrations**
   ```bash
   npx prisma migrate dev
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```
   The API will be available at:
   ```
   http://localhost:3000
   ```
   Swagger documentation will be accessible at:
   ```
   http://localhost:3000/api-docs
   ```



**You can now use Postman or any API client to test the endpoints.**
