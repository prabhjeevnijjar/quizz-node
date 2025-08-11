const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const prisma = require("../../../../prisma/prismaClient");
const {sendOtpEmail} = require("../../../helper/mailer");
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
    const { fullName, email, password, confirmPassword } = req.body;
    if (!email || !password || !fullName || password !== confirmPassword) {
      return res
        .status(400)
        .json({ status: "failure", message: "Invalid credentials" });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.isVerified)
      return res
        .status(400)
        .json({ status: "failure", message: "Email exists" });

    // delete the unverified user as they can not access the system anyways
    if (existing && !existing.isVerified) {
      await prisma.otpToken.deleteMany({
        where: {
          userId: existing.id,
        },
      });
      await prisma.user.delete({
        where: {
          email: email,
        },
      });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, password: hashed, role: "CREATOR" },
    });

    const otp = generateOTP();
    const expiresAt = generateExpiresAt();

    // delete any old unverified otps before creating new one
    await prisma.otpToken.deleteMany({
      where: { userId: user.id, verifiedAt: null },
    });

    await prisma.otpToken.upsert({
      where: {
        userId_purpose: {
          userId: user.id,
          purpose: "SIGNUP",
        },
      },
      create: {
        userId: user.id,
        otpCode: otp,
        createdAt: new Date(),
        expiresAt: expiresAt,
        purpose: "SIGNUP",
      },
      update: {
        otpCode: otp,
        createdAt: new Date(),
        expiresAt: expiresAt,
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
  try {
    const { email, otp } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user)
      return res
        .status(400)
        .json({ status: "failure", message: "Invalid user" });
    if (user.isVerified)
      return res
        .status(400)
        .json({ status: "failure", message: "User is already verified" });
    const token = await prisma.otpToken.findFirst({
      where: {
        userId: user.id,
        otpCode: otp,
        verifiedAt: null,
        expiresAt: { gt: new Date() },
        purpose: "SIGNUP",
      },
    });

    if (!token)
      return res
        .status(400)
        .json({ status: "failure", message: "Invalid or expired OTP" });

    await prisma.otpToken.update({
      where: { id: token.id },
      data: { verifiedAt: new Date() },
    });
    await prisma.user.update({ where: { email }, data: { isVerified: true } });

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
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user)
      return res
        .status(400)
        .json({ status: "failure", message: "Invalid email or password" });
    if (user && !user.isVerified)
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

    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: {
        id: true,
        email: true,
        role: true,
        isVerified: true,
        createdAt: true,
      },
    });

    if (!user || !user.isVerified) {
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
