import jwt from 'jsonwebtoken';

export function getBearerToken(req) {
  const h = req.headers?.authorization || req.headers?.Authorization || '';
  const v = Array.isArray(h) ? h[0] : h;
  if (!v || typeof v !== 'string') return null;
  const m = v.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

export function verifyJwt(req) {
  const token = getBearerToken(req);
  if (!token) {
    const err = new Error('인증이 필요합니다.');
    err.statusCode = 401;
    throw err;
  }
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    const err = new Error('서버 설정(JWT_SECRET)이 필요합니다.');
    err.statusCode = 500;
    throw err;
  }
  try {
    return jwt.verify(token, secret);
  } catch {
    const err = new Error('토큰이 유효하지 않습니다.');
    err.statusCode = 401;
    throw err;
  }
}

export function requireAdmin(payload) {
  if (!payload || payload.role !== 'admin') {
    const err = new Error('관리자 권한이 필요합니다.');
    err.statusCode = 403;
    throw err;
  }
}

