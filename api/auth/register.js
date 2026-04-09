import bcrypt from 'bcryptjs';
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

  const name = String(body?.name || '').trim();
  const phone = String(body?.phone || '').trim();
  const email = normalizeEmail(body?.email);
  const password = String(body?.password || '');
  const requestedRole = String(body?.role || '').trim().toLowerCase(); // 'user' | 'admin'
  const adminKey = String(body?.adminKey || body?.signupKey || '').trim();
  const serverAdminKey = String(process.env.ADMIN_SIGNUP_KEY || '').trim();
  const role =
    requestedRole === 'admin' && serverAdminKey && adminKey === serverAdminKey ? 'admin' : 'user';

  if (!name || !phone || !email || !password) {
    return json(res, 400, { ok: false, error: '필수 항목(이름/전화번호/이메일/비밀번호)을 입력해주세요.' });
  }

  if (password.length < 8) {
    return json(res, 400, { ok: false, error: '비밀번호는 8자 이상이어야 합니다.' });
  }

  const db = await getDb();
  const users = db.collection('users');

  const exists = await users.findOne({ email }, { projection: { _id: 1 } });
  if (exists) return json(res, 409, { ok: false, error: '이미 가입된 이메일입니다.' });

  const passwordHash = await bcrypt.hash(password, 12);
  const doc = {
    name,
    phone,
    email,
    passwordHash,
    role, // 'user' | 'admin'
    createdAt: new Date(),
  };

  const result = await users.insertOne(doc);
  return json(res, 201, { ok: true, userId: String(result.insertedId), role });
}

