const express = require('express');
const crypto = require('crypto');
const path = require('path');
const config = require('./config');

// Factory so each test gets a fresh, isolated in-memory store
function createApp() {
  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '..', 'public')));

  const customers = new Map();
  const startedAt = Date.now();
  let nextId = 1;

  const hashPassword = (pw) => {
    const salt = crypto.randomBytes(16).toString('hex');
    return `${salt}:${crypto.scryptSync(pw, salt, 32).toString('hex')}`;
  };
  const sessions = new Map(); // token -> customer id
  const verifyPassword = (pw, stored) => {
    const [salt, hash] = stored.split(':');
    return crypto.timingSafeEqual(crypto.scryptSync(pw, salt, 32), Buffer.from(hash, 'hex'));
  };
  const isAdmin = (c) => Boolean(config.adminEmail) && c.email === config.adminEmail;
  const auth = (req, res, next) => {
    const token = (req.headers.authorization || '').replace(/^Bearer /, '');
    const c = customers.get(sessions.get(token));
    if (!c) return res.status(401).json({ error: 'Authentication required' });
    req.customer = c;
    req.token = token;
    next();
  };
  const ownerOrAdmin = (req, res, next) => {
    if (req.customer.id !== Number(req.params.id) && !isAdmin(req.customer)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
  // Never expose the password hash
  const publicView = ({ passwordHash, ...c }) => c;
  const emailTaken = (email, exceptId) =>
    [...customers.values()].some((c) => c.email === email && c.id !== exceptId);

  function validate(b, { partial = false } = {}) {
    const errors = [];
    const has = (k) => b[k] !== undefined;
    if (!partial || has('name')) {
      if (typeof b.name !== 'string' || b.name.trim().length < 2) errors.push('name must be at least 2 characters');
    }
    if (!partial || has('email')) {
      if (typeof b.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)) errors.push('email is invalid');
    }
    if (!partial && (typeof b.password !== 'string' || b.password.length < 8)) {
      errors.push('password must be at least 8 characters');
    }
    if (has('phone') && !/^[0-9]{10}$/.test(String(b.phone))) errors.push('phone must be 10 digits');
    if (has('address') && typeof b.address !== 'string') errors.push('address must be a string');
    return errors;
  }

  app.get('/health', (_req, res) =>
    res.json({
      status: 'UP',
      app: config.appName,
      environment: config.nodeEnv,
      customers: customers.size,
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    })
  );

  // Register
  app.post('/api/customers/register', (req, res) => {
    const b = req.body || {};
    const errors = validate(b);
    if (errors.length) return res.status(400).json({ errors });
    const email = b.email.trim().toLowerCase();
    if (emailTaken(email)) return res.status(409).json({ error: 'Email already registered' });
    const customer = {
      id: nextId++,
      name: b.name.trim(),
      email,
      phone: b.phone ? String(b.phone) : '',
      address: b.address || '',
      passwordHash: hashPassword(b.password),
      registeredAt: new Date().toISOString(),
    };
    customers.set(customer.id, customer);
    res.status(201).json(publicView(customer));
  });

  // Login / logout / current customer
  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body || {};
    const c = [...customers.values()].find((x) => x.email === String(email || '').trim().toLowerCase());
    if (!c || typeof password !== 'string' || !verifyPassword(password, c.passwordHash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const token = crypto.randomBytes(24).toString('hex');
    sessions.set(token, c.id);
    res.json({ token, customer: { ...publicView(c), isAdmin: isAdmin(c) } });
  });
  app.post('/api/auth/logout', auth, (req, res) => {
    sessions.delete(req.token);
    res.status(204).send();
  });
  app.get('/api/me', auth, (req, res) => res.json({ ...publicView(req.customer), isAdmin: isAdmin(req.customer) }));

  // List (admin only)
  app.get('/api/customers', auth, (req, res) => {
    if (!isAdmin(req.customer)) return res.status(403).json({ error: 'Admin access required' });
    res.json([...customers.values()].map(publicView));
  });

  // Details
  app.get('/api/customers/:id', auth, ownerOrAdmin, (req, res) => {
    const c = customers.get(Number(req.params.id));
    if (!c) return res.status(404).json({ error: 'Customer not found' });
    res.json(publicView(c));
  });

  // Update details
  app.put('/api/customers/:id', auth, ownerOrAdmin, (req, res) => {
    const c = customers.get(Number(req.params.id));
    if (!c) return res.status(404).json({ error: 'Customer not found' });
    const b = req.body || {};
    const errors = validate(b, { partial: true });
    if (errors.length) return res.status(400).json({ errors });
    if (b.email !== undefined) {
      const email = b.email.trim().toLowerCase();
      if (emailTaken(email, c.id)) return res.status(409).json({ error: 'Email already registered' });
      c.email = email;
    }
    if (b.name !== undefined) c.name = b.name.trim();
    if (b.phone !== undefined) c.phone = String(b.phone);
    if (b.address !== undefined) c.address = b.address;
    res.json(publicView(c));
  });

  // Delete
  app.delete('/api/customers/:id', auth, ownerOrAdmin, (req, res) => {
    const id = Number(req.params.id);
    if (!customers.delete(id)) return res.status(404).json({ error: 'Customer not found' });
    for (const [t, cid] of sessions) if (cid === id) sessions.delete(t);
    res.status(204).send();
  });

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Route not found' }));
  app.use((err, _req, res, _next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });
  return app;
}

module.exports = { createApp };
