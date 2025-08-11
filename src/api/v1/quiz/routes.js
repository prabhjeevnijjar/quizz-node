const activityRouter = require("express").Router();
const prisma = require("../../../../prisma/prismaClient");
const authMiddleware = require("../../../middleware/authMiddleware");

// ------ ADMIN ONLY ENDPOINTS START ------
// create a quiz
activityRouter.post("/", authMiddleware, async (req, res) => {
  try {
    const { name, questions, assigned_user_ids } = req.body;
    const adminId = req.user.id;

    if (req.user.role !== "ADMIN") {
      return res.status(403).json({
        message: "Only admins can create quizzes",
        status: "failure",
        data: null,
      });
    }

    // Validate assigned users: must exist & must be USER role
    let validAssignedUserIds = [];
    if (Array.isArray(assigned_user_ids) && assigned_user_ids.length > 0) {
      const users = await prisma.users.findMany({
        where: {
          id: { in: assigned_user_ids },
          role: "USER",
        },
        select: { id: true },
      });

      validAssignedUserIds = users.map((u) => u.id);

      // If some assigned IDs are not valid
      if (validAssignedUserIds.length !== assigned_user_ids.length) {
        return res.status(400).json({
          message: "Some assigned users do not exist or are not ADMIN users",
          status: "failure",
          data: null,
        });
      }
    }
    // check if quiz with the same name already exists
    const existingQuiz = await prisma.quizzes.findUnique({
      where: { name },
    });

    if (existingQuiz) {
      return res.status(400).json({
        status: "failure",
        message: `Quiz with name "${name}" already exists`,
        data: null,
      });
    }
    const quiz = await prisma.quizzes.create({
      data: {
        name,
        creator_id: adminId,
        expires_at: null,
        status: "DRAFT",
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
          create: validAssignedUserIds.map((userId) => ({
            user_id: userId,
          })),
        },
      },
      include: {
        questions: { include: { options: true } },
        assignments: { include: { user: true } },
      },
    });

    res.status(201).json({
      status: "success",
      message: "Quiz created",
      data: quiz,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: "failure",
      message: "Quiz cannot be created",
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
      return res.status(403).json({
        message: "Only admins can delete quizzes",
        data: null,
        status: "failure",
      });
    }

    const quiz = await prisma.quizzes.update({
      where: { id: Number(quizId) },
      data: {
        status: "DELETED",
        updated_at: new Date(),
      },
    });

    res.json({
      message: "Quiz statue updated ",
      data: quiz,
      status: "success",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to update quiz status",
      data: null,
      status: "failure",
    });
  }
});
// Make the quiz live (update the status to LIVE)
activityRouter.put("/live/:quizId", authMiddleware, async (req, res) => {
  try {
    const { quizId } = req.params;
    const { expires_at, status } = req.body; // 2025-08-15T10:00:00.000Z ISO 8601 UTC timestamp.

    if (!expires_at || isNaN(new Date(expires_at).getTime())) {
      return res.status(400).json({
        message: "Expiration date is required to make the quiz live",
        data: null,
        status: "failure",
      });
    }
    if (!status)
      return res.status(400).json({
        message: "Status is required LIVE | DRAFT",
        data: null,
        status: "failure",
      });
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({
        message: "Only admins can make the quiz live",
        data: null,
        status: "failure",
      });
    }

    const quiz = await prisma.quizzes.update({
      where: { id: Number(quizId) },
      data: {
        status: status,
        updated_at: new Date(),
        expires_at: status === "LIVE" ? new Date(expires_at) : null, // if status is LIVE then only set expiration date
      },
    });

    res.json({ message: "Quiz is now live ", data: quiz, status: "success" });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to update quiz",
      data: null,
      status: "failure",
    });
  }
});
// fetch all users with their user ids so admin can assign quizzes
activityRouter.get("/", async (req, res) => {
  try {
    if (req.user?.role !== "ADMIN") {
      return res.status(403).json({ error: "Only admins can view users" });
    }

    const users = await prisma.users.findMany({
      where: { role: "USER" },
      select: { id: true, email: true },
      orderBy: { id: "asc" },
    });

    res.json({
      data: users,
      status: "success",
      message: "Users fetched succcessfully",
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({
      message: "Failed to fetch users",
      data: null,
      status: "failure",
    });
  }
});

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
