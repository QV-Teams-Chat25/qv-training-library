const express = require('express');
const router = express.Router();
const transitionController = require('../controllers/transitionController');

router.get('/', transitionController.getAll);
router.post('/', transitionController.create);
router.put('/:id', transitionController.update);
router.delete('/:id', transitionController.delete);
router.post('/:id/push-live', transitionController.pushLive);

module.exports = router;
