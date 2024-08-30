const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const Agendamento = new Schema({
    salaoId: {
        type: mongoose.Types.ObjectId,
        ref: 'Salao',
        required: true,
    },
    colaboradorId: {
        type: mongoose.Types.ObjectId,
        ref: 'Colaborador',
        required: true,
    },
    servicoId: {
        type: mongoose.Types.ObjectId,
        ref: 'Servico',
        required: true,
    },
    clienteId: {
        type: mongoose.Types.ObjectId,
        ref: 'Cliente',
        required: true,
    },
    data:{
        type: Date,
        required: true,
    },
    comissao: {
        typre: Number,
        required: true,
    },
    valor: {
        typre: Number,
        required: true,
    },
    transactionId: {
        typre: String,
        required: true,
    },
    dataCadastro: {
        type: Date,
        default: Date.now,
    },
});


module.exports = mongoose.model('Agendamento', agendamento);