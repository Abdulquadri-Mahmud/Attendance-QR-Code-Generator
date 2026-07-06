const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect } = require('../middleware/auth.middleware');
const { allowRoles } = require('../middleware/role.middleware');

// GET /api/admin/users — List all users with optional role/department filter
router.get('/users', protect, allowRoles('admin'), async (req, res) => {
  try {
    const filter = {};
    if (req.query.role) filter.role = req.query.role;
    if (req.query.department) filter.department = { $regex: req.query.department, $options: 'i' };
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';

    const users = await User.find(filter)
      .select('-passwordHash')
      .sort({ role: 1, fullName: 1 });

    res.json({ success: true, count: users.length, users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/admin/users — Create a single user
router.post('/users', protect, allowRoles('admin'), async (req, res) => {
  try {
    const { fullName, role, department, level, matricNumber, staffId, email, password } = req.body;

    if (!fullName || !role || !department) {
      return res.status(400).json({
        success: false,
        message: 'fullName, role, and department are required',
      });
    }

    if (role === 'student' && !matricNumber) {
      return res.status(400).json({ success: false, message: 'matricNumber is required for students' });
    }
    if ((role === 'lecturer' || role === 'admin') && !staffId) {
      return res.status(400).json({ success: false, message: 'staffId is required for lecturers and admins' });
    }

    // Default password: matric/staff ID (they should change on first use)
    const defaultPassword = password || matricNumber || staffId;

    const user = await User.create({
      fullName: fullName.trim(),
      role,
      department: department.trim(),
      level: level || (role === 'student' ? 'ND1' : 'STAFF'),
      matricNumber: matricNumber?.trim().toUpperCase() || undefined,
      staffId: staffId?.trim().toUpperCase() || undefined,
      email: email?.trim().toLowerCase() || undefined,
      passwordHash: defaultPassword, // pre-save hook hashes this
    });

    res.status(201).json({
      success: true,
      message: `${role.charAt(0).toUpperCase() + role.slice(1)} created successfully. Default password is their matric/staff ID.`,
      user: {
        id: user._id,
        fullName: user.fullName,
        role: user.role,
        department: user.department,
        matricNumber: user.matricNumber || null,
        staffId: user.staffId || null,
      },
    });
  } catch (err) {
    if (err.code === 11000) {
      const field = err.keyPattern?.matricNumber ? 'Matric number' : 'Staff ID';
      return res.status(409).json({ success: false, message: `${field} already exists in the system` });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/admin/users/bulk — Bulk create students from JSON array
// Body: { users: [{ fullName, matricNumber, department, level }] }
router.post('/users/bulk', protect, allowRoles('admin'), async (req, res) => {
  try {
    const { users } = req.body;

    if (!Array.isArray(users) || users.length === 0) {
      return res.status(400).json({ success: false, message: 'users array is required and must not be empty' });
    }

    const toInsert = users.map((u) => ({
      fullName: u.fullName?.trim(),
      role: 'student',
      department: u.department?.trim() || 'General',
      level: u.level || 'ND1',
      matricNumber: u.matricNumber?.trim().toUpperCase(),
      passwordHash: u.matricNumber?.trim(), // Default password = matric number
      isActive: true,
    }));

    // Filter out any entries missing required fields
    const valid = toInsert.filter((u) => u.fullName && u.matricNumber);

    if (valid.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid student entries found. Each must have fullName and matricNumber.' });
    }

    // Hash passwords manually for bulk insert (pre-save hook doesn't run on insertMany)
    const bcrypt = require('bcryptjs');
    const hashed = await Promise.all(
      valid.map(async (u) => ({
        ...u,
        passwordHash: await bcrypt.hash(u.passwordHash, 12),
      }))
    );

    const result = await User.insertMany(hashed, { ordered: false });

    res.status(201).json({
      success: true,
      inserted: result.length,
      message: `${result.length} of ${users.length} students created successfully`,
    });
  } catch (err) {
    // ordered: false means some inserts succeeded even if some are duplicates
    if (err.name === 'BulkWriteError' || err.code === 11000) {
      const inserted = err.result?.nInserted || 0;
      return res.status(207).json({
        success: true,
        message: `Partial success: ${inserted} students created. Duplicates were skipped.`,
        inserted,
      });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/admin/users/:id/toggle — Toggle user active/inactive
router.patch('/users/:id/toggle', protect, allowRoles('admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-passwordHash');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.isActive = !user.isActive;
    await user.save({ validateBeforeSave: false });

    res.json({
      success: true,
      message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
      user,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/admin/users/:id — Update user details
router.put('/users/:id', protect, allowRoles('admin'), async (req, res) => {
  try {
    const { fullName, role, department, level, email, matricNumber, staffId } = req.body;
    
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (fullName !== undefined) user.fullName = fullName.trim();
    if (role !== undefined) user.role = role;
    if (department !== undefined) user.department = department.trim();
    if (level !== undefined) user.level = level;
    if (email !== undefined) user.email = email ? email.trim().toLowerCase() : undefined;

    // Apply role-based ID fields and clear the other
    const currentRole = role || user.role;
    if (currentRole === 'student') {
      if (matricNumber !== undefined) {
        if (!matricNumber.trim()) {
          return res.status(400).json({ success: false, message: 'Matric number is required for students' });
        }
        user.matricNumber = matricNumber.trim().toUpperCase();
      }
      user.staffId = undefined; // clear staff ID for students
    } else {
      if (staffId !== undefined) {
        if (!staffId.trim()) {
          return res.status(400).json({ success: false, message: 'Staff ID is required for lecturers/admins' });
        }
        user.staffId = staffId.trim().toUpperCase();
      }
      user.matricNumber = undefined; // clear matric number for lecturers/admins
    }

    await user.save();

    // Remove passwordHash from response
    const updatedUser = user.toJSON();

    res.json({ success: true, message: 'User updated successfully', user: updatedUser });
  } catch (err) {
    if (err.code === 11000) {
      const field = err.keyPattern?.matricNumber ? 'Matric number' : 'Staff ID';
      return res.status(409).json({ success: false, message: `${field} already exists in the system` });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/admin/users/:id — Delete user (use with caution)
router.delete('/users/:id', protect, allowRoles('admin'), async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, message: `User ${user.fullName} deleted` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
