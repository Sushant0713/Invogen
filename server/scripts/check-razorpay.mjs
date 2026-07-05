import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.env');
dotenv.config({ path: root, override: true });

const keyId = (process.env.RAZORPAY_KEY_ID || '').trim();
const keySecret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
const headers = { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' };

async function probe(label, url, init = {}) {
  const res = await fetch(url, { ...init, headers: { ...headers, ...init.headers } });
  const text = await res.text();
  console.log(label, res.status, text.slice(0, 150));
}

await probe('GET plans', 'https://api.razorpay.com/v1/plans?count=1');
await probe('POST plan', 'https://api.razorpay.com/v1/plans', {
  method: 'POST',
  body: JSON.stringify({
    period: 'monthly',
    interval: 1,
    item: { name: 'Diag Plan', amount: 10000, currency: 'INR' },
  }),
});
await probe('GET orders list', 'https://api.razorpay.com/v1/orders?count=1');
