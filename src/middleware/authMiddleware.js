const jwt = require("jsonwebtoken");
const prisma = require("../../prisma/prismaClient");
const { jwtSecret } = require("../config");

const authMiddleware = async (req, res, next) => {
  try {
    // Read token from HttpOnly cookie (sent via withCredentials: true)
    const token = req.cookies?.token;

    if (!token) {
      return res.status(401).json({ message: "Missing token" });
    }

    const decoded = jwt.verify(token, jwtSecret);

    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
    });

    if (!user || !user.is_verified) {
      return res.status(401).json({ message: "User does not exist or is not verified" });
    }

    // if (user.role !== "ADMIN") {
    //   return res.status(400).json({ message: "User does not have admin access" });
    // }

    req.user = user;
    next();
  } catch (err) {
    console.error("Auth Middleware Error:", err);
    return res.status(403).json({ message: "Invalid or expired token" });
  }
};

module.exports = authMiddleware;
