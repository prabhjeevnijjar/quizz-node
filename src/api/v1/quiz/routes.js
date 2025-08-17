const activityRouter = require("express").Router();
const authMiddleware = require("../../../middleware/authMiddleware");
const {
  createQuiz,
  updateQuiz,
  deleteQuiz,
  makeQuizLive,
  getAllQuizzes,
  getQuizResults,
  getQuizById,
  submitQuizAnswers,
} = require("./controller");

// ------ ADMIN ONLY ENDPOINTS START ------
// create a quiz
/**
 * @swagger
 * /api/v1/quiz:
 *   post:
 *     summary: Create a new quiz (Admin only)
 *     description: >
 *       Creates a new quiz with questions and assigns it to specified users.
 *       Only users with the `ADMIN` role can create quizzes.
 *       Assigned users **must exist** in the system and have the `USER` role.
 *       **Validation rules** (Joi):
 *       - `name`: string, min length 3, max length 255, required
 *       - `questions`: array of objects, min length 1, required
 *         - `question_text`: string, min length 5, required
 *         - `options`: array of objects, min length 1, required
 *           - `value`: string, required
 *           - `is_correct`: boolean, optional (defaults to false)
 *       - `assigned_user_ids`: array of positive integers, required
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
 *                 minLength: 3
 *                 maxLength: 255
 *                 example: "JavaScript Basics Quiz"
 *               questions:
 *                 type: array
 *                 description: List of questions for the quiz
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required:
 *                     - question_text
 *                     - options
 *                   properties:
 *                     question_text:
 *                       type: string
 *                       minLength: 5
 *                       example: "What is the output of console.log(typeof null)?"
 *                     options:
 *                       type: array
 *                       minItems: 1
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
 *                 minItems: 1
 *                 items:
 *                   type: integer
 *                   minimum: 1
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
 *         description: Bad request — validation failed or assigned users invalid
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
 *                   example: Validation failed
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example:
 *                     - '"name" is required'
 *                     - '"questions" must contain at least 1 item'
 *                     - '"assigned_user_ids[0]" must be a positive number'
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
activityRouter.post("/", authMiddleware, async (req, res) =>
  createQuiz(req, res)
);
// update a quiz
/**
 * @swagger
 * /api/v1/quiz/update/{quizId}:
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
activityRouter.put("/update/:quizId", authMiddleware, async (req, res) =>
  updateQuiz(req, res)
);
// delete a quiz (update the status to DELETED)
/**
 * @swagger
 * /api/v1/quiz/delete/{quizId}:
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
activityRouter.put("/delete/:quizId", authMiddleware, async (req, res) =>
  deleteQuiz(req, res)
);
// Make the quiz live (update the status to LIVE)
/**
 * @swagger
 * /api/v1/quiz/live/{quizId}:
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
activityRouter.put("/live/:quizId", authMiddleware, async (req, res) =>
  makeQuizLive(req, res)
);

// ------ ADMIN ONLY ENDPOINTS END------

// get all quizzes assigned to the user
/**
 * @swagger
 * /api/v1/quiz:
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

activityRouter.get("/", authMiddleware, async (req, res) =>
  getAllQuizzes(req, res)
);

// Get quiz results for the user
/**
 * @swagger
 * /api/v1/quiz/results:
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
activityRouter.get("/results", authMiddleware, async (req, res) =>
  getQuizResults(req, res)
);
//GET quiz by its id to be attempted by the user
/**
 * @swagger
 * /api/v1/quiz/{id}:
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
activityRouter.get("/:id", authMiddleware, async (req, res) =>
  getQuizById(req, res)
);
// POST /api/v1/quiz/:id - Submit quiz answers
/**
 * @swagger
 * /api/v1/quiz/{id}:
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
activityRouter.post("/:id", authMiddleware, async (req, res) =>
  submitQuizAnswers(req, res)
);

module.exports = activityRouter;
