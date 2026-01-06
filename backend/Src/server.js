require('dotenv').config();
const express = require("express");
const path = require("path");
const { testConnection } = require('./configures/db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const empresasRoutes = require('./Routes/empresasRoutes');
const usuarioRoutes = require('./Routes/UsuarioRoutes');
const  DocumentoRoutes = require('./Routes/DocumentoRoutes');
const authRoutes = require('./Routes/authRoutes');
const Tipodocs = require('./Routes/tipodocumentosRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/tipos-documentos', Tipodocs);

app.use('/api/documentos', DocumentoRoutes);
app.use('/api/usuarios', usuarioRoutes);

app.use('/api/empresas', empresasRoutes);



app.use(express.static(path.join(__dirname, "../../frontend")));
testConnection();

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../../frontend/index.html"));
});
   
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
