const { loadEnv } = require('../configures/env');

loadEnv();

let transporter;
let transporterKey = '';

function getNodemailer() {
  try {
    return require('nodemailer');
  } catch (error) {
    throw new Error('nodemailer no está instalado. Ejecuta "npm install" dentro de backend.');
  }
}

function readSmtpConfig() {
  const host = String(process.env.SMTP_HOST || 'mail.agorasst.com').trim();
  const user = String(process.env.SMTP_USER || '').trim();
  const pass = String(process.env.SMTP_PASS || '').trim();
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = String(process.env.SMTP_SECURE ?? 'true').toLowerCase() === 'true';

  return { host, user, pass, port, secure };
}

function assertSmtpConfig() {
  const config = readSmtpConfig();
  const missing = [];

  if (!config.user) missing.push('SMTP_USER');
  if (!config.pass) missing.push('SMTP_PASS');

  if (missing.length) {
    throw new Error(
      `Faltan variables SMTP en .env: ${missing.join(', ')}. ` +
      'Colócalas en backend/.env o en Setup Node.js App → Environment Variables.'
    );
  }

  return config;
}

function buildTransportOptions(config, hostOverride = null) {
  return {
    host: hostOverride || config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    tls: {
      rejectUnauthorized: false,
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  };
}

function getHostCandidates(config) {
  const hosts = [config.host, 'localhost', '127.0.0.1'];
  return [...new Set(hosts.filter(Boolean))];
}

async function createWorkingTransporter(config) {
  const nodemailer = getNodemailer();
  const candidates = getHostCandidates(config);
  const errors = [];

  for (const host of candidates) {
    const options = buildTransportOptions(config, host);
    const candidate = nodemailer.createTransport(options);

    try {
      await candidate.verify();
      transporter = candidate;
      transporterKey = `${host}:${config.port}:${config.user}`;
      console.log(`📧 SMTP conectado usando ${host}:${config.port}`);
      return candidate;
    } catch (error) {
      errors.push(`${host}: ${error.message}`);
    }
  }

  throw new Error(
    `No se pudo conectar por SMTP con ningún host (${candidates.join(', ')}). ` +
    errors.join(' | ')
  );
}

function getTransporter() {
  if (transporter) return transporter;
  throw new Error('Transporter SMTP no inicializado. Reinicia la app o llama verificarSmtp().');
}

function getSmtpResumen() {
  const config = readSmtpConfig();
  return {
    host: config.host || '(vacío)',
    port: config.port,
    secure: config.secure,
    user: config.user || '(vacío)',
    passConfigurada: Boolean(config.pass),
    transporterListo: Boolean(transporter),
  };
}

async function verificarSmtp() {
  const config = assertSmtpConfig();
  await createWorkingTransporter(config);
  return {
    ok: true,
    user: config.user,
    host: transporterKey.split(':')[0] || config.host,
    port: config.port,
  };
}

async function enviarInvitacionUsuario({ email, nombre, token }) {
  const config = assertSmtpConfig();

  if (!transporter) {
    await createWorkingTransporter(config);
  }

  const transport = getTransporter();
  const appUrl = (process.env.APP_URL || 'https://agorasst.com').replace(/\/$/, '');
  const enlace = `${appUrl}/activar-cuenta.html?token=${encodeURIComponent(token)}`;
  const fromName = process.env.SMTP_FROM_NAME || 'Agora SST';
  const fromEmail = process.env.SMTP_FROM || config.user;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1e293b;">
      <h2 style="color:#0f172a;">Bienvenido a Agora SST</h2>
      <p>Hola <strong>${nombre}</strong>,</p>
      <p>Se creó una cuenta para ti en Agora SST. Para activarla y definir tu contraseña, usa el botón:</p>
      <p style="text-align:center;margin:28px 0;">
        <a href="${enlace}" style="background:#2563eb;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:700;">
          Activar cuenta
        </a>
      </p>
      <p>O copia este enlace en tu navegador:</p>
      <p style="word-break:break-all;color:#475569;">${enlace}</p>
      <p style="font-size:13px;color:#64748b;">Este enlace expira en ${process.env.INVITATION_EXPIRES_HOURS || 48} horas.</p>
    </div>
  `;

  try {
    await transport.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: email,
      subject: 'Activa tu cuenta en Agora SST',
      html,
      text: `Hola ${nombre}, activa tu cuenta aquí: ${enlace}`,
    });
  } catch (error) {
    transporter = null;
    transporterKey = '';
    const detalle = error && error.message ? error.message : 'error desconocido';
    throw new Error(`El servidor SMTP rechazó el envío: ${detalle}`);
  }
}

module.exports = {
  enviarInvitacionUsuario,
  verificarSmtp,
  getSmtpResumen,
};
