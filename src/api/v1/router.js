const express = require("express");
const authRouter = require("./auth/routes");

const quizRouter = require("./quiz/routes");

const router = express.Router();

router.use("/auth", authRouter);
router.use("/quiz", quizRouter);

module.exports = router;
