const activityRouter = require("express").Router();

// ------ ADMIN ONLY ENDPOINTS START ------
// create a quiz 
activityRouter.post("/", async () => {});

// update a quiz 
activityRouter.put("/", async () => {});

// delete a quiz (update the status to DELETED)
activityRouter.put("/", async () => {});

// ------ ADMIN ONLY ENDPOINTS END------

// get all quizzes assigned to the user
activityRouter.get("/", async () => {});

// get all quizzes with results
activityRouter.get("/results", async () => {});

//GET quiz by its id to be attempted by the user
activityRouter.get(":id", async () => {});

//POST quiz by its id to submit the answers
activityRouter.post(":id", async () => {});

module.exports = activityRouter;
