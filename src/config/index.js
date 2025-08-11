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
  env: process.env.NODE_ENV,
  senderMail: process.env.EMAIL_USER,
  senderMailPass: process.env.EMAIL_PASS,
  jwtSecret: process.env.JWT_SECRET,
  port: process.env.PORT,
  otpExpireMinutes: process.env.OTP_EXPIRY_MINUTES,
  website: process.env.WEBSITE,
};

module.exports = config;
