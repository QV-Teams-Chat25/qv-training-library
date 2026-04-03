const express = require('express');
const router = express.Router();
const callProcessController = require('../controllers/callProcessController');

router.get('/', callProcessController.getAll);
router.post('/', callProcessController.create);
router.put('/:id', callProcessController.update);
router.delete('/:id', callProcessController.delete);
router.post('/:id/push-live', callProcessController.pushLive);

module.exports = router;
