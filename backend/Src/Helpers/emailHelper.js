const nodemailer = require('nodemailer');

let transporter;

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error('SMTP no configurado. Define SMTP_HOST, SMTP_USER y SMTP_PASS en .env');
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: String(process.env.SMTP_SECURE || 'true').toLowerCase() === 'true',
    auth: { user, pass },
  });

  return transporter;
}

async function enviarInvitacionUsuario({ email, nombre, token }) {
  const appUrl = (process.env.APP_URL || 'https://agorasst.com').replace(/\/$/, '');
  const enlace = `${appUrl}/activar-cuenta.html?token=${encodeURIComponent(token)}`;
  const fromName = process.env.SMTP_FROM_NAME || 'Agora SST';
  const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER;

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

  await getTransporter().sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: email,
    subject: 'Activa tu cuenta en Agora SST',
    html,
    text: `Hola ${nombre}, activa tu cuenta aquí: ${enlace}`,
  });
}

module.exports = {
  enviarInvitacionUsuario,
};
