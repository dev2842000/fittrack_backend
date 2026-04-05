const pool = require('../db/connection');
const { sendWeeklySummary } = require('./mailer');

let cron;
try { cron = require('node-cron'); } catch { console.warn('node-cron not available'); }

const startWeeklyEmailJob = () => {
  if (!cron) return;

  // Every Monday at 9:00 AM
  cron.schedule('0 9 * * 1', async () => {
    console.log('[WeeklyEmail] Running job...');
    try {
      const usersRes = await pool.query(
        'SELECT id, name, email FROM users WHERE is_verified = TRUE'
      );

      const now = new Date();
      const lastMonday = new Date(now);
      lastMonday.setDate(now.getDate() - 7);
      lastMonday.setHours(0, 0, 0, 0);
      const thisMonday = new Date(now);
      thisMonday.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1));
      thisMonday.setHours(0, 0, 0, 0);

      for (const user of usersRes.rows) {
        const [workoutsRes, setsRes, prsRes] = await Promise.all([
          pool.query(
            `SELECT COUNT(*) AS count,
                    COALESCE(SUM(EXTRACT(EPOCH FROM (completed_at - started_at))/60),0)::int AS total_minutes
             FROM workouts
             WHERE user_id = $1 AND completed_at IS NOT NULL
               AND completed_at >= $2 AND completed_at < $3`,
            [user.id, lastMonday.toISOString(), thisMonday.toISOString()]
          ),
          pool.query(
            `SELECT COUNT(s.id) AS total_sets
             FROM sets s JOIN workouts w ON w.id = s.workout_id
             WHERE w.user_id = $1 AND w.completed_at IS NOT NULL
               AND w.completed_at >= $2 AND w.completed_at < $3`,
            [user.id, lastMonday.toISOString(), thisMonday.toISOString()]
          ),
          pool.query(
            `SELECT e.name, MAX(s.weight_kg) AS max_weight
             FROM sets s
             JOIN workouts w ON w.id = s.workout_id
             JOIN exercises e ON e.id = s.exercise_id
             WHERE w.user_id = $1 AND w.completed_at IS NOT NULL
               AND w.completed_at >= $2 AND w.completed_at < $3
               AND s.weight_kg IS NOT NULL
             GROUP BY e.id, e.name ORDER BY max_weight DESC LIMIT 3`,
            [user.id, lastMonday.toISOString(), thisMonday.toISOString()]
          ),
        ]);

        const workoutCount = parseInt(workoutsRes.rows[0].count);
        if (workoutCount === 0) continue;

        await sendWeeklySummary(user.email, user.name, {
          workoutCount,
          totalMinutes: parseInt(workoutsRes.rows[0].total_minutes),
          totalSets: parseInt(setsRes.rows[0].total_sets),
          topLifts: prsRes.rows,
        });

        console.log(`[WeeklyEmail] Sent to ${user.email}`);
      }
    } catch (err) {
      console.error('[WeeklyEmail] Error:', err.message);
    }
  });

  console.log('[WeeklyEmail] Cron job scheduled — every Monday 9 AM');
};

module.exports = { startWeeklyEmailJob };
