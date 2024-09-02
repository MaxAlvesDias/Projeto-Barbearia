const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const pagarme = require('../services/pagarme');
const Cliente = require('../models/cliente');
const SalaoCliente = require('../models/relationship/salaoCLiente');

router.post('/', async(req, res) => {
    const db = mongoose.connection;
    const session = await db.startSession();
    session.startTransaction();

    try {
        const { cliente, salaoId} = req.body;
        let newCliente = null;

        //verificar se o cliente existe

        const existentCliente = await Cliente.findOne({
            $or: [
                {email: cliente.email},
                {telefone: cliente.telefone },
            ]
        });

        // SE NÃO EXISTIR O CLIENTE
        if (!existentCliente) {

            const _id = mongoose.Types.ObjectId();

            //Criar Customer
            const pagarmeCustomer = await pagarme('/customers', {
                external_id: _id,
                name: cliente.nome,
                type: cliente.documento.tipo == 'cpf' ? 'individual' : 'corporation',
                country: cliente.endereco.pais,
                email: cliente.email,
                documentes: [
                    {
                        type: cliente.documento.tipo,
                        number: cliente.documento.numero,
                    },
                ],
                phone_numbers: [cliente.telefone],
                birthday: cliente.dataNascimento,          
            });

            if (pagarmeCustomer.error) {
                throw pagarmeCustomer;
            };

            //CRIAR Cliente
            newCliente = await Cliente({
                _id,
                ...cliente,
                customerId: pagarmeCustomer.data.id,
            }).save({ session });
        }

        //RELACIONAMENTO
        const clienteId = existentCliente ? existentCliente.id: newCliente._id;
        
        //VERIFICA SE JÁ EXISTE O RELACIONAMENTO COM O SALÃO
        const existentRelationship = await SalaoCliente.findOne({
            salaoId,
            clienteId,
            statur: { $ne: 'E' },
        });

        // SE NÃO TEM RELACIONAMENTO COM O SALÃO
        if (!existentRelationship) {
            await new SalaoCliente({
                salaoId,
                clienteId,
            }).save({ session });
        }

        // SE JÁ EXISTIR UM VINCULO ENTRE CLIENTE E SALAO
        if (existentCliente) {
            await SalaoCliente.findOneAndUpdate(
                {
                salaoId,
                clienteId,
            },
            { status: 'A' },
            { session}
            );
        }

        await session.commitTransaction();
        session.endSession();

        if(existentCliente && existentRelationship) {
            res.json({ error: true,  message: 'Cliente já cadastrado'});
        } else {
            res.json({ error: false });
        }
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        res.json({ error: true, message: err.message });
    }
});

router.post('/filter', async (req, res) => {
    try{

        const clientes = await Cliente.find(req.body.filters);

        res.json({ error: false, clientes});

    } catch (err) {
        res.json({ error: true, message: err.message})
    }
});

router.get('/salao/:salaiId', async (req, res) => {
    try{
        const { salaoId } = req.params;
        let listaClientes = [];

        //RECUPERAR VINCULOS
        const clientes = await SalaoCliente.find({
            salaoId,
            status: { $ne: 'E' },
        }).populate('clienteId').select('clienteId dataCadastro');
        
        res.json({ 
            error: false,
            clientes: clientes.map((vinculo) => ({
                ...vinculo.clienteId._dic,
                vinculoId: vinculo._id,
                dataCadastro: vinculo.dataCadastro,
            })),
        });

    } catch (err) {
        res.json({ error: true, message: err.message});
    }
});

router.delete('/vinculo/:id', async (req, res) => {
    try{
        await SalaoCliente.findByIdAndUpdate(req.params.id, { status: 'E'});

        res.json({ error: false });

    } catch(err) {
        res.json({ error: true, message: err.message});
    }
});


module.exports = router;