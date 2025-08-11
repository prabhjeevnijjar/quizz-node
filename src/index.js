const express = require("express");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const { port } = require("./config/index");
const cors = require("cors");
const helmet = require("helmet");
const ExpressLogs = require("express-server-logs");
const rateLimit = require("express-rate-limit");
// const prisma = require('../prisma/prismaClient.js');
const cookieParser = require("cookie-parser");

const routes = require("./api/v1/router.js");
const { corsOptions, rateLimitConfig } = require("./config");

const limiter = rateLimit(rateLimitConfig);

dotenv.config();

const app = express();
const xlogs = new ExpressLogs(false);

app.use(helmet());
app.use(cors(corsOptions));
app.use(limiter);
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(xlogs.logger);

//routes
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});
app.use("/api/v1", routes);

app.use("*", (req, res) => {
  res.status(404).json({ message: "Route not found" });
});
app.use((err, req, res) => {
  console.error(err.stack);
  res.status(500).json({ message: "Something went wrong" });
});

app.listen(port, () => {
  console.log("connected to port: ", port);
});
