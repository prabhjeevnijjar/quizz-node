const Joi = require("joi");

const createQuizSchema = Joi.object({
  name: Joi.string().min(3).max(255).required().messages({
    "string.empty": `"name" is required`,
    "any.required": `"name" is required`,
  }),
  questions: Joi.array()
    .items(
      Joi.object({
        question_text: Joi.string().min(5).required().messages({
          "string.empty": `"question_text" is required`,
          "any.required": `"question_text" is required`,
        }),
        options: Joi.array()
          .min(1)
          .items(
            Joi.object({
              value: Joi.string().required().messages({
                "string.empty": `"value" is required`,
                "any.required": `"value" is required`,
              }),
              is_correct: Joi.boolean().default(false),
            })
          )
          .required()
          .messages({
            "array.base": `"options" must be an array`,
            "array.min": `"options" must have at least one option`,
          }),
      })
    )
    .min(1)
    .required()
    .messages({
      "array.base": `"questions" must be an array`,
      "array.min": `"questions" must have at least one question`,
    }),
  assigned_user_ids: Joi.array()
    .items(Joi.number().integer().positive().required())
    .required()
    .messages({
      "array.base": `"assigned_user_ids" must be an array of integers`,
      "any.required": `"assigned_user_ids" is required`,
    }),
});

module.exports = { createQuizSchema };
