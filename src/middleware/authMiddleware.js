const jwt = require("jsonwebtoken");
const prisma = require("../../prisma/prismaClient");
const { jwtSecret } = require("../config");

const authMiddleware = async (req, res, next) => {
  console.log("---6------")

  try {
console.log("---5------")

    // Read token from HttpOnly cookie (sent via withCredentials: true)
    const token = req.cookies?.token;

    if (!token) {
      return res.status(401).json({ message: "Missing token" });
    }
console.log("---4------")

    const decoded = jwt.verify(token, jwtSecret);

    const user = await prisma.users.findUnique({
      where: { id: decoded.sub },
    });
console.log("---3------",user)

    if (!user || !user.is_verified) {
      return res.status(401).json({ message: "User does not exist or is not verified" });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error("Auth Middleware Error:", err);
    return res.status(403).json({ message: "Invalid or expired token" });
  }
};

module.exports = authMiddleware;
