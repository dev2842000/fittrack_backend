const express = require('express');
const router = express.Router();
const { getExercises, getMuscleGroups, createExercise } = require('../controllers/exerciseController');
const { protect } = require('../middleware/auth');

router.get('/muscle-groups', getMuscleGroups);
router.get('/', protect, getExercises);
router.post('/', protect, createExercise);

module.exports = router;
