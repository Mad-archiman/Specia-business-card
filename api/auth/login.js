import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb } from '../_lib/mongo.js';
import { setCors } from '../_lib/cors.js';

function json(res, status, data) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(new Error('JSON 파싱 실패'));
      }
    });
    req.on('error', reject);
  });
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export default async function handler(req, res) {
  if (setCors(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method Not Allowed' });

  let body;
  try {
    body = await readBody(req);
  } catch {
    return json(res, 400, { ok: false, error: 'Invalid JSON' });
  }

  const email = normalizeEmail(body?.email);
  const password = String(body?.password || '');

  if (!email || !password) {
    return json(res, 400, { ok: false, error: '이메일과 비밀번호를 입력해주세요.' });
  }

  const db = await getDb();
  const users = db.collection('users');
  const user = await users.findOne(
    { email },
    { projection: { passwordHash: 1, role: 1, name: 1 } }
  );

  if (!user?.passwordHash) {
    return json(res, 401, { ok: false, error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return json(res, 401, { ok: false, error: '이메일 또는 비밀번호가 올바르지 않습니다.' });

  const secret = process.env.JWT_SECRET;
  if (!secret) return json(res, 500, { ok: false, error: '서버 설정(JWT_SECRET)이 필요합니다.' });

  const token = jwt.sign(
    { email, role: user.role, name: user.name },
    secret,
    { expiresIn: '7d' }
  );

  return json(res, 200, { ok: true, token, role: user.role, name: user.name });
}

