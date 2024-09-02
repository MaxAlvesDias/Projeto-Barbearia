const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const pagarme = require('../services/pagarme');
const Colaborador = require('../models/colaborador');
const SalaoColaborador = require('../models/relationship/salaoColaborador');
const ColaboradorServico = require('../models/relationship/colaboradorServico');


router.post('/', async(req, res) => {
    const db = mongoose.connection;
    const session = await db.startSession();
    session.startTransaction();

    try {
        const { colaborador, salaoId} = req.body;
        let newColaborador = null;

        //verificar se o colaborador existe

        const existentColaborador = await Colaborador.findOne({
            $or: [
                {email: colaborador.email},
                {telefone: colaborador.telefone },
            ]
        });

        // SE NÃO EXISTIR O COLABORADOR FAZ O CADASTRO
        if (!existentColaborador) {
            // CRIAR CONTA BANCARIA
            const { contaBancaria } = colaborador;
            const pagarmeBankAccount = await pagarme('bank_accounts', {
                agencia: contaBancaria.agencia,
                bank_code: contaBancaria.banco,
                conta: contaBancaria.numero,
                conta_dv: contaBancaria.dv,
                tipo: contaBancaria.tipo,
                document_number: contaBancaria.cpfCnpj,
                legal_name: contaBancaria.titular,
            });

            if (pagarmeBankAccount.error) {
                throw pagarmeBankAccount;
            };

            //Criar recebedor
            const pagarmeRecipient = await pagarme('/recipients', {
                transfer_interval: 'daily',
                transfer_enabled: true,
                bank_account_id: pagarmeBankAccount.data.id,
            });

            if (pagarmeRecipient.error) {
                throw pagarmeRecipient;
            };

            //CRIAR COLABORADOR
            newColaborador = await Colaborador({
                ...colaborador,
                recipientId: pagarmeRecipient.data.id,
            }).save({ session });
        }

        //RELACIONAMENTO
        const colaboradorId = existentColaborador ? existentColaborador.id: newColaborador._id;
        
        //VERIFICA SE JÁ EXISTE O RELACIONAMENTO COM O SALÃO
        const existentRelationship = await SalaoColaborador.findOne({
            salaoId,
            colaboradorId,
            statur: { $ne: 'E' },
        });

        // SE NÃO TEM RELACIONAMENTO COM O SALÃO
        if (!existentRelationship) {
            await new SalaoColaborador({
                salaoId,
                colaboradorId,
                status: colaborador.vinculo,
            }).save({ session });
        }

        // SE JÁ EXISTIR UM VINCULO ENTRE COLABORADOR E SALAO
        if (existentColaborador) {
            await SalaoColaborador.findOneAndUpdate(
                {
                salaoId,
                colaboradorId,
            },
            { status: colaborador.vinculo },
            { session}
            );
        }

        // RELAÇÃO COM AS ESPECIALIDADES
        await ColaboradorServico.insertMany(
            colaborador.especialidades.map(servicoId => ({
                servicoId,
                colaboradorId,
            }), { session }
        )
        );

        await session.commitTransaction();
        session.endSession();

        if(existentColaborador && existentRelationship) {
            res.json({ error: true,  message: 'Colaborador já cadastrado'});
        } else {
            res.json({ error: false });
        }
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        res.json({ error: true, message: err.message });
    }
});

router.put('/:colaboradorId', async (req, res) => {
    try {

        const { vinculo, vinculoId, especialidades } = req.body;
        const { colaboradorId } = req.params;

        //VINCULO
        await SalaoColaborador.findByIdAndUpdate(vinculoId, { satatus: vinculo });

        //ESPECIALIDADES
        await ColaboradorServico.deleteMany({
            colaboradorId,
        });

        await ColaboradorServico.insertMany(
            especialidade.map(
                (servicoId) => ({
                    servicoId,
                    colaboradorId,
                }))
        );

        res.json( { error: false});


    } catch (err) {
        res.json({ error: true, message: err.message})
    }
});

router.delete('/vinculo/:id', async (req, res) => {
    try{
        await SalaoColaborador.findByIdAndUpdate(req.params.id, { status: 'E'});

        res.json({ error: false });

    } catch(err) {
        res.json({ error: true, message: err.message});
    }
});

router.post('/filter', async (req, res) => {
    try{

        const colaboradores = await Colaborador.find(req.body.filters);

        res.json({ error: false, colaboradores});

    } catch (err) {
        res.json({ error: true, message: err.message})
    }
});

router.get('/salao/:salaiId', async (req, res) => {
    try{
        const { salaoId } = req.params;
        let listaColaboradores = [];

        //RECUPERAR VINCULOS
        const salaoColaboradores = await SalaoColaborador.find({
            salaoId,
            status: { $ne: 'E' },
        }).populate({ path: 'colaboradorId', select: '-senha -recipientId' })
        .select('colaboradorId dataCadastro status');

        for (let vinculo of salaoColaboradores) {
            const especialidades = await ColaboradorServico.find({
                colaboradorId: vinculo.colaboradorId._id
            });

            listaColaboradores.push({
                ...vinculo._doc,
                especialidades,
            });
        }
        
        res.json({ 
            error: false,
            colaboradores: listaColaboradores.map((vinculo) => ({
                ...vinculo.colaboradorId._dic,
                vinculoId: vinculo._id,
                vinculo: vinculo.status,
                especialidaes: vinculo.especialidades,
                dataCadastro: vinculo.dataCadastro,
            })),
        });

    } catch (err) {
        res.json({ error: true, message: err.message});
    }
});

module.exports = router;