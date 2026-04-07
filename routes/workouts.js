const express = require('express');
const router = express.Router();
const {
  startWorkout, getWorkouts, getActiveWorkout, getWorkout,
  logSet, editSet, deleteSet, completeWorkout, deleteWorkout, startFromTemplate,
} = require('../controllers/workoutController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/active', getActiveWorkout);
router.get('/previous-best', require('../controllers/workoutController').getPreviousBest);
router.get('/', getWorkouts);
router.post('/', startWorkout);
router.post('/from-template/:templateId', startFromTemplate);
router.get('/:id', getWorkout);
router.delete('/:id', deleteWorkout);
router.post('/:id/sets', logSet);
router.patch('/:id/sets/:setId', editSet);
router.delete('/:id/sets/:setId', deleteSet);
router.patch('/:id/complete', completeWorkout);

module.exports = router;
