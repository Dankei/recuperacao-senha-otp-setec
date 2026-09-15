/**
 * Funções compartilhadas pelo frontend.
 *
 * Todas as páginas HTML carregam este arquivo.
 * Assim o aluno não precisa repetir o mesmo fetch em cada tela.
 */

/**
 * Chama um endpoint da API e devolve o JSON.
 * Se o servidor responder com erro, lança uma Error com a mensagem.
 */
async function api(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    // credentials: 'same-origin' envia o cookie de sessão automaticamente
    credentials: 'same-origin',
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'Não foi possível concluir a operação.');
  }

  return data;
}

/**
 * Mostra uma mensagem de sucesso ou erro acima do formulário.
 */
function showMessage(element, text, type) {
  if (!element) {
    return;
  }

  element.hidden = false;
  element.textContent = text;
  element.className = `message message--${type}`;
}

function hideMessage(element) {
  if (!element) {
    return;
  }

  element.hidden = true;
  element.textContent = '';
}

/**
 * Guarda e-mail (e depois o código) no sessionStorage.
 * sessionStorage some quando a aba fecha — suficiente para o fluxo da aula.
 */
function saveResetData(partial) {
  const current = getResetData();
  const next = { ...current, ...partial };
  sessionStorage.setItem('passwordReset', JSON.stringify(next));
}

function getResetData() {
  try {
    return JSON.parse(sessionStorage.getItem('passwordReset') || '{}');
  } catch (error) {
    return {};
  }
}

function clearResetData() {
  sessionStorage.removeItem('passwordReset');
}

/**
 * Evita cliques duplos enquanto a requisição está em andamento.
 */
function setLoading(button, isLoading) {
  if (!button) {
    return;
  }

  button.disabled = isLoading;
  button.dataset.originalText = button.dataset.originalText || button.textContent;
  button.textContent = isLoading ? 'Aguarde...' : button.dataset.originalText;
}
