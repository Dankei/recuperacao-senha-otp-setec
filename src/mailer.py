"""
Envio de e-mail com o código OTP.

Usamos smtplib + SMTP do Gmail.
As credenciais vêm do arquivo .env (nunca ficam hardcoded aqui).

Dois modos de funcionamento, para a aula não travar:

1. E-mail configurado (EMAIL_USER + EMAIL_PASSWORD):
   o código é enviado de verdade para a caixa de entrada.

2. E-mail NÃO configurado:
   o código é impresso no terminal. Assim o aluno consegue
   testar o fluxo mesmo sem App Password do Google.
"""
import os
import smtplib
from email.message import EmailMessage
from src.utils import OTP_VALIDITY_MINUTES

def is_email_configured():
    return bool(os.getenv('EMAIL_USER') and os.getenv('EMAIL_PASSWORD'))

def send_otp_email(to, code):
    """
    Envia o OTP para o e-mail informado.
    Se SMTP não estiver configurado, só registra no terminal (modo aula).

    Importante: em um sistema real NÃO devemos logar o OTP.
    Fazemos isso aqui apenas quando o e-mail não está configurado,
    para a turma conseguir seguir o fluxo.
    """
    if not is_email_configured():
        print('-' * 40)
        print('E-mail não configurado no .env.')
        print('Modo aula: o código OTP aparece abaixo.')
        print(f'Destinatário: {to}')
        print(f'Código OTP:   {code}')
        print(f'Validade:     {OTP_VALIDITY_MINUTES} minutos')
        print('-' * 40)
        return

    email_user = os.getenv('EMAIL_USER')
    email_pass = os.getenv('EMAIL_PASSWORD')

    msg = EmailMessage()
    msg['Subject'] = 'Seu código para redefinir a senha'
    msg['From'] = f"Recuperação de senha <{email_user}>"
    msg['To'] = to
    
    text_content = f"""Você pediu para redefinir a senha.

Código de verificação: {code}
Este código vale por {OTP_VALIDITY_MINUTES} minutos.

Se você não pediu isso, ignore este e-mail."""

    html_content = f"""
    <p>Você pediu para redefinir a senha.</p>
    <p>Código de verificação: <strong>{code}</strong></p>
    <p>Este código vale por {OTP_VALIDITY_MINUTES} minutos.</p>
    <p>Se você não pediu isso, ignore este e-mail.</p>
    """

    msg.set_content(text_content)
    msg.add_alternative(html_content, subtype='html')

    # Usa TLS no Gmail
    with smtplib.SMTP('smtp.gmail.com', 587) as server:
        server.starttls()
        server.login(email_user, email_pass)
        server.send_message(msg)
