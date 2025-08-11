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
      return res.status(403).json({
        message: "Only admins can create quizzes",
        status: "failure",
        data: null,
      });
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
    res.status(500).json({
      status: "success",
      message: "Quiz can not be created",
      data: null,
    });
  }
});
// update a quiz

activityRouter.put("/update/:quizId", authMiddleware, async (req, res) => {
  const { quizId } = req.params;
  console.log("---===================================1------", req.params);

  const { name, status, expires_at, questions, assigned_user_ids } = req.body;

  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Only admins can update quizzes" });
    }
    const quizIdNum = Number(quizId);

    // Run everything in a single transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1️⃣ Update main quiz data
      const updatedQuiz = await tx.quizzes.update({
        where: { id: quizIdNum },
        data: {
          name: name || undefined,
          status: status || undefined,
          expires_at: expires_at ? new Date(expires_at) : undefined,
          updated_at: new Date(),
        },
      });

      // 2️⃣ Update assignments if provided
      if (Array.isArray(assigned_user_ids)) {
        // Remove old assignments
        await tx.quiz_assignments.deleteMany({ where: { quiz_id: quizIdNum } });

        // Add new assignments
        if (assigned_user_ids.length > 0) {
          await tx.quiz_assignments.createMany({
            data: assigned_user_ids.map((userId) => ({
              quiz_id: quizIdNum,
              user_id: userId,
            })),
          });
        }
      }

      // 3️⃣ Update questions & options if provided
      if (Array.isArray(questions)) {
        for (const q of questions) {
          if (q.id) {
            // Update existing question
            await tx.questions.update({
              where: { id: q.id },
              data: { question_text: q.question_text || undefined },
            });

            if (Array.isArray(q.options)) {
              // Remove old options
              await tx.options.deleteMany({ where: { question_id: q.id } });

              // Add new options
              await tx.options.createMany({
                data: q.options.map((opt) => ({
                  question_id: q.id,
                  value: opt.value,
                  is_correct: opt.is_correct || false,
                })),
              });
            }
          } else {
            // Create new question with options
            await tx.questions.create({
              data: {
                quiz_id: quizIdNum,
                question_text: q.question_text,
                options: {
                  create:
                    q.options?.map((opt) => ({
                      value: opt.value,
                      is_correct: opt.is_correct || false,
                    })) || [],
                },
              },
            });
          }
        }
      }

      return updatedQuiz;
    });
    console.log("---2------");

    res
      .status(200)
      .json({ message: "Quiz updated successfully", quiz: result });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Failed to update quiz", details: error.message });
  }
});
// delete a quiz (update the status to DELETED)
activityRouter.put("/delete/:quizId", authMiddleware, async (req, res) => {
  try {
    const { quizId } = req.params;

    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Only admins can delete quizzes" });
    }

    const quiz = await prisma.quizzes.update({
      where: { id: Number(quizId) },
      data: {
        status: "DELETED",
        updated_at: new Date(),
      },
    });

    res.json({ message: "Quiz deleted ", data: quiz,status: "success" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to delete quiz",data:null, status: "failure" });
  }
});

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
