const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const prisma = require("../../../../prisma/prismaClient");
const { sendOtpEmail } = require("../../../helper/mailer");
const authRouter = express.Router();
const rateLimiter = require("../../../middleware/rateLimiter");
const { jwtSecret, otpExpireMinutes } = require("../../../config");

const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

const generateExpiresAt = () =>
  new Date(Date.now() + 1000 * 60 * Number(otpExpireMinutes));

const logoutUser = (res) =>
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Lax",
    path: "/",
  });

const setCookie = (res, jwtToken) =>
  res.status(200).cookie("token", jwtToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

authRouter.post("/signup", rateLimiter, async (req, res) => {
  try {
    const { fullName, email, password, confirmPassword, role } = req.body;
    // Validation: email, password, fullName, confirmPassword, role are required
    if (!email || !password || !fullName || !confirmPassword || !role) {
      return res
        .status(400)
        .json({ status: "failure", message: "All fields are required" });
    }
    if (!email || !password || !fullName || password !== confirmPassword) {
      return res
        .status(400)
        .json({ status: "failure", message: "Invalid credentials" });
    }

    const existing = await prisma.users.findUnique({ where: { email } });
    if (existing && existing.is_verified)
      return res
        .status(400)
        .json({ status: "failure", message: "Email exists" });

    // delete the unverified user as they can not access the system anyways
    if (existing && !existing.is_verified) {
      await prisma.otp_tokens.deleteMany({
        where: {
          user_id: existing.id,
        },
      });
      await prisma.users.delete({
        where: {
          email: email,
        },
      });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.users.create({
      data: { email, password: hashed, role },
    });

    const otp = generateOTP();
    const expiresAt = generateExpiresAt();

    // delete any old unverified otps before creating new one
    await prisma.otp_tokens.deleteMany({
      where: { user_id: user.id, verified_at: null },
    });

    await prisma.otp_tokens.upsert({
      where: {
        user_id_purpose: {
          user_id: user.id,
          purpose: "SIGNUP",
        },
      },
      create: {
        user_id: user.id,
        otp_code: otp,
        created_at: new Date(),
        expires_at: expiresAt,
        purpose: "SIGNUP",
      },
      update: {
        otp_code: otp,
        created_at: new Date(),
        expires_at: expiresAt,
      },
    });

    await sendOtpEmail(email, otp);
    return res.status(200).json({ status: "success", message: "OTP sent" });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ status: "failure", message: "Something went wrong" });
  }
});

authRouter.post("/verify-otp", async (req, res) => {
  // Validation:: email and otp are required both in string format
  if (!req.body.email || !req.body.otp) {
    return res
      .status(400)
      .json({ status: "failure", message: "Email and OTP are required" });
  }
  try {
    const { email, otp } = req.body;
    const user = await prisma.users.findUnique({ where: { email } });
    if (!user)
      return res
        .status(400)
        .json({ status: "failure", message: "Invalid user" });
    if (user.is_verified)
      return res
        .status(400)
        .json({ status: "failure", message: "User is already verified" });
    const token = await prisma.otp_tokens.findFirst({
      where: {
        user_id: user.id,
        otp_code: otp,
        verified_at: null,
        expires_at: { gt: new Date() },
        purpose: "SIGNUP",
      },
    });

    if (!token)
      return res
        .status(400)
        .json({ status: "failure", message: "Invalid or expired OTP" });

    await prisma.otp_tokens.update({
      where: { id: token.id },
      data: { verified_at: new Date() },
    });
    await prisma.users.update({
      where: { email },
      data: { is_verified: true },
    });

    const jwtToken = jwt.sign({ sub: user.id }, jwtSecret, {
      expiresIn: "7d",
    });
    setCookie(res, jwtToken);
    res
      .status(200)
      .json({ status: "success", message: "OTP verified", token: jwtToken });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ status: "failure", message: "Something went wrong" });
  }
});

authRouter.post("/login", async (req, res) => {
  // Validation:: email and password are required both in string format
  if (!req.body.email || !req.body.password) {
    return res
      .status(400)
      .json({ status: "failure", message: "Email and password are required" });
  }
  try {
    const { email, password } = req.body;
    const user = await prisma.users.findUnique({ where: { email } });
    if (!user)
      return res
        .status(400)
        .json({ status: "failure", message: "Invalid email or password" });
    if (user && !user.is_verified)
      return res
        .status(403)
        .json({ status: "failure", message: "Email not verified" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res
        .status(400)
        .json({ status: "failure", message: "Invalid email or password" });

    const jwtToken = jwt.sign({ sub: user.id }, jwtSecret, {
      expiresIn: "7d",
    });
    setCookie(res, jwtToken);
    res.status(200).json({ status: "success", token: jwtToken });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ status: "failure", message: "Something went wrong" });
  }
});

authRouter.get("/me", async (req, res) => {
  try {
    let token;

    if (req.cookies?.token) {
      token = req.cookies.token;
    }

    // Fallback to Authorization header (for client-side fetch)
    if (!token && req.headers.authorization) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      logoutUser(res);
      return res
        .status(401)
        .json({ status: "failure", message: "Unauthorized", data: null });
    }

    const decoded = jwt.verify(token, jwtSecret);

    const user = await prisma.users.findUnique({
      where: { id: decoded.sub },
      select: {
        id: true,
        email: true,
        role: true,
        is_verified: true,
        created_at: true,
      },
    });

    if (!user || !user.is_verified) {
      logoutUser(res);

      return res.status(401).json({
        status: "failure",
        message: "User not found or unverified",
        data: null,
      });
    }

    return res
      .status(200)
      .json({ status: "success", message: "User data found", data: user });
  } catch (err) {
    console.error(err);
    logoutUser(res);

    return res
      .status(401)
      .json({ status: "failure", message: "Invalid token", data: null });
  }
});

authRouter.post("/logout", async (req, res) => {
  try {
    logoutUser(res);
    return res.status(200).json({ status: "success", message: "Logged out" });
  } catch {
    logoutUser(res);
  }
});

module.exports = authRouter;
