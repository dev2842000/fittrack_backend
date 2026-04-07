const pool = require('../db/connection');

// GET /api/progress/summary — dashboard stats
const getSummary = async (req, res) => {
  try {
    const [workoutsRes, volumeRes, prsRes] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) AS total_workouts,
                COALESCE(SUM(EXTRACT(EPOCH FROM (completed_at - started_at))/60), 0)::int AS total_minutes
         FROM workouts WHERE user_id = $1 AND completed_at IS NOT NULL`,
        [req.user.id]
      ),
      pool.query(
        `SELECT COALESCE(SUM(s.weight_kg * s.reps), 0) AS total_volume
         FROM sets s
         JOIN workouts w ON w.id = s.workout_id
         WHERE w.user_id = $1 AND w.completed_at IS NOT NULL`,
        [req.user.id]
      ),
      pool.query(
        `SELECT e.name AS exercise_name, MAX(s.weight_kg) AS max_weight
         FROM sets s
         JOIN workouts w ON w.id = s.workout_id
         JOIN exercises e ON e.id = s.exercise_id
         WHERE w.user_id = $1 AND w.completed_at IS NOT NULL AND s.weight_kg IS NOT NULL
         GROUP BY e.id, e.name
         ORDER BY max_weight DESC
         LIMIT 5`,
        [req.user.id]
      ),
    ]);

    res.json({
      totalWorkouts: parseInt(workoutsRes.rows[0].total_workouts),
      totalMinutes: parseInt(workoutsRes.rows[0].total_minutes),
      totalVolume: parseFloat(volumeRes.rows[0].total_volume),
      topLifts: prsRes.rows,
    });
  } catch (err) {
    console.error('Summary error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/progress/exercises — exercises the user has actually logged
const getLoggedExercises = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT e.id, e.name, e.muscle_group
       FROM sets s
       JOIN workouts w ON w.id = s.workout_id
       JOIN exercises e ON e.id = s.exercise_id
       WHERE w.user_id = $1 AND w.completed_at IS NOT NULL
       ORDER BY e.name`,
      [req.user.id]
    );
    res.json({ exercises: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/progress/exercise/:id — per-exercise progress
const getExerciseProgress = async (req, res) => {
  try {
    // Max weight per workout session
    const maxWeightRes = await pool.query(
      `SELECT DATE(w.completed_at) AS date,
              MAX(s.weight_kg) AS max_weight,
              SUM(s.weight_kg * s.reps) AS volume,
              COUNT(s.id) AS sets
       FROM sets s
       JOIN workouts w ON w.id = s.workout_id
       WHERE w.user_id = $1 AND w.completed_at IS NOT NULL
         AND s.exercise_id = $2 AND s.weight_kg IS NOT NULL
       GROUP BY DATE(w.completed_at), w.id
       ORDER BY date ASC`,
      [req.user.id, req.params.id]
    );

    // All-time PR
    const prRes = await pool.query(
      `SELECT MAX(s.weight_kg) AS pr_weight, MAX(s.reps) AS pr_reps
       FROM sets s
       JOIN workouts w ON w.id = s.workout_id
       WHERE w.user_id = $1 AND w.completed_at IS NOT NULL AND s.exercise_id = $2`,
      [req.user.id, req.params.id]
    );

    const data = maxWeightRes.rows.map(row => ({
      date: row.date,
      maxWeight: parseFloat(row.max_weight) || 0,
      volume: parseFloat(row.volume) || 0,
      sets: parseInt(row.sets),
    }));

    // Mark PRs — a point is a PR if its max_weight is the highest seen so far
    let runningMax = 0;
    const dataWithPR = data.map(point => {
      const isPR = point.maxWeight > runningMax;
      if (isPR) runningMax = point.maxWeight;
      return { ...point, isPR };
    });

    res.json({
      data: dataWithPR,
      pr: {
        weight: parseFloat(prRes.rows[0]?.pr_weight) || null,
        reps: parseInt(prRes.rows[0]?.pr_reps) || null,
      },
    });
  } catch (err) {
    console.error('Exercise progress error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/progress/prs — all personal records
const getAllPRs = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.name AS exercise_name, e.muscle_group,
              MAX(s.weight_kg) AS max_weight,
              (SELECT s2.reps FROM sets s2
               JOIN workouts w2 ON w2.id = s2.workout_id
               WHERE w2.user_id = $1 AND s2.exercise_id = e.id
                 AND s2.weight_kg = MAX(s.weight_kg)
               ORDER BY w2.completed_at DESC LIMIT 1) AS reps_at_max,
              MAX(w.completed_at) AS last_logged
       FROM sets s
       JOIN workouts w ON w.id = s.workout_id
       JOIN exercises e ON e.id = s.exercise_id
       WHERE w.user_id = $1 AND w.completed_at IS NOT NULL AND s.weight_kg IS NOT NULL
       GROUP BY e.id, e.name, e.muscle_group
       ORDER BY max_weight DESC`,
      [req.user.id]
    );
    res.json({ prs: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/progress/bodyweight
const logBodyweight = async (req, res) => {
  const { weight_kg, date } = req.body;
  if (!weight_kg) return res.status(400).json({ error: 'weight_kg is required' });

  try {
    const result = await pool.query(
      `INSERT INTO bodyweight_log (user_id, weight_kg, logged_date)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, logged_date)
       DO UPDATE SET weight_kg = EXCLUDED.weight_kg
       RETURNING *`,
      [req.user.id, weight_kg, date || new Date().toISOString().split('T')[0]]
    );
    res.status(201).json({ entry: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/progress/bodyweight
const getBodyweight = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT weight_kg, logged_date AS date
       FROM bodyweight_log WHERE user_id = $1
       ORDER BY logged_date ASC`,
      [req.user.id]
    );
    res.json({ entries: result.rows.map(r => ({ ...r, weight_kg: parseFloat(r.weight_kg) })) });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/progress/months-summary?year=2026
const getMonthsSummary = async (req, res) => {
  const year = parseInt(req.query.year) || new Date().getFullYear();
  try {
    const result = await pool.query(
      `SELECT
         EXTRACT(MONTH FROM completed_at)::int AS month,
         COUNT(DISTINCT w.id) AS workout_count,
         COALESCE(SUM(s.weight_kg * s.reps), 0) AS volume
       FROM workouts w
       LEFT JOIN sets s ON s.workout_id = w.id
       WHERE w.user_id = $1
         AND w.completed_at IS NOT NULL
         AND EXTRACT(YEAR FROM w.completed_at) = $2
       GROUP BY month
       ORDER BY month`,
      [req.user.id, year]
    );
    const map = {};
    result.rows.forEach(r => {
      map[r.month] = {
        workoutCount: parseInt(r.workout_count),
        volume: Math.round(parseFloat(r.volume)),
      };
    });
    res.json({ year, months: map });
  } catch (err) {
    console.error('Months summary error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/progress/monthly?year=2026&month=4
const getMonthly = async (req, res) => {
  const year  = parseInt(req.query.year)  || new Date().getFullYear();
  const month = parseInt(req.query.month) || new Date().getMonth() + 1;

  try {
    // One row per workout that month
    const workoutsRes = await pool.query(
      `SELECT
         w.id,
         DATE(w.completed_at) AS date,
         EXTRACT(EPOCH FROM (w.completed_at - w.started_at))/60 AS duration_min,
         COUNT(DISTINCT s.exercise_id) AS exercise_count,
         COUNT(s.id) AS set_count,
         COALESCE(SUM(s.weight_kg * s.reps), 0) AS volume
       FROM workouts w
       LEFT JOIN sets s ON s.workout_id = w.id
       WHERE w.user_id = $1
         AND w.completed_at IS NOT NULL
         AND EXTRACT(YEAR  FROM w.completed_at) = $2
         AND EXTRACT(MONTH FROM w.completed_at) = $3
       GROUP BY w.id
       ORDER BY w.completed_at ASC`,
      [req.user.id, year, month]
    );

    // Muscle group breakdown for the month
    const muscleRes = await pool.query(
      `SELECT e.muscle_group, COUNT(s.id) AS set_count
       FROM sets s
       JOIN workouts w ON w.id = s.workout_id
       JOIN exercises e ON e.id = s.exercise_id
       WHERE w.user_id = $1
         AND w.completed_at IS NOT NULL
         AND EXTRACT(YEAR  FROM w.completed_at) = $2
         AND EXTRACT(MONTH FROM w.completed_at) = $3
       GROUP BY e.muscle_group
       ORDER BY set_count DESC`,
      [req.user.id, year, month]
    );

    const workouts = workoutsRes.rows.map(r => ({
      id: r.id,
      date: r.date,
      durationMin: Math.round(parseFloat(r.duration_min) || 0),
      exerciseCount: parseInt(r.exercise_count),
      setCount: parseInt(r.set_count),
      volume: Math.round(parseFloat(r.volume)),
    }));

    const totalVolume  = workouts.reduce((a, w) => a + w.volume, 0);
    const totalSets    = workouts.reduce((a, w) => a + w.setCount, 0);
    const totalMinutes = workouts.reduce((a, w) => a + w.durationMin, 0);

    res.json({
      workouts,
      muscleBreakdown: muscleRes.rows.map(r => ({
        muscle_group: r.muscle_group,
        set_count: parseInt(r.set_count),
      })),
      summary: {
        totalWorkouts: workouts.length,
        totalVolume,
        totalSets,
        totalMinutes,
      },
    });
  } catch (err) {
    console.error('Monthly error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/progress/streaks
const getStreaks = async (req, res) => {
  try {
    const result = await pool.query(
      `WITH dates AS (
         SELECT DISTINCT DATE(completed_at) AS d
         FROM workouts WHERE user_id = $1 AND completed_at IS NOT NULL
         ORDER BY d DESC
       ),
       numbered AS (
         SELECT d, d - (ROW_NUMBER() OVER (ORDER BY d))::int AS grp FROM dates
       ),
       groups AS (
         SELECT grp, COUNT(*) AS len, MAX(d) AS last_day FROM numbered GROUP BY grp
       )
       SELECT
         COALESCE((SELECT len FROM groups ORDER BY last_day DESC LIMIT 1), 0) AS current_raw,
         COALESCE((SELECT last_day FROM groups ORDER BY last_day DESC LIMIT 1), NULL) AS last_workout,
         COALESCE(MAX(len), 0) AS longest
       FROM groups`,
      [req.user.id]
    );

    const row = result.rows[0];
    const lastWorkout = row.last_workout ? new Date(row.last_workout) : null;
    const today = new Date(); today.setHours(0,0,0,0);
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);

    // Streak is active only if last workout was today or yesterday
    let currentStreak = 0;
    if (lastWorkout) {
      const lwDate = new Date(lastWorkout); lwDate.setHours(0,0,0,0);
      if (lwDate >= yesterday) currentStreak = parseInt(row.current_raw);
    }

    res.json({ currentStreak, longestStreak: parseInt(row.longest) });
  } catch (err) {
    console.error('Streaks error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/progress/weekly-muscles
const getWeeklyMuscles = async (req, res) => {
  try {
    const now = new Date();
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    monday.setHours(0, 0, 0, 0);

    const result = await pool.query(
      `SELECT e.muscle_group, COUNT(DISTINCT s.workout_id)::int AS sessions
       FROM sets s
       JOIN exercises e ON e.id = s.exercise_id
       JOIN workouts w ON w.id = s.workout_id
       WHERE w.user_id = $1 AND w.completed_at >= $2
       GROUP BY e.muscle_group
       ORDER BY sessions DESC`,
      [req.user.id, monday.toISOString()]
    );

    res.json({ muscles: result.rows });
  } catch (err) {
    console.error('Weekly muscles error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = { getSummary, getLoggedExercises, getExerciseProgress, getAllPRs, logBodyweight, getBodyweight, getMonthly, getMonthsSummary, getStreaks, getWeeklyMuscles };
