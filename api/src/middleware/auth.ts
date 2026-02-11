import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// Extended Request interface
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    solanaPubkey?: string;
    role: string;
  };
}

// Authentication middleware
export const AuthMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Missing or invalid authorization header'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Verify token with Aurex API
    const userInfo = await verifyAurexToken(token);
    
    if (!userInfo) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }

    req.user = userInfo;
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(401).json({
      success: false,
      error: 'Authentication failed'
    });
  }
};

// Mock function - replace with actual Aurex API call
async function verifyAurexToken(token: string): Promise<any> {
  // This would make an actual API call to Aurex to verify the token
  // For now, return a mock user
  if (token === 'mock-valid-token') {
    return {
      id: 'user-123',
      solanaPubkey: 'AuRex11111111111111111111111111111111111111',
      role: 'user'
    };
  }
  
  return null;
}