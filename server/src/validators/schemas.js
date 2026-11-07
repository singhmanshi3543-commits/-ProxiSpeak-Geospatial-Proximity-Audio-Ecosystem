import { z } from 'zod';
import { env } from '../config/env.js';

const password = z
  .string()
  .min(8, 'At least 8 characters')
  .max(72, 'At most 72 characters') // bcrypt ignores bytes beyond 72
  .regex(/[A-Za-z]/, 'Must contain a letter')
  .regex(/\d/, 'Must contain a number');

export const registerSchema = z
  .object({
    username: z.string().trim().toLowerCase().min(3).max(24).regex(/^[a-z0-9_]+$/, 'Letters, numbers, underscore only'),
    email: z.string().trim().toLowerCase().email().max(254),
    password,
    displayName: z.string().trim().min(1).max(40),
  })
  .strict();

export const loginSchema = z
  .object({
    identifier: z.string().trim().toLowerCase().min(1).max(254),
    password: z.string().min(1).max(72),
  })
  .strict();

export const updateProfileSchema = z
  .object({
    displayName: z.string().trim().min(1).max(40),
    bio: z.string().trim().max(160),
    avatarColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a #RRGGBB color'),
    isDiscoverable: z.boolean(),
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Provide at least one field');

export const locationSchema = z
  .object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    accuracy: z.number().min(0).max(100000).optional(), // meters, as reported by the browser
  })
  .strict();

export const createRoomSchema = z
  .object({
    name: z.string().trim().min(1).max(40),
    maxParticipants: z.number().int().min(2).max(env.ROOM_MAX_PARTICIPANTS).optional(),
  })
  .strict();

export const connectionRequestSchema = z
  .object({ userId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid user id') })
  .strict();
