require("dotenv").config();
const whitelist = [null, undefined, "null"].includes(process.env.WHITE_LIST)
  ? null
  : process.env.WHITE_LIST.split(",");
const config = {
  baseUrl: process.env.BASE_URL,
  rateLimitConfig: {
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
  },
  whitelist,
  corsOptions: {
    exposedHeaders: "authorization, x-refresh-token, x-token-expiry-time",
    origin: (origin, callback) => {
      if (!origin) {
        //for bypassing postman req with  no origin
        return callback(null, true);
      }
      if (!whitelist || whitelist.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  },
  port: process.env.PORT,

  swaggerOptions: {
    definition: {
      openapi: "3.0.0",
      info: {
        title: "Quiz API",
        version: "1.0.0",
        description: "API documentation for Quiz Management System",
      },
      servers: [
        {
          url: `http://localhost:${process.env.PORT}`,
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
    },
    apis: ["./src/api/v1/**/*.js"], // Path to your API route files
  },
  env: process.env.NODE_ENV,
  senderMail: process.env.EMAIL_USER,
  senderMailPass: process.env.EMAIL_PASS,
  jwtSecret: process.env.JWT_SECRET,
  otpExpireMinutes: process.env.OTP_EXPIRY_MINUTES,
  website: process.env.WEBSITE,
};

module.exports = config;
