import Joi from 'joi';

export const ingestSchema = Joi.object({
  camera_code:       Joi.string().required(),
  water_level_m:     Joi.number().min(0).max(20).required(),
  flood_level:       Joi.string().valid('NORMAL','MONITOR','ALERT','EVACUATION','CRITICAL').required(),
  waterline_pixel_y: Joi.number().integer().min(0).optional(),
  confidence:        Joi.number().min(0).max(1).optional(),
  captured_at:       Joi.string().isoDate().optional(),
});