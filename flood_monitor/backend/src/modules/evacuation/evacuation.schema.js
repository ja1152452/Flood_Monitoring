import Joi from 'joi';

export const createSchema = Joi.object({
  name:           Joi.string().max(255).required(),
  barangay:       Joi.string().max(100).required(),
  address:        Joi.string().max(500).optional().allow(''),
  lat:            Joi.number().min(-90).max(90).required(),
  lng:            Joi.number().min(-180).max(180).required(),
  capacity_total: Joi.number().integer().min(1).required(),
  contact_person: Joi.string().max(255).optional().allow(''),
  contact_number: Joi.string().max(20).optional().allow(''),
  is_open:        Joi.boolean().optional(),
});

export const updateSchema = Joi.object({
  name:             Joi.string().max(255).optional(),
  address:          Joi.string().max(500).optional().allow(''),
  capacity_total:   Joi.number().integer().min(1).optional(),
  capacity_current: Joi.number().integer().min(0).optional(),
  contact_person:   Joi.string().max(255).optional().allow(''),
  contact_number:   Joi.string().max(20).optional().allow(''),
  is_open:          Joi.boolean().optional(),
}).min(1);