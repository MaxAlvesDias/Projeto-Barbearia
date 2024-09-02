const express = require('express');
const router = express.Router();
const { getAllAgenda } = require('../routes/agendamento.routes')

router.post('/', getAllAgenda);

module.exports = router;
