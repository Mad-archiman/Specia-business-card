import { ObjectId } from 'mongodb';
import { getDb } from '../_lib/mongo.js';
import { setCors } from '../_lib/cors.js';
import { verifyJwt, requireAdmin } from '../_lib/auth.js';

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
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function toNoticeDoc(doc) {
  return {
    id: String(doc._id),
    date: doc.date || null,
    title: doc.title || '',
    body: doc.body || '',
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
  };
}

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  const db = await getDb();
  const col = db.collection('notices');

  if (req.method === 'GET') {
    const items = await col
      .find({}, { projection: { title: 1, body: 1, date: 1, createdAt: 1, updatedAt: 1 } })
      .sort({ date: -1, createdAt: -1 })
      .limit(500)
      .toArray();
    return json(res, 200, { ok: true, notices: items.map(toNoticeDoc) });
  }

  if (req.method === 'POST') {
    let payload;
    try {
      payload = verifyJwt(req);
      requireAdmin(payload);
    } catch (e) {
      return json(res, e.statusCode || 401, { ok: false, error: e.message || 'Unauthorized' });
    }

    let body;
    try {
      body = await readBody(req);
    } catch {
      return json(res, 400, { ok: false, error: 'Invalid JSON' });
    }

    const title = String(body?.title || '').trim();
    const date = String(body?.date || '').trim(); // YYYY-MM-DD
    const content = String(body?.body || '');

    if (!title || !date) return json(res, 400, { ok: false, error: '작성일과 제목은 필수입니다.' });

    const now = new Date();
    const result = await col.insertOne({
      title,
      date,
      body: content,
      createdAt: now,
      updatedAt: now,
      createdBy: payload.email || null,
    });

    const doc = await col.findOne({ _id: result.insertedId });
    return json(res, 201, { ok: true, notice: toNoticeDoc(doc) });
  }

  return json(res, 405, { ok: false, error: 'Method Not Allowed' });
}

