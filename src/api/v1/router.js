const express = require("express");
const agreementsRouter = require("./agreements/routes");
const authRouter = require("./auth/routes");

const activityRouter = require("./activity/routes");

const router = express.Router();

router.use("/auth", authRouter);
router.use("/agreements", agreementsRouter);
router.use("/activity", activityRouter);

module.exports = router;
