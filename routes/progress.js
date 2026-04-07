const express = require('express');
const router = express.Router();
const {
  getSummary, getLoggedExercises, getExerciseProgress,
  getAllPRs, logBodyweight, getBodyweight, getMonthly, getMonthsSummary, getStreaks, getWeeklyMuscles,
} = require('../controllers/progressController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/summary', getSummary);
router.get('/exercises', getLoggedExercises);
router.get('/exercise/:id', getExerciseProgress);
router.get('/prs', getAllPRs);
router.post('/bodyweight', logBodyweight);
router.get('/bodyweight', getBodyweight);
router.get('/months-summary', getMonthsSummary);
router.get('/monthly', getMonthly);
router.get('/streaks', getStreaks);
router.get('/weekly-muscles', getWeeklyMuscles);

module.exports = router;
