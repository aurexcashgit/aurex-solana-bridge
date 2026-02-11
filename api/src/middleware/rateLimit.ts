import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// Simple in-memory rate limiter
// In production, use Redis or another persistent store
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

const RATE_LIMIT = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100 // max requests per window
};

export const RateLimiter = (req: Request, res: Response, next: NextFunction) => {
  const clientId = req.ip || 'unknown';
  const now = Date.now();
  
  // Get or create rate limit info for this client
  let rateInfo = rateLimitStore.get(clientId);
  
  // Reset if window has expired
  if (!rateInfo || now > rateInfo.resetTime) {
    rateInfo = {
      count: 0,
      resetTime: now + RATE_LIMIT.windowMs
    };
  }
  
  rateInfo.count++;
  rateLimitStore.set(clientId, rateInfo);
  
  // Check if rate limit exceeded
  if (rateInfo.count > RATE_LIMIT.maxRequests) {
    logger.warn('Rate limit exceeded', { 
      clientId, 
      count: rateInfo.count,
      path: req.path
    });
    
    return res.status(429).json({
      success: false,
      error: 'Too many requests',
      retryAfter: Math.ceil((rateInfo.resetTime - now) / 1000)
    });
  }
  
  // Add rate limit headers
  res.set({
    'X-RateLimit-Limit': RATE_LIMIT.maxRequests.toString(),
    'X-RateLimit-Remaining': Math.max(0, RATE_LIMIT.maxRequests - rateInfo.count).toString(),
    'X-RateLimit-Reset': Math.ceil(rateInfo.resetTime / 1000).toString()
  });
  
  next();
};