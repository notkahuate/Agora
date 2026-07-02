const { loadEnv, getLoadedEnvPath } = require('./configures/env');
loadEnv();

const express = require("express");
const path = require("path");
const { testConnection } = require('./configures/db');
const { runMigrations } = require('./configures/migrate');
const { getSmtpResumen, verificarSmtp } = require('./Helpers/emailHelper');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const empresasRoutes = require('./Routes/empresasRoutes');
const usuarioRoutes = require('./Routes/UsuarioRoutes');
const  DocumentoRoutes = require('./Routes/DocumentoRoutes');
const authRoutes = require('./Routes/authRoutes');
const Tipodocs = require('./Routes/tipodocumentosRoutes');
const documentosRequeridosRoutes = require('./Routes/DocumentosRoutes');
const documentoResponsableRoutes = require('./Routes/DocumentoResponsableRoutes');
const auditoriaRoutes = require('./Routes/AuditoriaRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/tipos-documentos', Tipodocs);

app.use('/api/documentos', DocumentoRoutes);
app.use('/api/usuarios', usuarioRoutes);

app.use('/api/empresas', empresasRoutes);

app.use('/api/documentos-requeridos', documentosRequeridosRoutes);
app.use('/api/documento-responsables', documentoResponsableRoutes);
app.use('/api/auditoria', auditoriaRoutes);

// Servir archivos de uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use(express.static(path.join(__dirname, "../../frontend")));

(async () => {
  const envPath = getLoadedEnvPath();
  console.log(`📄 Variables cargadas desde: ${envPath || 'process.env'}`);

  const smtp = getSmtpResumen();
  console.log(
    `📧 SMTP: host=${smtp.host}, port=${smtp.port}, user=${smtp.user}, password=${smtp.passConfigurada ? 'OK' : 'FALTA'}`
  );

  await testConnection();
  await runMigrations();

  try {
    await verificarSmtp();
    console.log('✅ Conexión SMTP verificada');
  } catch (smtpError) {
    console.warn('⚠️ SMTP no disponible al iniciar:', smtpError.message);
  }

  app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
  });
})();

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../../frontend/index.html"));
});
