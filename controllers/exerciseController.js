const pool = require('../db/connection');

// GET /api/exercises?muscle_group=Chest&search=press
const getExercises = async (req, res) => {
  const { muscle_group, search } = req.query;

  let query = 'SELECT * FROM exercises WHERE (is_custom = FALSE OR created_by = $1)';
  const params = [req.user?.id || null];
  let idx = 2;

  if (muscle_group) {
    query += ` AND muscle_group = $${idx++}`;
    params.push(muscle_group);
  }
  if (search) {
    query += ` AND name ILIKE $${idx++}`;
    params.push(`%${search}%`);
  }

  query += ' ORDER BY muscle_group, name';

  try {
    const result = await pool.query(query, params);
    res.json({ exercises: result.rows });
  } catch (err) {
    console.error('Get exercises error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/exercises/muscle-groups
const getMuscleGroups = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT DISTINCT muscle_group FROM exercises ORDER BY muscle_group'
    );
    res.json({ muscleGroups: result.rows.map(r => r.muscle_group) });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/exercises  (protected)
const createExercise = async (req, res) => {
  const { name, muscle_group } = req.body;

  if (!name || !muscle_group)
    return res.status(400).json({ error: 'Name and muscle group are required' });

  try {
    const result = await pool.query(
      `INSERT INTO exercises (name, muscle_group, is_custom, created_by)
       VALUES ($1, $2, TRUE, $3)
       RETURNING *`,
      [name.trim(), muscle_group.trim(), req.user.id]
    );
    res.status(201).json({ exercise: result.rows[0] });
  } catch (err) {
    console.error('Create exercise error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = { getExercises, getMuscleGroups, createExercise };
