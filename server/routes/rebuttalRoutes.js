const express = require('express');
const router = express.Router();
const rebuttalController = require('../controllers/rebuttalController');

router.get('/', rebuttalController.getAll);
router.post('/', rebuttalController.create);
router.put('/:id', rebuttalController.update);
router.delete('/:id', rebuttalController.delete);
router.post('/:id/push-live', rebuttalController.pushLive);

module.exports = router;
