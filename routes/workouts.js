const express = require('express');
const router = express.Router();
const {
  startWorkout, getWorkouts, getActiveWorkout, getWorkout,
  logSet, deleteSet, completeWorkout, deleteWorkout,
} = require('../controllers/workoutController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/active', getActiveWorkout);
router.get('/', getWorkouts);
router.post('/', startWorkout);
router.get('/:id', getWorkout);
router.delete('/:id', deleteWorkout);
router.post('/:id/sets', logSet);
router.delete('/:id/sets/:setId', deleteSet);
router.patch('/:id/complete', completeWorkout);

module.exports = router;
