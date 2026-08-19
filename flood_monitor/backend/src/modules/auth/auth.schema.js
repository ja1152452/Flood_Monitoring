import Joi from 'joi';

export const registerSchema = Joi.object({
  full_name: Joi.string()
    .min(2)
    .max(100)
    .pattern(/^[a-zA-Z\s.'-]+$/)
    .required()
    .messages({
      'string.min':     'Full name must be at least 2 characters',
      'string.max':     'Full name is too long',
      'string.pattern.base': 'Full name must contain alphabetic letters and valid text symbols only',
      'any.required':   'Full name is required',
    }),

  email: Joi.string()
    .email({ tlds: { allow: false } })
    .max(255)
    .required()
    .messages({
      'string.email':   'Please enter a valid email address',
      'any.required':   'Email is required',
    }),

  password: Joi.string()
    .min(8)
    .max(72)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .required()
    .messages({
      'string.min':     'Password must be at least 8 characters',
      'string.pattern.base': 'Password must have uppercase, lowercase, and a number',
      'any.required':   'Password is required',
    }),

  barangay: Joi.string()
    .max(100)
    .optional()
    .allow('', null),

  phone_number: Joi.string()
    .pattern(/^(\+?63|0)?9[\d\s-]{8,12}\d$/)
    .optional()
    .allow('', null)
    .messages({
      'string.pattern.base': 'Contact number must be a valid Philippine mobile number (e.g. 09171234567 or +639171234567)',
    }),
});

export const loginSchema = Joi.object({
  email:    Joi.string().email({ tlds: { allow: false } }).required(),
  password: Joi.string().required(),
});

export const refreshSchema = Joi.object({
  refresh_token: Joi.string().required(),
});