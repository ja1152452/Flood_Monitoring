import Joi from 'joi';

export const createSOSSchema = Joi.object({
  lat:     Joi.number().min(-90).max(90).required(),
  lng:     Joi.number().min(-180).max(180).required(),
  message: Joi.string().max(500).optional(),
});