const express = require('express');
const router = express.Router();
const { getGoal, setGoal } = require('../controllers/goalsController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/', getGoal);
router.post('/', setGoal);

module.exports = router;
