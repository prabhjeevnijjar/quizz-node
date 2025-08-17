const express = require("express");
const bcrypt = require('bcryptjs');
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
/**
 * @swagger
 * /api/v1/auth/signup:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fullName
 *               - email
 *               - password
 *               - confirmPassword
 *               - role
 *             properties:
 *               fullName:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               confirmPassword:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [ADMIN, USER]
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *       400:
 *         description: Validation error
 */
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
/**
 * @swagger
 * /api/v1/auth/verify-otp:
 *   post:
 *     summary: Verify user OTP for signup confirmation
 *     description: >
 *       This endpoint verifies a user's email address by matching the provided OTP code against the stored OTP token.
 *       If successful, the user is marked as verified, a JWT is issued, and it is also set as an HTTP-only cookie.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               otp:
 *                 type: string
 *                 minLength: 6
 *                 maxLength: 6
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: OTP verified successfully, user verified, JWT issued.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: OTP verified
 *                 token:
 *                   type: string
 *                   description: JWT authentication token.
 *       400:
 *         description: Invalid request or OTP verification failed.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: failure
 *                 message:
 *                   type: string
 *                   example: Invalid or expired OTP
 *       401:
 *         description: Unauthorized request.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: failure
 *                 message:
 *                   type: string
 *                   example: Unauthorized
 *       500:
 *         description: Server error while verifying OTP.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: failure
 *                 message:
 *                   type: string
 *                   example: Something went wrong
 */
authRouter.post("/verify-otp", rateLimiter, async (req, res) => {
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
/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Log in a user
 *     description: >
 *       Authenticates a user with their email and password.
 *       On success, returns a JWT token in the response body and sets it as an HTTP-only cookie for subsequent requests.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: MySecurePassword123
 *     responses:
 *       200:
 *         description: Login successful. JWT token returned and cookie set.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 token:
 *                   type: string
 *                   description: JWT authentication token.
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *       400:
 *         description: Missing fields or invalid credentials.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: failure
 *                 message:
 *                   type: string
 *                   example: Invalid email or password
 *       403:
 *         description: Email exists but is not yet verified.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: failure
 *                 message:
 *                   type: string
 *                   example: Email not verified
 *       500:
 *         description: Internal server error during login attempt.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: failure
 *                 message:
 *                   type: string
 *                   example: Something went wrong
 */
authRouter.post("/login", rateLimiter, async (req, res) => {
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
/**
 * @swagger
 * /api/v1/auth/me:
 *   get:
 *     summary: Get current authenticated user
 *     description: >
 *       Retrieves information about the currently logged-in user based on the JWT token.
 *       The token can be provided either via an HTTP-only cookie named `token` or as a Bearer token in the `Authorization` header.
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: cookie
 *         name: token
 *         schema:
 *           type: string
 *         required: false
 *         description: JWT authentication token stored in an HTTP-only cookie.
 *       - in: header
 *         name: Authorization
 *         schema:
 *           type: string
 *           example: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *         required: false
 *         description: JWT authentication token in Bearer format (used when cookies are not available).
 *     responses:
 *       200:
 *         description: Authenticated user data retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: User data found
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     email:
 *                       type: string
 *                       example: user@example.com
 *                     role:
 *                       type: string
 *                       example: USER
 *                     is_verified:
 *                       type: boolean
 *                       example: true
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                       example: 2025-08-11T10:20:30Z
 *       401:
 *         description: Unauthorized — missing token, invalid token, or unverified user.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: failure
 *                 message:
 *                   type: string
 *                   example: Unauthorized
 *                 data:
 *                   type: string
 *                   nullable: true
 *                   example: null
 *       500:
 *         description: Internal server error while fetching user data.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: failure
 *                 message:
 *                   type: string
 *                   example: Something went wrong
 */
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
/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     summary: Log out the current user
 *     description: >
 *       Logs out the currently authenticated user by clearing the JWT authentication cookie (`token`).
 *       This endpoint works even if no token is provided and will silently succeed.
 *       No request body is required.
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully logged out.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Logged out
 *       401:
 *         description: Unauthorized — no token provided (optional behavior depending on implementation).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: failure
 *                 message:
 *                   type: string
 *                   example: Unauthorized
 *       500:
 *         description: Internal server error while logging out.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: failure
 *                 message:
 *                   type: string
 *                   example: Something went wrong
 */
authRouter.post("/logout", async (req, res) => {
  try {
    logoutUser(res);
    return res.status(200).json({ status: "success", message: "Logged out" });
  } catch {
    logoutUser(res);
  }
});

module.exports = authRouter;
