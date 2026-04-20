// =============================================
// JWT Verification Middleware
// =============================================
import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../supabase.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
  };
}

export const verifyJWT = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, error: 'Missing or invalid authorization header' });
      return;
    }

    const token = authHeader.split(' ')[1];

    const { data, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !data.user) {
      res.status(401).json({ success: false, error: 'Invalid or expired token' });
      return;
    }

    req.user = {
      id: data.user.id,
      email: data.user.email,
    };

    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(500).json({ success: false, error: 'Authentication failed' });
  }
};
