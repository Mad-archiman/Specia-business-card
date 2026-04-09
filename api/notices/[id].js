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

  const id = req.query?.id;
  if (!id || typeof id !== 'string') return json(res, 400, { ok: false, error: 'Invalid id' });

  let oid;
  try {
    oid = new ObjectId(id);
  } catch {
    return json(res, 400, { ok: false, error: 'Invalid id' });
  }

  const db = await getDb();
  const col = db.collection('notices');

  if (req.method === 'GET') {
    const doc = await col.findOne({ _id: oid });
    if (!doc) return json(res, 404, { ok: false, error: 'Not Found' });
    return json(res, 200, { ok: true, notice: toNoticeDoc(doc) });
  }

  let payload;
  try {
    payload = verifyJwt(req);
    requireAdmin(payload);
  } catch (e) {
    return json(res, e.statusCode || 401, { ok: false, error: e.message || 'Unauthorized' });
  }

  if (req.method === 'PUT' || req.method === 'PATCH') {
    let body;
    try {
      body = await readBody(req);
    } catch {
      return json(res, 400, { ok: false, error: 'Invalid JSON' });
    }

    const updates = {};
    if (body?.title != null) updates.title = String(body.title).trim();
    if (body?.date != null) updates.date = String(body.date).trim();
    if (body?.body != null) updates.body = String(body.body);

    if (Object.keys(updates).length === 0) {
      return json(res, 400, { ok: false, error: '업데이트할 내용이 없습니다.' });
    }

    updates.updatedAt = new Date();
    updates.updatedBy = payload.email || null;

    await col.updateOne({ _id: oid }, { $set: updates });
    const doc = await col.findOne({ _id: oid });
    if (!doc) return json(res, 404, { ok: false, error: 'Not Found' });
    return json(res, 200, { ok: true, notice: toNoticeDoc(doc) });
  }

  if (req.method === 'DELETE') {
    const result = await col.deleteOne({ _id: oid });
    if (!result.deletedCount) return json(res, 404, { ok: false, error: 'Not Found' });
    return json(res, 200, { ok: true });
  }

  return json(res, 405, { ok: false, error: 'Method Not Allowed' });
}

