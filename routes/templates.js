const express = require('express');
const router = express.Router();
const { getTemplates, getTemplateExercises, createTemplate, saveWorkoutAsTemplate, updateTemplate, duplicateTemplate, deleteTemplate } = require('../controllers/templatesController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/', getTemplates);
router.get('/:id/exercises', getTemplateExercises);
router.post('/', createTemplate);
router.post('/from-workout/:workoutId', saveWorkoutAsTemplate);
router.put('/:id', updateTemplate);
router.post('/:id/duplicate', duplicateTemplate);
router.delete('/:id', deleteTemplate);

module.exports = router;
