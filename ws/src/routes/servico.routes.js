const express = require('express');
const router = express.Router();
const multer = require('multer');
const aws = require('../services/aws');
const Servico = require('../models/servico');
const Arquivos = require('../models/arquivo');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.post('/', upload.any(), async (req, res) => {
  try {
    let errors = [];
    let arquivos = [];

    // Verifique se há arquivos para fazer upload
    if (req.files && req.files.length > 0) {
      for (let file of req.files) {
        const nameParts = file.originalname.split('.');
        const fileName = `${new Date().getTime()}.${
          nameParts[nameParts.length - 1]
        }`;
        const path = `servicos/${req.body.salaoId}/${fileName}`;

        // Upload para o S3
        const response = await aws.uploadToS3(
          file.buffer,
          path
        );

        if (response.error) {
          errors.push({ error: true, message: response.message.message });
        } else {
          arquivos.push(path);
        }
      }
    }

    // Verifique se ocorreu algum erro no upload dos arquivos
    if (errors.length > 0) {
      res.json(errors[0]);
      return;
    }

    // CRIAR SERVIÇO
    let jsonServico;

    // Verifique se o corpo da requisição contém os dados do serviço em JSON
    try {
      jsonServico = JSON.parse(req.body.servico);
    } catch (err) {
      return res.json({ error: true, message: 'Formato inválido para o campo servico' });
    }

    // Atribua o salaoId ao serviço
    jsonServico.salaoId = req.body.salaoId;

    // Verifique se o salaoId está definido
    if (!jsonServico.salaoId) {
      return res.json({ error: true, message: 'salaoId não fornecido' });
    }

    console.log(jsonServico);
    const servico = await new Servico(jsonServico).save();

    // CRIAR ARQUIVO
    arquivos = arquivos.map((arquivo) => ({
      referenciaId: servico._id,
      model: 'Servico',
      caminho: arquivo,
    }));
    await Arquivos.insertMany(arquivos);

    // Resposta de sucesso
    res.json({ error: false, arquivos });
  } catch (err) {
    // Resposta de erro
    res.json({ error: true, message: err.message });
  }
});

router.put('/:id', upload.any(), async (req, res) => {
    try {
      let errors = [];
      let arquivos = [];
  
      if (req.files && req.files.length > 0) {
        for (let file of req.files) {
          const nameParts = file.originalname.split('.');
          const fileName = `${new Date().getTime()}.${
            nameParts[nameParts.length - 1]
          }`;
          const path = `servicos/${req.body.salaoId}/${fileName}`;
  
          const response = await aws.uploadToS3(
            file.buffer,
            path
            //, acl = https://docs.aws.amazon.com/pt_br/AmazonS3/latest/dev/acl-overview.html
          );
  
          if (response.error) {
            errors.push({ error: true, message: response.message.message });
          } else {
            arquivos.push(path);
          }
        }
      }
  
      if (errors.length > 0) {
        res.json(errors[0]);
        return false;
      }
  
      // CRIAR SERVIÇO
      const jsonServico = JSON.parse(req.body.servico);
      await Servico.findByIdAndUpdate(req.params.id, jsonServico);
  
      // CRIAR ARQUIVO
      arquivos = arquivos.map((arquivo) => ({
        referenciaId: req.params.id,
        model: 'Servico',
        caminho: arquivo,
      }));
      await Arquivos.insertMany(arquivos);
  
      res.json({ error: false });
    } catch (err) {
      res.json({ error: true, message: err.message });
    }
  });

router.get('/salao/:salaoId', async (req, res) =>{
  try{
    let servicoSalao = [];
    const servicos = await Servico.find({
      salaoId: req.params.salaoId,
      status: {$ne: 'E'},
    });

    for (let servico of servicos){
      const arquivos = await Arquivos.find({
        model: 'Servico',
        referenciaId: servico._id
      });
      servicoSalao.push({ ...servico._doc, arquivos });
    };
    res.json({
      servicos: servicoSalao,
    });
  } catch (err) {
    res.json({ error: true, message: err.message});
  }
});

router.post('/delete-arquivo', async (req, res) => {
    try {
        const { id } = req.body;

        // Excluir aws
        await aws.deleteFileS3(id);

        await Arquivos.findOneAndDelete({ caminho: id, });

        res.json({ error: false});

    } catch (err) {
        res.json({ error: true, message: err.message });
    };
  });

router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        await Servico.findByIdAndUpdate(id, { status: 'E' });

        res.json({ error: false});        

    } catch (err) {
        res.json({ error: true, message: err.message })
    };
})

module.exports = router;
