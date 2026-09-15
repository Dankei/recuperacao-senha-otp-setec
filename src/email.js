/**
 * Envio de e-mail com o código OTP.
 *
 * Usamos Nodemailer + SMTP do Gmail.
 * As credenciais vêm do arquivo .env (nunca ficam hardcoded aqui).
 *
 * Dois modos de funcionamento, para a aula não travar:
 *
 * 1. E-mail configurado (EMAIL_USER + EMAIL_PASSWORD):
 *    o código é enviado de verdade para a caixa de entrada.
 *
 * 2. E-mail NÃO configurado:
 *    o código é impresso no terminal. Assim o aluno consegue
 *    testar o fluxo mesmo sem App Password do Google.
 */

const nodemailer = require('nodemailer');
const { OTP_VALIDITY_MINUTES } = require('./utils');

function isEmailConfigured() {
  return Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASSWORD);
}

/**
 * Cria o "carteiro" do Nodemailer.
 * service: 'gmail' já preenche host/porta do Google.
 * A senha precisa ser uma App Password, não a senha normal da conta.
 */
function createTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
}

/**
 * Envia o OTP para o e-mail informado.
 * Se SMTP não estiver configurado, só registra no terminal (modo aula).
 *
 * Importante: em um sistema real NÃO devemos logar o OTP.
 * Fazemos isso aqui apenas quando o e-mail não está configurado,
 * para a turma conseguir seguir o fluxo.
 */
async function sendOtpEmail(to, code) {
  if (!isEmailConfigured()) {
    console.log('----------------------------------------');
    console.log('E-mail não configurado no .env.');
    console.log('Modo aula: o código OTP aparece abaixo.');
    console.log(`Destinatário: ${to}`);
    console.log(`Código OTP:   ${code}`);
    console.log(`Validade:     ${OTP_VALIDITY_MINUTES} minutos`);
    console.log('----------------------------------------');
    return;
  }

  const transporter = createTransporter();

  await transporter.sendMail({
    from: `"Recuperação de senha" <${process.env.EMAIL_USER}>`,
    to,
    subject: 'Seu código para redefinir a senha',
    text: [
      'Você pediu para redefinir a senha.',
      '',
      `Código de verificação: ${code}`,
      `Este código vale por ${OTP_VALIDITY_MINUTES} minutos.`,
      '',
      'Se você não pediu isso, ignore este e-mail.',
    ].join('\n'),
    html: `
      <p>Você pediu para redefinir a senha.</p>
      <p>Código de verificação: <strong>${code}</strong></p>
      <p>Este código vale por ${OTP_VALIDITY_MINUTES} minutos.</p>
      <p>Se você não pediu isso, ignore este e-mail.</p>
    `,
  });
}

module.exports = {
  isEmailConfigured,
  sendOtpEmail,
};
