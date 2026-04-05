const express = require('express');
const router = express.Router();
const { getExercises, getMuscleGroups, createExercise } = require('../controllers/exerciseController');
const { protect } = require('../middleware/auth');

router.get('/muscle-groups', getMuscleGroups);
router.get('/default', async (req, res) => {
  // Public endpoint — only returns built-in exercises (no custom), used for ISR
  const pool = require('../db/connection');
  const result = await pool.query(
    `SELECT id, name, muscle_group FROM exercises WHERE is_custom = false ORDER BY muscle_group, name`
  );
  res.json({ exercises: result.rows });
});
router.get('/', protect, getExercises);
router.post('/', protect, createExercise);

module.exports = router;
