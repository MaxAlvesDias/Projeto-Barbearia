const AWS = require('aws-sdk');

module.exports = {
    IAM_USER_KEY: '',
    IAM_USER_SECRET: '',
    BUCKET_NAME: 'miguel-barbearia',
    AWS_REGION: 'eu-north-1',
    
    s3bucket: new AWS.S3({
        accessKeyId: '',
        secretAccessKey: '',
        region: 'eu-north-1',
    }),

    uploadToS3: function (file, filename, acl = 'public-read') {
        return new Promise((resolve, reject) => {

            if (!file || !filename) {
                return resolve({ error: true, message: 'Arquivo ou nome do arquivo não fornecido.' });
            }

            const params = {
                Bucket: this.BUCKET_NAME,
                Key: filename,
                Body: file, // Usando `file` diretamente
            };

            this.s3bucket.upload(params, function (err, data) {
                if (err) {
                    return resolve({ error: true, message: err.message });
                }
                return resolve({ error: false, message: data });
            });
        });
    },

    deleteFileS3: function (key) {
        return new Promise((resolve, reject) => {
            const params = {
                Bucket: this.BUCKET_NAME,
                Key: key,
            };

            this.s3bucket.deleteObject(params, function (err, data) {
                if (err) {
                    console.log('Erro ao deletar:', err);
                    return resolve({ error: true, message: err });
                }
                console.log('Arquivo deletado:', data);
                return resolve({ error: false, message: data });
            });
        });
    },
};
