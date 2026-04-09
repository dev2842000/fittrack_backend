const express = require('express');
const router = express.Router();
const { logMeasurements, getMeasurements } = require('../controllers/measurementsController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.post('/', logMeasurements);
router.get('/', getMeasurements);

module.exports = router;
