const mongoose = require('mongoose');

// URI do MongoDB com credenciais e nome do banco de dados
<<<<<<< HEAD
const URI = 'mongodb+srv://adminUser:Mongodb1007@clusterdev.lf9ma.mongodb.net/Miguel_Barbearia?retryWrites=true&w=majority&appName=Clusterdev';
=======
const URI = 'mongodb+srv://adminUser:(senhaDoUsuario)clusterdev.lf9ma.mongodb.net/Miguel_Barbearia?retryWrites=true&w=majority&appName=Clusterdev';
>>>>>>> 25acec6d84f2ed62c1dc734afe3f423710884e53

// Conexão com o banco de dados
mongoose.connect(URI)
    .then(() => console.log('DB is Up!'))
    .catch((err) => console.log('Erro na conexão com o DB:', err));
