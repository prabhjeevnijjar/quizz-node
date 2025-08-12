const activityRouter = require("express").Router();
const prisma = require("../../../../prisma/prismaClient");
const authMiddleware = require("../../../middleware/authMiddleware");

// ------ ADMIN ONLY ENDPOINTS START ------
// create a quiz
/**
 * @swagger
 * /quiz:
 *   post:
 *     summary: Create a new quiz (Admin only)
 *     description: >
 *       Creates a new quiz with questions and assigns it to specified users.
 *       Only users with the `ADMIN` role can create quizzes.
 *       Assigned users **must exist** in the system and have the `USER` role.
 *     tags: [Quiz]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - questions
 *               - assigned_user_ids
 *             properties:
 *               name:
 *                 type: string
 *                 example: "JavaScript Basics Quiz"
 *               questions:
 *                 type: array
 *                 description: List of questions for the quiz
 *                 items:
 *                   type: object
 *                   required:
 *                     - question_text
 *                     - options
 *                   properties:
 *                     question_text:
 *                       type: string
 *                       example: "What is the output of console.log(typeof null)?"
 *                     options:
 *                       type: array
 *                       items:
 *                         type: object
 *                         required:
 *                           - value
 *                         properties:
 *                           value:
 *                             type: string
 *                             example: "object"
 *                           is_correct:
 *                             type: boolean
 *                             example: true
 *               assigned_user_ids:
 *                 type: array
 *                 description: List of user IDs to assign this quiz to
 *                 items:
 *                   type: integer
 *                 example: [2, 3, 4]
 *     responses:
 *       201:
 *         description: Quiz created successfully
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
 *                   example: Quiz created
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     name:
 *                       type: string
 *                       example: "JavaScript Basics Quiz"
 *                     status:
 *                       type: string
 *                       enum: [DRAFT, LIVE, EXPIRED, DELETED]
 *                       example: DRAFT
 *                     creator_id:
 *                       type: integer
 *                       example: 1
 *                     expires_at:
 *                       type: string
 *                       nullable: true
 *                       example: null
 *                     questions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           question_text:
 *                             type: string
 *                           options:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 id:
 *                                   type: integer
 *                                 value:
 *                                   type: string
 *                                 is_correct:
 *                                   type: boolean
 *                     assignments:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           user:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: integer
 *                               email:
 *                                 type: string
 *       400:
 *         description: Bad request (validation errors)
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
 *                   example: Some assigned users do not exist or are ADMIN users
 *       403:
 *         description: Forbidden — only admins can create quizzes
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
 *                   example: Only admins can create quizzes
 *       500:
 *         description: Internal server error
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
 *                   example: Quiz cannot be created
 */
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
/**
 * @swagger
 * /quiz/update/{quizId}:
 *   put:
 *     summary: Update an existing quiz (Admin only)
 *     description: >
 *       Updates quiz details including name, status, expiration date, assigned users, and questions.
 *       Only users with the `ADMIN` role can update quizzes.
 *       All operations (quiz update, assignments, questions) are performed in a **single transaction**.
 *     tags: [Quiz]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: quizId
 *         in: path
 *         description: ID of the quiz to update
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Updated JavaScript Quiz"
 *               status:
 *                 type: string
 *                 enum: [DRAFT, LIVE, EXPIRED]
 *                 example: LIVE
 *               expires_at:
 *                 type: string
 *                 format: date-time
 *                 example: "2025-08-15T10:00:00.000Z"
 *               assigned_user_ids:
 *                 type: array
 *                 description: List of user IDs to assign this quiz to (removes old assignments)
 *                 items:
 *                   type: integer
 *                 example: [2, 3, 4]
 *               questions:
 *                 type: array
 *                 description: >
 *                   List of questions to update or add.
 *                   If `id` is provided, the question will be updated.
 *                   If `id` is omitted, a new question will be created.
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       nullable: true
 *                       example: 10
 *                     question_text:
 *                       type: string
 *                       example: "What is the value of typeof NaN?"
 *                     options:
 *                       type: array
 *                       items:
 *                         type: object
 *                         required:
 *                           - value
 *                         properties:
 *                           value:
 *                             type: string
 *                             example: "number"
 *                           is_correct:
 *                             type: boolean
 *                             example: true
 *     responses:
 *       200:
 *         description: Quiz updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Quiz updated successfully
 *                 quiz:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     name:
 *                       type: string
 *                       example: "Updated JavaScript Quiz"
 *                     status:
 *                       type: string
 *                       enum: [DRAFT, LIVE, EXPIRED]
 *                       example: LIVE
 *                     expires_at:
 *                       type: string
 *                       example: "2025-08-15T10:00:00.000Z"
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Validation or bad request errors
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Invalid assigned user IDs
 *       403:
 *         description: Forbidden — only admins can update quizzes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Only admins can update quizzes
 *       404:
 *         description: Quiz not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Quiz not found
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Failed to update quiz
 *                 details:
 *                   type: string
 *                   example: Database transaction failed
 */
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
/**
 * @swagger
 * /quiz/delete/{quizId}:
 *   put:
 *     summary: Soft delete a quiz (Admin only)
 *     description: >
 *       Marks an existing quiz as `DELETED` without removing it from the database.
 *       Only users with the `ADMIN` role can delete quizzes.
 *       This is a **soft delete** — the quiz remains in the database but will be excluded from normal queries.
 *     tags: [Quiz]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: quizId
 *         in: path
 *         required: true
 *         description: ID of the quiz to delete
 *         schema:
 *           type: integer
 *           example: 5
 *     responses:
 *       200:
 *         description: Quiz status updated to DELETED
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Quiz status updated
 *                 status:
 *                   type: string
 *                   enum: [success]
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 5
 *                     name:
 *                       type: string
 *                       example: "JavaScript Basics"
 *                     status:
 *                       type: string
 *                       enum: [DRAFT, LIVE, EXPIRED, DELETED]
 *                       example: DELETED
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-08-11T12:30:00.000Z"
 *       403:
 *         description: Forbidden — only admins can delete quizzes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [failure]
 *                   example: failure
 *                 message:
 *                   type: string
 *                   example: Only admins can delete quizzes
 *                 data:
 *                   type: "null"
 *                   example: null
 *       404:
 *         description: Quiz not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [failure]
 *                   example: failure
 *                 message:
 *                   type: string
 *                   example: Quiz not found
 *                 data:
 *                   type: "null"
 *                   example: null
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [failure]
 *                   example: failure
 *                 message:
 *                   type: string
 *                   example: Failed to update quiz status
 *                 data:
 *                   type: "null"
 *                   example: null
 */
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
/**
 * @swagger
 * /quiz/live/{quizId}:
 *   put:
 *     summary: Make a quiz LIVE or revert it to DRAFT (Admin only)
 *     description: >
 *       Updates the quiz status to `LIVE` or `DRAFT`.
 *       If setting to `LIVE`, an expiration date (`expires_at`) **must** be provided in ISO 8601 UTC format.
 *       Only `ADMIN` users are allowed to perform this action.
 *     tags: [Quiz]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: quizId
 *         in: path
 *         required: true
 *         description: ID of the quiz to update
 *         schema:
 *           type: integer
 *           example: 7
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - expires_at
 *               - status
 *             properties:
 *               expires_at:
 *                 type: string
 *                 format: date-time
 *                 description: >
 *                   Expiration date/time in **ISO 8601 UTC format** (required only if status is `LIVE`).
 *                   Example: `"2025-08-15T10:00:00.000Z"`
 *                 example: "2025-08-15T10:00:00.000Z"
 *               status:
 *                 type: string
 *                 enum: [LIVE, DRAFT]
 *                 description: >
 *                   The desired status of the quiz.
 *                   - `LIVE`: Makes the quiz available for assigned users until `expires_at`.
 *                   - `DRAFT`: Makes the quiz inactive and removes `expires_at`.
 *                 example: LIVE
 *     responses:
 *       200:
 *         description: Quiz status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Quiz status updated
 *                 status:
 *                   type: string
 *                   enum: [success]
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 7
 *                     name:
 *                       type: string
 *                       example: "React Fundamentals"
 *                     status:
 *                       type: string
 *                       enum: [LIVE, DRAFT, EXPIRED, DELETED]
 *                       example: LIVE
 *                     expires_at:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-08-15T10:00:00.000Z"
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-08-11T15:30:00.000Z"
 *       400:
 *         description: Bad request — missing or invalid data
 *         content:
 *           application/json:
 *             examples:
 *               missingExpiresAt:
 *                 summary: Missing expires_at
 *                 value:
 *                   status: failure
 *                   message: Expiration date is required to make the quiz live
 *                   data: null
 *               missingStatus:
 *                 summary: Missing status
 *                 value:
 *                   status: failure
 *                   message: Status is required LIVE | DRAFT
 *                   data: null
 *       403:
 *         description: Forbidden — only admins can make quizzes live
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [failure]
 *                   example: failure
 *                 message:
 *                   type: string
 *                   example: Only admins can make the quiz live
 *                 data:
 *                   type: "null"
 *                   example: null
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [failure]
 *                   example: failure
 *                 message:
 *                   type: string
 *                   example: Failed to update quiz
 *                 data:
 *                   type: "null"
 *                   example: null
 */
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
});

// ------ ADMIN ONLY ENDPOINTS END------

// get all quizzes assigned to the user
/**
 * @swagger
 * /quiz:
 *   get:
 *     summary: Get all quizzes assigned to the logged-in user
 *     description: >
 *       Returns all **LIVE** quizzes assigned to the currently authenticated user,
 *       excluding expired ones.
 *       - Expired quizzes are filtered out unless they have `expires_at` set to `null`.
 *       - This endpoint is accessible **only** by users with the `USER` role.
 *     tags: [Quiz]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully fetched the list of assigned quizzes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [success]
 *                   example: success
 *                 data:
 *                   type: array
 *                   description: List of quizzes assigned to the user
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 101
 *                       name:
 *                         type: string
 *                         example: "JavaScript Fundamentals"
 *                       expires_at:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                         example: "2025-08-15T10:00:00.000Z"
 *                       status:
 *                         type: string
 *                         enum: [LIVE]
 *                         example: LIVE
 *                       questions:
 *                         type: array
 *                         description: Quiz questions (without correct answers)
 *                         items:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: integer
 *                               example: 301
 *                             question_text:
 *                               type: string
 *                               example: "What is the output of console.log(typeof null)?"
 *                             options:
 *                               type: array
 *                               description: List of available answer options
 *                               items:
 *                                 type: object
 *                                 properties:
 *                                   id:
 *                                     type: integer
 *                                     example: 501
 *                                   value:
 *                                     type: string
 *                                     example: "object"
 *       401:
 *         description: Unauthorized - No token or invalid token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [failure]
 *                   example: failure
 *                 message:
 *                   type: string
 *                   example: Unauthorized
 *       500:
 *         description: Internal server error while fetching quizzes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [failure]
 *                   example: failure
 *                 message:
 *                   type: string
 *                   example: Failed to fetch quizzes
 */

activityRouter.get("/", authMiddleware, async (req, res) => {
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
});

// Get quiz results for the user
/**
 * @swagger
 * /quiz/results:
 *   get:
 *     summary: Get quiz results for the logged-in user
 *     description: >
 *       Retrieves the latest score results for all quizzes assigned to the authenticated user,
 *       regardless of quiz status (`LIVE`, `DRAFT`, or `DELETED`).
 *       - Returns the **most recent attempt** for each quiz along with maximum score and quiz details.
 *       - If the quiz has never been attempted, `latest_score` will be `null` and `attempted` will be `false`.
 *       - Accessible **only** to authenticated users with the `USER` role.
 *     tags: [Quiz]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully fetched quiz results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [success]
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Quiz results fetched successfully
 *                 data:
 *                   type: array
 *                   description: List of quizzes with latest score information
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 101
 *                       name:
 *                         type: string
 *                         example: "JavaScript Fundamentals"
 *                       status:
 *                         type: string
 *                         enum: [LIVE, DRAFT, DELETED]
 *                         example: LIVE
 *                       expires_at:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                         example: "2025-08-15T10:00:00.000Z"
 *                       max_score:
 *                         type: integer
 *                         description: Maximum possible score for the quiz
 *                         example: 10
 *                       latest_score:
 *                         type: integer
 *                         nullable: true
 *                         description: Score obtained in the latest attempt
 *                         example: 8
 *                       score_total:
 *                         type: integer
 *                         description: Total possible points in that attempt
 *                         example: 10
 *                       attempt_number:
 *                         type: integer
 *                         nullable: true
 *                         description: Attempt number of the latest quiz attempt
 *                         example: 1
 *                       completed_at:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                         example: "2025-08-01T14:30:00.000Z"
 *                       attempted:
 *                         type: boolean
 *                         description: Whether the quiz has been attempted by the user
 *                         example: true
 *       401:
 *         description: Unauthorized - No token or invalid token provided
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
 *         description: Internal server error while fetching quiz results
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
 *                   example: Failed to fetch quiz results
 *                 error:
 *                   type: string
 *                   example: Unexpected database error
 */
activityRouter.get("/results", authMiddleware, async (req, res) => {
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
});
//GET quiz by its id to be attempted by the user
/**
 * @swagger
 * /quiz/{id}:
 *   get:
 *     summary: Get quiz details for the logged-in user to attempt
 *     description: >
 *       Retrieves a specific quiz assigned to the authenticated user **without revealing correct answers**.
 *       - The quiz must be `LIVE` and either have no expiration date or not yet expired.
 *       - Only users assigned to the quiz can access it.
 *       - Expired or unassigned quizzes return `404`.
 *     tags: [Quiz]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 101
 *         description: The unique ID of the quiz to fetch
 *     responses:
 *       200:
 *         description: Successfully fetched the quiz
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [success]
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 101
 *                     name:
 *                       type: string
 *                       example: "JavaScript Fundamentals"
 *                     expires_at:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *                       example: "2025-08-15T10:00:00.000Z"
 *                     questions:
 *                       type: array
 *                       description: List of quiz questions (without correct answers)
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                             example: 1
 *                           question_text:
 *                             type: string
 *                             example: "What is the output of console.log(typeof null)?"
 *                           options:
 *                             type: array
 *                             description: Multiple-choice options
 *                             items:
 *                               type: object
 *                               properties:
 *                                 id:
 *                                   type: integer
 *                                   example: 11
 *                                 value:
 *                                   type: string
 *                                   example: "object"
 *                 message:
 *                   type: string
 *                   example: Quiz fetched successfully
 *       401:
 *         description: Unauthorized - Missing or invalid authentication token
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
 *       404:
 *         description: Quiz not found, expired, or not accessible to this user
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
 *                   example: Quiz not found, expired, or not accessible
 *       500:
 *         description: Internal server error while fetching quiz details
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
 *                   example: Failed to fetch quiz
 */
activityRouter.get("/:id", authMiddleware, async (req, res) => {
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
});
// POST /api/v1/quiz/:id - Submit quiz answers
/**
 * @swagger
 * /quiz/{id}:
 *   post:
 *     summary: Submit quiz answers
 *     description: >
 *       Allows an authenticated **USER** to submit answers for a quiz they are assigned to.
 *       - The quiz must have a `LIVE` status and must not be expired.
 *       - The user must be assigned to the quiz to attempt it.
 *       - Calculates the score based on correct answers and stores the attempt in the database.
 *       - Multiple attempts are allowed, with attempt numbers tracked.
 *     tags: [Quiz]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 105
 *         description: The unique ID of the quiz to submit
 *     requestBody:
 *       required: true
 *       description: List of question and selected option pairs for the quiz
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - answers
 *             properties:
 *               answers:
 *                 type: array
 *                 description: An array of answers for the quiz questions
 *                 items:
 *                   type: object
 *                   required:
 *                     - question_id
 *                     - option_id
 *                   properties:
 *                     question_id:
 *                       type: integer
 *                       example: 1
 *                     option_id:
 *                       type: integer
 *                       example: 11
 *           example:
 *             answers:
 *               - question_id: 1
 *                 option_id: 11
 *               - question_id: 2
 *                 option_id: 17
 *     responses:
 *       200:
 *         description: Quiz submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [success]
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Quiz submitted successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     score:
 *                       type: integer
 *                       example: 8
 *                     total:
 *                       type: integer
 *                       example: 10
 *       400:
 *         description: No answers provided or invalid request body
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
 *                   example: No answers provided
 *       403:
 *         description: User not assigned to quiz or quiz has expired
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
 *                   example: You are not assigned to this quiz or it has expired
 *       500:
 *         description: Internal server error while submitting the quiz
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
 *                   example: Failed to submit quiz
 */
activityRouter.post("/:id", authMiddleware, async (req, res) => {
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
});

module.exports = activityRouter;
