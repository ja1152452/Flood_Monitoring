import Joi from 'joi';

export const createCameraSchema = Joi.object({
  camera_code:      Joi.string().max(50).required(),
  api_key:          Joi.string().min(32).required(),
  location_name:    Joi.string().max(255).required(),
  barangay:         Joi.string().max(100).optional(),
  lat:              Joi.number().min(-90).max(90).required(),
  lng:              Joi.number().min(-180).max(180).required(),
  baseline_meters:  Joi.number().min(0).required(),
  baseline_pixel_y: Joi.number().integer().min(0).required(),
  px_per_meter:     Joi.number().min(1).required(),
  stream_url:       Joi.string().uri().optional(),
});

export const updateCameraSchema = Joi.object({
  location_name:    Joi.string().max(255),
  barangay:         Joi.string().max(100),
  lat:              Joi.number().min(-90).max(90),
  lng:              Joi.number().min(-180).max(180),
  baseline_meters:  Joi.number().min(0),
  baseline_pixel_y: Joi.number().integer().min(0),
  px_per_meter:     Joi.number().min(1),
  stream_url:       Joi.string().uri().allow(null),
  is_active:        Joi.boolean(),
}).min(1);

export const calibrationSchema = Joi.object({
  baseline_meters:  Joi.number().min(0).required(),
  baseline_pixel_y: Joi.number().integer().min(0).required(),
  px_per_meter:     Joi.number().min(1).required(),
});