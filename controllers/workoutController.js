const pool = require('../db/connection');
const { createNotification } = require('./notificationsController');
const { sendPushToUser } = require('../lib/pushService');

// POST /api/workouts — start a new workout
const startWorkout = async (req, res) => {
  const { name } = req.body;
  try {
    const existing = await pool.query(
      `SELECT id FROM workouts WHERE user_id = $1 AND completed_at IS NULL LIMIT 1`,
      [req.user.id]
    );
    if (existing.rows[0]) {
      return res.status(409).json({ error: 'You already have an active workout. Finish or discard it first.' });
    }
    const result = await pool.query(
      `INSERT INTO workouts (user_id, name) VALUES ($1, $2) RETURNING *`,
      [req.user.id, name || null]
    );
    res.status(201).json({ workout: result.rows[0] });
  } catch (err) {
    console.error('Start workout error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/workouts — workout history
const getWorkouts = async (req, res) => {
  try {
    // Auto-complete abandoned workouts (started >3h ago, has sets, still incomplete)
    await pool.query(
      `UPDATE workouts SET completed_at = started_at + INTERVAL '1 hour'
       WHERE user_id = $1
         AND completed_at IS NULL
         AND started_at < NOW() - INTERVAL '3 hours'
         AND id IN (SELECT DISTINCT workout_id FROM sets WHERE workout_id = workouts.id)`,
      [req.user.id]
    );
    // Silently discard abandoned workouts with no sets
    await pool.query(
      `DELETE FROM workouts
       WHERE user_id = $1
         AND completed_at IS NULL
         AND started_at < NOW() - INTERVAL '3 hours'
         AND id NOT IN (SELECT DISTINCT workout_id FROM sets)`,
      [req.user.id]
    );

    const result = await pool.query(
      `SELECT w.*,
        COUNT(DISTINCT s.exercise_id) AS exercise_count,
        COUNT(s.id) AS set_count
       FROM workouts w
       LEFT JOIN sets s ON s.workout_id = w.id
       WHERE w.user_id = $1 AND w.completed_at IS NOT NULL
       GROUP BY w.id
       ORDER BY w.started_at DESC
       LIMIT 50`,
      [req.user.id]
    );
    res.json({ workouts: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/workouts/active — get any in-progress workout
const getActiveWorkout = async (req, res) => {
  try {
    const workoutResult = await pool.query(
      `SELECT * FROM workouts WHERE user_id = $1 AND completed_at IS NULL ORDER BY started_at DESC LIMIT 1`,
      [req.user.id]
    );
    if (!workoutResult.rows[0]) return res.json({ workout: null });

    const workout = workoutResult.rows[0];
    const setsResult = await pool.query(
      `SELECT s.*, e.name AS exercise_name, e.muscle_group
       FROM sets s
       JOIN exercises e ON e.id = s.exercise_id
       WHERE s.workout_id = $1
       ORDER BY s.logged_at`,
      [workout.id]
    );

    // Group sets by exercise
    const exerciseMap = {};
    for (const row of setsResult.rows) {
      if (!exerciseMap[row.exercise_id]) {
        exerciseMap[row.exercise_id] = {
          exercise_id: row.exercise_id,
          exercise_name: row.exercise_name,
          muscle_group: row.muscle_group,
          sets: [],
        };
      }
      exerciseMap[row.exercise_id].sets.push({
        id: row.id,
        set_number: row.set_number,
        weight_kg: row.weight_kg,
        reps: row.reps,
      });
    }

    const exercises = Object.values(exerciseMap);

    // Fetch previous best (last session weight+reps) for each exercise
    const exerciseIds = exercises.map(e => e.exercise_id);
    let previousBest = {};
    if (exerciseIds.length > 0) {
      const pbRes = await pool.query(
        `SELECT DISTINCT ON (s.exercise_id)
           s.exercise_id, s.weight_kg, s.reps
         FROM sets s
         JOIN workouts w ON w.id = s.workout_id
         WHERE s.exercise_id = ANY($1)
           AND w.user_id = $2
           AND w.completed_at IS NOT NULL
           AND s.workout_id != $3
         ORDER BY s.exercise_id, w.completed_at DESC, s.set_number DESC`,
        [exerciseIds, req.user.id, workout.id]
      );
      for (const row of pbRes.rows) {
        previousBest[row.exercise_id] = { weight_kg: row.weight_kg, reps: row.reps };
      }
    }

    res.json({ workout: { ...workout, exercises }, previousBest });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/workouts/:id
const getWorkout = async (req, res) => {
  try {
    const workoutResult = await pool.query(
      `SELECT * FROM workouts WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (!workoutResult.rows[0]) return res.status(404).json({ error: 'Workout not found' });

    const workout = workoutResult.rows[0];
    const setsResult = await pool.query(
      `SELECT s.*, e.name AS exercise_name, e.muscle_group
       FROM sets s
       JOIN exercises e ON e.id = s.exercise_id
       WHERE s.workout_id = $1
       ORDER BY s.logged_at`,
      [workout.id]
    );

    const exerciseMap = {};
    for (const row of setsResult.rows) {
      if (!exerciseMap[row.exercise_id]) {
        exerciseMap[row.exercise_id] = {
          exercise_id: row.exercise_id,
          exercise_name: row.exercise_name,
          muscle_group: row.muscle_group,
          sets: [],
        };
      }
      exerciseMap[row.exercise_id].sets.push({
        id: row.id,
        set_number: row.set_number,
        weight_kg: row.weight_kg,
        reps: row.reps,
      });
    }

    res.json({ workout: { ...workout, exercises: Object.values(exerciseMap) } });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/workouts/:id/sets — log a set
const logSet = async (req, res) => {
  const { exercise_id, weight_kg, reps } = req.body;

  if (!exercise_id || !reps) {
    return res.status(400).json({ error: 'exercise_id and reps are required' });
  }

  try {
    // Verify workout belongs to user and is not completed
    const workoutResult = await pool.query(
      `SELECT * FROM workouts WHERE id = $1 AND user_id = $2 AND completed_at IS NULL`,
      [req.params.id, req.user.id]
    );
    if (!workoutResult.rows[0]) {
      return res.status(404).json({ error: 'Active workout not found' });
    }

    // Get next set number for this exercise in this workout
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM sets WHERE workout_id = $1 AND exercise_id = $2`,
      [req.params.id, exercise_id]
    );
    const setNumber = parseInt(countResult.rows[0].count) + 1;

    const result = await pool.query(
      `INSERT INTO sets (workout_id, exercise_id, set_number, weight_kg, reps)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.params.id, exercise_id, setNumber, weight_kg || null, reps]
    );

    res.status(201).json({ set: result.rows[0] });
  } catch (err) {
    console.error('Log set error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

// PATCH /api/workouts/:id/sets/:setId — edit a set inline
const editSet = async (req, res) => {
  const { weight_kg, reps } = req.body;
  if (!reps) return res.status(400).json({ error: 'reps is required' });
  try {
    const result = await pool.query(
      `UPDATE sets SET weight_kg=$1, reps=$2
       WHERE id=$3 AND workout_id IN (SELECT id FROM workouts WHERE user_id=$4)
       RETURNING *`,
      [weight_kg ?? null, reps, req.params.setId, req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Set not found' });
    res.json({ set: result.rows[0] });
  } catch (err) {
    console.error('Edit set error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

// DELETE /api/workouts/:id/sets/:setId — remove a set
const deleteSet = async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM sets
       WHERE id = $1
         AND workout_id IN (SELECT id FROM workouts WHERE user_id = $2)
       RETURNING id`,
      [req.params.setId, req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Set not found' });
    res.json({ message: 'Set deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// PATCH /api/workouts/:id/complete
const completeWorkout = async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE workouts SET completed_at = NOW()
       WHERE id = $1 AND user_id = $2 AND completed_at IS NULL
       RETURNING *`,
      [req.params.id, req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Active workout not found' });
    res.json({ workout: result.rows[0] });

    // Fire-and-forget post-completion checks
    const userId = req.user.id;
    checkAndNotify(userId).catch(err => console.error('checkAndNotify error:', err.message));
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

async function checkAndNotify(userId) {
  // --- Streak check ---
  const streakRes = await pool.query(
    `WITH dates AS (
       SELECT DISTINCT DATE(completed_at) AS d
       FROM workouts WHERE user_id = $1 AND completed_at IS NOT NULL
       ORDER BY d DESC
     ),
     numbered AS (
       SELECT d, d - (ROW_NUMBER() OVER (ORDER BY d))::int AS grp FROM dates
     )
     SELECT COUNT(*) AS len FROM numbered
     WHERE grp = (SELECT grp FROM numbered ORDER BY d DESC LIMIT 1)`,
    [userId]
  );
  const streak = parseInt(streakRes.rows[0]?.len || 0);
  const milestones = [3, 7, 14, 30, 50, 100];
  if (milestones.includes(streak)) {
    const msg = `You've worked out ${streak} days in a row. Keep it up!`;
    await createNotification(userId, 'STREAK', `${streak}-Day Streak! 🔥`, msg);
    await sendPushToUser(userId, `${streak}-Day Streak! 🔥`, msg);
  }

  // --- Weekly goal check ---
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  monday.setHours(0, 0, 0, 0);

  const [goalRes, weekRes] = await Promise.all([
    pool.query('SELECT weekly_workouts FROM user_goals WHERE user_id = $1', [userId]),
    pool.query(
      `SELECT COUNT(*) AS count FROM workouts
       WHERE user_id = $1 AND completed_at IS NOT NULL AND completed_at >= $2`,
      [userId, monday.toISOString()]
    ),
  ]);

  if (goalRes.rows[0]) {
    const target = parseInt(goalRes.rows[0].weekly_workouts);
    const done = parseInt(weekRes.rows[0].count);
    if (done === target) {
      const msg = `You've hit your goal of ${target} workout${target > 1 ? 's' : ''} this week!`;
      await createNotification(userId, 'GOAL', 'Weekly Goal Reached! 🎯', msg);
      await sendPushToUser(userId, 'Weekly Goal Reached! 🎯', msg);
    }
  }
}

// GET /api/workouts/previous-best?exerciseIds=1,2,3
const getPreviousBest = async (req, res) => {
  try {
    const ids = (req.query.exerciseIds || '').split(',').map(Number).filter(Boolean);
    if (!ids.length) return res.json({ previousBest: {} });

    const pbRes = await pool.query(
      `SELECT DISTINCT ON (s.exercise_id)
         s.exercise_id, s.weight_kg, s.reps
       FROM sets s
       JOIN workouts w ON w.id = s.workout_id
       WHERE s.exercise_id = ANY($1)
         AND w.user_id = $2
         AND w.completed_at IS NOT NULL
       ORDER BY s.exercise_id, w.completed_at DESC, s.set_number DESC`,
      [ids, req.user.id]
    );

    const previousBest = {};
    for (const row of pbRes.rows) {
      previousBest[row.exercise_id] = { weight_kg: row.weight_kg, reps: row.reps };
    }
    res.json({ previousBest });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// DELETE /api/workouts/:id — discard a workout
const deleteWorkout = async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM workouts WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    res.json({ message: 'Workout deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/workouts/from-template/:templateId
const startFromTemplate = async (req, res) => {
  const { templateId } = req.params;
  try {
    const existing = await pool.query(
      `SELECT id FROM workouts WHERE user_id = $1 AND completed_at IS NULL LIMIT 1`,
      [req.user.id]
    );
    if (existing.rows[0]) {
      return res.status(409).json({ error: 'You already have an active workout. Finish or discard it first.' });
    }
    const tmpl = await pool.query(
      'SELECT * FROM workout_templates WHERE id = $1 AND user_id = $2',
      [templateId, req.user.id]
    );
    if (!tmpl.rows[0]) return res.status(404).json({ error: 'Template not found' });

    const workout = await pool.query(
      'INSERT INTO workouts (user_id, name) VALUES ($1, $2) RETURNING *',
      [req.user.id, req.body?.name || tmpl.rows[0].name]
    );

    const exercises = await pool.query(
      `SELECT te.exercise_id, e.name AS exercise_name, e.muscle_group
       FROM template_exercises te
       JOIN exercises e ON e.id = te.exercise_id
       WHERE te.template_id = $1
       ORDER BY te.order_index`,
      [templateId]
    );

    res.status(201).json({ workout: { ...workout.rows[0], exercises: [] }, templateExercises: exercises.rows });
  } catch (err) {
    console.error('Start from template error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = { startWorkout, getWorkouts, getActiveWorkout, getWorkout, logSet, editSet, deleteSet, completeWorkout, deleteWorkout, startFromTemplate, getPreviousBest };
