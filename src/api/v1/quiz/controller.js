const { createQuizSchema } = require("./validator");
const prisma = require("../../../../prisma/prismaClient");

const createQuiz = async (req, res) => {
  try {
    // Check admin role first
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({
        status: "failure",
        message: "Only admins can create quizzes",
        data: null,
      });
    }

    // Joi validation
    const { error, value } = createQuizSchema.validate(req.body, {
      abortEarly: false, // show all errors
    });

    if (error) {
      return res.status(400).json({
        status: "failure",
        message: "Validation failed",
        errors: error.details.map((err) => err.message),
      });
    }

    const { name, questions, assigned_user_ids } = value;

    // Validate assigned users exist & are USER role
    const users = await prisma.users.findMany({
      where: {
        id: { in: assigned_user_ids },
        role: "USER",
      },
      select: { id: true },
    });

    const validAssignedUserIds = users.map((u) => u.id);
    if (validAssignedUserIds.length !== assigned_user_ids.length) {
      return res.status(400).json({
        status: "failure",
        message: "Some assigned users do not exist or are not USER role",
        data: null,
      });
    }

    // Check for duplicate quiz name
    const existingQuiz = await prisma.quizzes.findUnique({ where: { name } });
    if (existingQuiz) {
      return res.status(400).json({
        status: "failure",
        message: `Quiz with name "${name}" already exists`,
        data: null,
      });
    }

    // Create quiz in DB
    const quiz = await prisma.quizzes.create({
      data: {
        name,
        creator_id: req.user.id,
        expires_at: null,
        status: "DRAFT",
        questions: {
          create: questions.map((q) => ({
            question_text: q.question_text,
            options: {
              create: q.options.map((opt) => ({
                value: opt.value,
                is_correct: opt.is_correct || false,
              })),
            },
          })),
        },
        assignments: {
          create: validAssignedUserIds.map((userId) => ({ user_id: userId })),
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
};

const updateQuiz = async (req, res) => {
  {
    const { quizId } = req.params;

    const { name, status, expires_at, questions, assigned_user_ids } = req.body;

    try {
      if (req.user.role !== "ADMIN") {
        return res
          .status(403)
          .json({ error: "Only admins can update quizzes" });
      }
      const quizIdNum = Number(quizId);

      // Run everything in a single transaction
      const result = await prisma.$transaction(async (tx) => {
        const updatedQuiz = await tx.quizzes.update({
          where: { id: quizIdNum },
          data: {
            name: name || undefined,
            status: status || undefined,
            expires_at: expires_at ? new Date(expires_at) : undefined,
            updated_at: new Date(),
          },
        });
        // validation: check here that admins are not assigning quizzes to other admins
        if (Array.isArray(assigned_user_ids)) {
          // Remove old assignments
          await tx.quiz_assignments.deleteMany({
            where: { quiz_id: quizIdNum },
          });

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

      res
        .status(200)
        .json({ message: "Quiz updated successfully", quiz: result });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ error: "Failed to update quiz", details: error.message });
    }
  }
};

const deleteQuiz = async (req, res) => {
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
};

const makeQuizLive = async (req, res) => {
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

    res.json({
      message: "Quiz status updated ",
      data: quiz,
      status: "success",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to update quiz",
      data: null,
      status: "failure",
    });
  }
};

const getAllQuizzes = async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();

    const quizzes = await prisma.quizzes.findMany({
      where: {
        assignments: {
          some: { user_id: userId },
        },
        status: { in: ["LIVE"] },
        OR: [
          { expires_at: null }, // no expiry
          { expires_at: { gt: now } }, // still active
        ],
      },
      select: {
        id: true,
        name: true,
        expires_at: true,
        status: true,
        questions: {
          select: {
            id: true,
            question_text: true,
            options: {
              select: { id: true, value: true },
            },
          },
        },
      },
    });

    res.json({ status: "success", data: quizzes });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: "failure",
      message: "Failed to fetch quizzes",
    });
  }
};

const getQuizResults = async (req, res) => {
  try {
    const userId = req.user.id;

    // Fetch all quizzes assigned to this user
    const quizzes = await prisma.quizzes.findMany({
      where: {
        assignments: {
          some: { user_id: userId },
        },
      },
      select: {
        id: true,
        name: true,
        status: true,
        expires_at: true,
        created_at: true,
        questions: { select: { id: true } },
        quizScores: {
          where: { user_id: userId },
          orderBy: { attempt_number: "desc" },
          take: 1,
          select: {
            score_value_obtained: true,
            score_total: true,
            attempt_number: true,
            completed_at: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
    });

    const results = quizzes.map((quiz) => {
      const maxScore = quiz.questions?.length || 0;
      const latestScore = quiz.quizScores?.[0] || null;

      return {
        id: quiz.id,
        name: quiz.name,
        status: quiz.status,
        expires_at: quiz.expires_at,
        max_score: maxScore,
        latest_score: latestScore?.score_value_obtained ?? null,
        score_total: latestScore?.score_total ?? maxScore,
        attempt_number: latestScore?.attempt_number ?? null,
        completed_at: latestScore?.completed_at ?? null,
        attempted: !!latestScore,
      };
    });

    return res.status(200).json({
      status: "success",
      message: results.length
        ? "Quiz results fetched successfully"
        : "No quizzes assigned to this user",
      data: results,
    });
  } catch (error) {
    console.error("Error fetching quiz results:", error);
    return res.status(500).json({
      status: "failure",
      message: "Failed to fetch quiz results",
      error: error.message,
    });
  }
};

const getQuizById = async (req, res) => {
  try {
    const userId = req.user.id;
    const quizId = Number(req.params.id);
    const now = new Date();

    // Ensure this quiz is assigned to the user and not expired
    const quiz = await prisma.quizzes.findFirst({
      where: {
        id: quizId,
        status: "LIVE",
        assignments: { some: { user_id: userId } },
        OR: [
          { expires_at: null }, // no expiry
          { expires_at: { gt: now } }, // still active
        ],
      },
      select: {
        id: true,
        name: true,
        expires_at: true,
        questions: {
          select: {
            id: true,
            question_text: true,
            options: { select: { id: true, value: true } },
          },
        },
      },
    });

    if (!quiz) {
      return res.status(404).json({
        status: "failure",
        message: "Quiz not found, expired, or not accessible",
      });
    }

    res.json({
      status: "success",
      data: quiz,
      message: "Quiz fetched successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: "failure",
      message: "Failed to fetch quiz",
    });
  }
};

const submitQuizAnswers = async (req, res) => {
  try {
    const userId = req.user.id;
    const quizId = Number(req.params.id);
    const { answers } = req.body;
    const now = new Date();

    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({
        status: "failure",
        message: "No answers provided",
      });
    }

    // Check quiz assignment and expiration
    const quiz = await prisma.quizzes.findFirst({
      where: {
        id: quizId,
        status: "LIVE",
        assignments: { some: { user_id: userId } },
        OR: [{ expires_at: null }, { expires_at: { gt: now } }],
      },
      select: { id: true },
    });

    if (!quiz) {
      return res.status(403).json({
        status: "failure",
        message: "You are not assigned to this quiz or it has expired",
      });
    }

    // Fetch correct options for scoring
    const correctOptions = await prisma.options.findMany({
      where: {
        is_correct: true,
        question: { quiz_id: quizId },
      },
      select: { question_id: true, id: true },
    });

    const totalQuestions = correctOptions.length;
    let correctCount = 0;

    for (const answer of answers) {
      const correct = correctOptions.find(
        (opt) =>
          opt.question_id === answer.question_id && opt.id === answer.option_id
      );
      if (correct) correctCount++;
    }

    // Determine attempt number
    const attemptNumber =
      (await prisma.quiz_scores.count({
        where: { quiz_id: quizId, user_id: userId },
      })) + 1;

    // Save quiz score
    await prisma.quiz_scores.create({
      data: {
        user_id: userId,
        quiz_id: quizId,
        score_value_obtained: correctCount,
        score_total: totalQuestions,
        attempt_number: attemptNumber,
        completed_at: new Date(),
      },
    });

    res.json({
      status: "success",
      message: "Quiz submitted successfully",
      data: {
        score: correctCount,
        total: totalQuestions,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: "failure",
      message: "Failed to submit quiz",
    });
  }
};
module.exports = {
  createQuiz,
  updateQuiz,
  deleteQuiz,
  makeQuizLive,
  getAllQuizzes,
  getQuizResults,
  getQuizById,
  submitQuizAnswers,
};
