import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../config/db.js';
import auth from '../middleware/auth.js';

const router = Router();

// GET /api/users/profile
router.get('/profile', auth, (req, res) => {
  try {
    const user = db.prepare('SELECT id, firstName, lastName, email, avatar, createdAt FROM users WHERE id = ?').get(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/users/profile
router.put('/profile', auth, async (req, res) => {
  try {
    const { firstName, lastName, email, avatar, currentPassword, newPassword } = req.body;

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if email is being changed and if it's already taken
    if (email && email !== user.email) {
      const existing = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, req.user.id);
      if (existing) {
        return res.status(400).json({ message: 'Email already in use' });
      }
    }

    // Handle password change
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ message: 'Current password is required to set a new password' });
      }
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Current password is incorrect' });
      }
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);
      db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, req.user.id);
    }

    db.prepare(
      'UPDATE users SET firstName = ?, lastName = ?, email = ?, avatar = ? WHERE id = ?'
    ).run(
      firstName || user.firstName,
      lastName || user.lastName,
      email || user.email,
      avatar !== undefined ? avatar : user.avatar,
      req.user.id
    );

    const updated = db.prepare('SELECT id, firstName, lastName, email, avatar, createdAt FROM users WHERE id = ?').get(req.user.id);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/users/:id (public profile)
router.get('/:id', (req, res) => {
  try {
    const user = db.prepare('SELECT id, firstName, lastName, avatar, createdAt FROM users WHERE id = ?').get(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
