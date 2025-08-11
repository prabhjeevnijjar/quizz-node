const { rateLimit } = require("express-rate-limit");

const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5, // limit each IP to 5 requests
  message: {
    status: "failure",
    message: "Too many OTP verification attempts, please try again in 10 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = otpLimiter;
