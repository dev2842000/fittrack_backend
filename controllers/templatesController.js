const pool = require('../db/connection');

// GET /api/templates
const getTemplates = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.id, t.name, t.created_at,
        COUNT(te.id)::int AS exercise_count,
        COALESCE(array_agg(e.name ORDER BY te.order_index) FILTER (WHERE e.name IS NOT NULL), '{}') AS exercise_names
      FROM workout_templates t
      LEFT JOIN template_exercises te ON te.template_id = t.id
      LEFT JOIN exercises e ON e.id = te.exercise_id
      WHERE t.user_id = $1
      GROUP BY t.id
      ORDER BY t.created_at DESC
    `, [req.user.id]);
    res.json({ templates: result.rows });
  } catch (err) {
    console.error('Get templates error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/templates/:id/exercises
const getTemplateExercises = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT te.exercise_id, e.name AS exercise_name, e.muscle_group, te.order_index
      FROM template_exercises te
      JOIN exercises e ON e.id = te.exercise_id
      WHERE te.template_id = $1
      ORDER BY te.order_index
    `, [req.params.id]);
    res.json({ exercises: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/templates  { name, exercise_ids: [1,2,3] }
const createTemplate = async (req, res) => {
  const { name, exercise_ids } = req.body;
  if (!name || !exercise_ids?.length)
    return res.status(400).json({ error: 'name and exercise_ids are required' });
  try {
    const t = await pool.query(
      'INSERT INTO workout_templates (user_id, name) VALUES ($1, $2) RETURNING *',
      [req.user.id, name]
    );
    const templateId = t.rows[0].id;
    for (let i = 0; i < exercise_ids.length; i++) {
      await pool.query(
        'INSERT INTO template_exercises (template_id, exercise_id, order_index) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [templateId, exercise_ids[i], i]
      );
    }
    res.status(201).json({ template: t.rows[0] });
  } catch (err) {
    console.error('Create template error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/templates/from-workout/:workoutId  { name }
const saveWorkoutAsTemplate = async (req, res) => {
  const { name } = req.body;
  const { workoutId } = req.params;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    // Verify workout belongs to user
    const wRes = await pool.query('SELECT id FROM workouts WHERE id = $1 AND user_id = $2', [workoutId, req.user.id]);
    if (!wRes.rows[0]) return res.status(404).json({ error: 'Workout not found' });

    // Get distinct exercises ordered by first logged set
    const exercises = await pool.query(`
      SELECT exercise_id, MIN(logged_at) AS first_logged
      FROM sets WHERE workout_id = $1
      GROUP BY exercise_id
      ORDER BY first_logged
    `, [workoutId]);

    const t = await pool.query(
      'INSERT INTO workout_templates (user_id, name) VALUES ($1, $2) RETURNING *',
      [req.user.id, name]
    );
    const templateId = t.rows[0].id;
    for (let i = 0; i < exercises.rows.length; i++) {
      await pool.query(
        'INSERT INTO template_exercises (template_id, exercise_id, order_index) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [templateId, exercises.rows[i].exercise_id, i]
      );
    }
    res.status(201).json({ template: t.rows[0] });
  } catch (err) {
    console.error('Save workout as template error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

// DELETE /api/templates/:id
const deleteTemplate = async (req, res) => {
  try {
    await pool.query('DELETE FROM workout_templates WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = { getTemplates, getTemplateExercises, createTemplate, saveWorkoutAsTemplate, deleteTemplate };
