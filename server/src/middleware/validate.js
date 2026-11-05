import mongoose from 'mongoose';
import { AppError } from '../utils/AppError.js';

// Validate request body
export const validateBody = (schema) => (req, _res, next) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    return next(result.error);
  }

  req.body = result.data;
  next();
};

// Validate MongoDB ObjectId
export const validateObjectIdParam = (name = 'id') => (req, _res, next) => {
  const value = req.params[name];

  if (
    typeof value === 'string' &&
    /^[a-f\d]{24}$/i.test(value) &&
    mongoose.isValidObjectId(value)
  ) {
    return next();
  }

  next(new AppError(400, `Invalid ${name}`, 'BAD_ID'));
};