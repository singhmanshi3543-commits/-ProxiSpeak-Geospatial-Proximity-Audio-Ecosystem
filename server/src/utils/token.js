import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const COOKIE_NAME = 'ps_token';

export function signToken(userId) {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, { algorithm: 'HS256', expiresIn: env.JWT_EXPIRES_IN });
}

export function verifyToken(token) {
  return jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
}

export function cookieOptions(token) {
  const { exp } = jwt.decode(token);
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax',
    path: '/',
    maxAge: Math.max(0, exp * 1000 - Date.now()),
  };
}

export const clearCookieOptions = {
  httpOnly: true, secure: env.COOKIE_SECURE, sameSite: 'lax', path: '/',
};
