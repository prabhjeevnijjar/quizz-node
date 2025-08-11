const activityRouter = require("express").Router();
const prisma = require("../../../../prisma/prismaClient");
const authMiddleware = require("../../../middleware/authMiddleware");

// ------ ADMIN ONLY ENDPOINTS START ------
// create a quiz
activityRouter.post("/", authMiddleware, async (req, res) => {
  try {
    const { name, expires_at, questions, assigned_user_ids } = req.body;
    // Validation: For valid json body
    const adminId = req.user.id;

    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Only admins can create quizzes" });
    }


    // Validation: I can also check if the users (assigned_user_ids) exist or not in the DB
    const quiz = await prisma.quizzes.create({
      data: {
        name,
        creator_id: adminId,
        expires_at: expires_at ? new Date(expires_at) : null,
        questions: {
          create:
            questions?.map((q) => ({
              question_text: q.question_text,
              options: {
                create: q.options.map((opt) => ({
                  value: opt.value,
                  is_correct: opt.is_correct || false,
                })),
              },
            })) || [],
        },
        assignments: {
          create:
            assigned_user_ids?.map((userId) => ({
              user_id: userId,
            })) || [],
        },
      },
      include: {
        questions: { include: { options: true } },
        assignments: { include: { user: true } },
      },
    });

    res
      .status(201)
      .json({ status: "success", message: "Quiz created", data: quiz });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({
        status: "success",
        message: "Quiz can not be created",
        data: null,
      });
  }
});
// update a quiz
activityRouter.put("/", async () => {});

// delete a quiz (update the status to DELETED)
activityRouter.put("/", async () => {});

// fetch all users with their user ids so admin can assign quizzes
activityRouter.get("/", async () => {});

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
