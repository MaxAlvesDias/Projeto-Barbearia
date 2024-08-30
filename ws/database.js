const mongoose = require('mongoose');

// URI do MongoDB com credenciais e nome do banco de dados
const URI = 'mongodb+srv://adminUser:%40Miguelbarbearia300@clusterdev.lf9ma.mongodb.net/Miguel_Barbearia?retryWrites=true&w=majority&appName=Clusterdev';

// Conexão com o banco de dados
mongoose.connect(URI)
    .then(() => console.log('DB is Up!'))
    .catch((err) => console.log('Erro na conexão com o DB:', err));
