const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const bodyParser = require('body-parser');
const userRoutes = require('./routes/userRoutes');
const fileUpload = require('express-fileupload');
const User = require('./models/User');

// Inicializa Express
const app = express();
app.use(cors({
    origin: '*',
    credentials: true
  }));
app.use(bodyParser.json());
app.use(fileUpload()); 
app.use(express.static(path.join(__dirname, 'public')));


// Conecta con MongoDB Atlas
mongoose.connect('mongodb+srv://franchu:hola123@cluster0.cqfqs.mongodb.net/faceid-db?retryWrites=true&w=majority&appName=Cluster0', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Conectado a MongoDB Atlas'))
.catch(error => console.log('Error al conectar a MongoDB Atlas:', error));

// Rutas de usuario
app.use('/api', userRoutes);

// Inicia el servidor
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
