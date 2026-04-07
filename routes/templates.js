const express = require('express');
const router = express.Router();
const { getTemplates, getTemplateExercises, createTemplate, saveWorkoutAsTemplate, deleteTemplate } = require('../controllers/templatesController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/', getTemplates);
router.get('/:id/exercises', getTemplateExercises);
router.post('/', createTemplate);
router.post('/from-workout/:workoutId', saveWorkoutAsTemplate);
router.delete('/:id', deleteTemplate);

module.exports = router;
