const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const moment = require('moment');
const pagarme = require('../services/pagarme');
const _ = require('lodash');
const Cliente = require('../models/cliente');
const Salao = require('../models/salao');
const Servico = require('../models/servico');
const Colaborador = require('../models/colaborador');
const Agendamento = require('../models/agendamento');
const Horario = require('../models/horario');
const util = require('../util');
const key = require('../data/keys.json');


// const getAllAgenda = async (req, res) => {}

router.post('/', async (req, res) => {
    const db = mongoose.connection;
    const session = await db.startSession();
    session.startTransaction();
    try{
        const {clienteId, salaoId, servicoId, colaboradorId } = req.body;

        //Logica para ver se o hoario esta disponivel

        //RECUPERAR O CLIENTE

        const cliente = await Cliente.findById(clienteId).select('nome endereco customerId');

        // RECUPERAR O SALAO
        
        const salao = await Salao.findById(salaoId).select('recipientId');

        // RECUPERAR O SERVICO

        const servico = await Servico.findById(servicoId).select('preco titulo comissao');

        // RECUPERAR O COLABORADOR

        const colaborador = await Colaborador.findById(colaboradorId).select('recipientId');

        // CRIANDO PAGAMENTO
        const precoFinal = util.toCents(servico.preco) * 100;
        
        // COLABORADOR SPLIT RULES

        const colaboradoreSplitRule = {
            recipient_id: colaborador.recipienteId,
            amount: parseInt(precoFinal * (servico.comissao/ 100)),
        }


        const createPayment = await pagarme('/transactions', {
            amount: precoFinal,
            card_number: '4111111111111111',
            card_cvv: '123',
            card_expiration_date: '0922',
            card_holder_name: 'Morpheus Fishburne',
            customer: {
              id: cliente.customerId,
            },
            billing: {
              // SUBISTITUIR COM OS DADOS DO CLIENTE
              name: cliente.nome,
              address: {
                country: cliente.endereco.pais.toLowerCase(),
                state: cliente.endereco.uf.toLowerCase(),
                city: cliente.endereco.cidade,
                street: cliente.endereco.logradouro,
                street_number: cliente.endereco.numero,
                zipcode: cliente.endereco.cep,
              },
            },
            items: [
              {
                id: servicoId,
                title: servico.titulo,
                unit_price: precoFinal,
                quantity: 1,
                tangible: false,
              },
            ],
            split_rules: [
              // TAXA DO SALÃO
              {
                recipient_id: salao.recipientId,
                amount: precoFinal - keys.app_fee - colaboradoreSplitRule.amount,
              },
              // TAXAS DOS ESPECIALISTAS / COLABORADORES
              colaboradoreSplitRule,
              // TAXA DO APP
              {
                recipient_id: keys.recipient_id,
                amount: keys.app_fee,
                charge_processing_fee: false,
              },
            ],
          });

          if (createPayment.error) {
            throw createPayment;
          }


          // CRIAR AGENDAMENTO
          const agendamento = await new Agendamento({
            ...req.body,
            transactionId: createPayment.data.id,
            comissao: servico.comissao,
            valor: servico.preco,
          }).save({session})

        await session.commitTransaction();
        session.endSession();

        res.json({error: false, agendamento});

    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        res.json({error: true, message: err.message});
    }
});

router.post('/filter', async (req, res) => {
    try {

        const { periodo, salaoId} = req.body;

        const agendamentos = await Agendamento.find({
            salaoId,
            data: {
                $gte: moment(periodo.inicio).startOf('day'),
                $lte: moment(periodo.final).endOf('day')
            },
        }).populate([
            {path: 'servicoId', select: 'titulo duracao'},
            {path: 'colaboradorId', select: 'nome'},
            {path: 'cliente', select: 'nome'}
        ]);

        res.json({error: false, agendamentos});

    } catch (err) {
        res.json({ error: true, message: err.message });
    }
});


router.post('/dias-disponiveis', async (req, res) => {
  try {
    const { data, salaiId, servicoId } = req.body;
    const horarios = await Horario.find ({ salaoId });
    const servico = await Servico.findById(servicoId).select('duracao');

    let agenda = [];
    let colaboradores = [];
    let lastDay = moment(data);

    // DURAÇÃO DO SERVIÇO
    const servicoMinutos = util.hourToMinutes(moment(servico.duracao).format('HH:mm'));

    const servicoSlots = util.sliceMinutes(
      servico.duracao,
      moment(servico.duracao).add(servicoMinutos, 'minutes'),
      util.SLOT_DURATION
    ).length;

    // PROCURAR NOS PROXIMOS 365 DIAS ATE TER 7 DIAS DISPONIVEIS

    for (let i = 0; i <= 365 && agenda.length <= 7; i++) {
      const espacosValidos = horarios.filter(horario => {

        // VERIFICAR O DIA DA SEMANA
        const diaSemanaDisponivel = horario.dias.includes(lastDay).day();

        // VERIFICAR ESPECIALIDADE DISPONIVEL
        const servicoDisponivel = horario.especialidades.includes(servicoId);

        return diaSemanaDisponivel && servicoDisponivel;
      });

      if (espacosValidos.length > 0) {

        let todosHorariosDia = {};

        for (let spaco of espacosValidos) {
          for ( let colaboradorId of spaco.colaboradores) {
            if (!todosHorariosDia[colaboradorId]) {
              todosHorariosDia[colaboradorId] = []
            }

            todosHorariosDia[colaboradorId] = [
              ...todosHorariosDia[colaboradorId],
              ...util.sliceMinutes(
                util.mergeDateTime(lastDay, spaco.inicio),
                util.mergeDateTime(lastDay, spaco.fim),
                util.SLOT_DURATION,
              )
            ];
          }
        }

        for (let colaboradorId of Object.keys(todosHorariosDia)){
          const agendamentos = await Agendamento.find({
            colaboradorId,
            data: {
              $gte: moment(lastDay).startOf('day'),
              $lte: moment(lastDay).endOf('day'),
            },
          })
          .select('data servicoId- _id')
          .populate('servicoId', 'duracao');

          let horariosOcupados = agendamentos.map(agendamento => ({
            inicio: moment(agendamentos.data),
            final:moment(agendamentos.data).add(util.hourToMinutes(
              moment(agendamentos.servicoId.duracao).format('HH:mm')),
              'minutes'),
          }));

          horariosOcupados = horariosOcupados.map(horario => 
            util.sliceMinutes(hoarios.inicio, horario.final, util.SLOT_DURATION)
          ).flat();

          // REMOVER OS HORARIOS OCUPADOS
          let horariosLivres = util.splitByValue(todosHorariosDia[colaboradorId].map(
            horariosLivres =>{
            return horariosOcupados.includes(horarioLivre)
             ? '-' : 
             horariosLivres;
          }),'-').filter((space) => space.length > 0);

          // SE TEM ESPAÇO SUFICIENTE NO SLOTS PARA O SERVIÇO
          
          horariosLivres = horariosLivres.filter((horarios) => horarios.length >= servicoSlots);

          horariosLivres = horariosLivres.map((slot) => 
            slot.filter((horario, index) => slot.length - index >= servicoSlots
          )).flat();

          // FORMATANDO OS HORARIOS DE 2 EM 2
          horariosLivres = _.chunk(horariosLivres, 2);

          // REMOVENDO O COLABORADOR CASO NÃO TENHA ESPAÇO
          if (horariosLivres.length == 0) {
            todosHorariosDia = _.omit(todosHorariosDia, colaboradorId);
          } else {
            todosHorariosDia[colaboradorId] = horariosLivres;
          }
        }

        // VERIFICAR SE TEM ESPECIALISTA DISPONIVEL NO DIA
        const totalEspecialista = Object.keys(todosHorariosDia).length;

        if (totalEspecialista > 0) {
          colaboradores.push(Object.keys(todosHorariosDia));
          agenda.push({
            [lastDay.format('YYYY-MM-DD')] : todosHorariosDia,
          });
        }

      }
      lastDay = moment(lastDay).add(1,'day');

    }
    // RECUPERANDO DADOS DOS COLABORADORES
    colaboradores = _.uniq(colaboradores.flat());

    colaboradores = await Colaborador.find({
      _id: { $in: colaboradores},
    }).select('nome foto');

    colaboradores = colaboradores.map( c => ({
      ...c._doc,
      nome: c.nome.split(' ')[0],
    }));

    res.json({
      error: false,
      colaboradores,
      agenda,
      });

  } catch (err){
    res.json({ error: true, message: err.message });
  }

});

module.exports = {router, getAllAgenda};
