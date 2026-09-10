import './engine-config.css';

const STORAGE_KEY = 'autoride_api_url';

function cleanUrl(value: string) {
  return value.trim().replace(/\/$/, '');
}

function closePanel() {
  document.getElementById('autoride-engine-modal')?.remove();
}

async function testConnection(url: string, status: HTMLElement, button: HTMLButtonElement) {
  const clean = cleanUrl(url);
  if (!clean) {
    status.className = 'engine-config__status error';
    status.textContent = 'Cole o link do motor OmniVoice.';
    return;
  }

  button.disabled = true;
  button.textContent = 'Conectando...';
  status.className = 'engine-config__status checking';
  status.textContent = 'Verificando conexão com o Colab...';

  try {
    const response = await fetch(`${clean}/health`);
    const data = await response.json();
    if (!response.ok || data?.status !== 'ok') throw new Error('Motor não respondeu como esperado.');

    localStorage.setItem(STORAGE_KEY, clean);
    status.className = 'engine-config__status success';
    status.textContent = '● OmniVoice conectado e online';
    button.textContent = 'Conectado';
    window.setTimeout(() => window.location.reload(), 650);
  } catch {
    status.className = 'engine-config__status error';
    status.textContent = 'Não foi possível conectar. Confira se o Colab está aberto e se o link está correto.';
    button.disabled = false;
    button.textContent = 'Conectar';
  }
}

function openPanel() {
  closePanel();
  const current = localStorage.getItem(STORAGE_KEY) || '';
  const overlay = document.createElement('div');
  overlay.id = 'autoride-engine-modal';
  overlay.className = 'engine-config__overlay';
  overlay.innerHTML = `
    <div class="engine-config__panel" role="dialog" aria-modal="true" aria-label="Configuração do motor OmniVoice">
      <button class="engine-config__close" aria-label="Fechar">×</button>
      <div class="engine-config__eyebrow">ENGINE CONNECTION</div>
      <h2>Conectar OmniVoice</h2>
      <p class="engine-config__description">Cole abaixo o endereço público gerado pelo Colab para conectar esta interface ao motor de clonagem de voz.</p>
      <label class="engine-config__label" for="autoride-engine-url">URL do motor OmniVoice</label>
      <input id="autoride-engine-url" class="engine-config__input" type="url" spellcheck="false" placeholder="https://seu-link.trycloudflare.com" value="${current.replace(/"/g, '&quot;')}" />
      <div class="engine-config__hint">O endereço normalmente termina em <b>trycloudflare.com</b>.</div>
      <div class="engine-config__status">${current ? 'Endereço salvo. Clique em Conectar para verificar.' : 'Aguardando endereço do Colab.'}</div>
      <button class="engine-config__connect">Conectar</button>
      <div class="engine-config__footer"><span></span> OmniVoice / CUDA</div>
    </div>`;

  document.body.appendChild(overlay);
  const input = overlay.querySelector<HTMLInputElement>('#autoride-engine-url')!;
  const status = overlay.querySelector<HTMLElement>('.engine-config__status')!;
  const connect = overlay.querySelector<HTMLButtonElement>('.engine-config__connect')!;
  overlay.querySelector<HTMLButtonElement>('.engine-config__close')!.onclick = closePanel;
  overlay.addEventListener('click', e => { if (e.target === overlay) closePanel(); });
  connect.onclick = () => testConnection(input.value, status, connect);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') connect.click(); });
  window.setTimeout(() => input.focus(), 50);
}

// Captura antes do React para evitar o window.prompt, que pode ser bloqueado no preview do AI Studio.
document.addEventListener('click', (event) => {
  const target = event.target as HTMLElement | null;
  const button = target?.closest('button');
  if (!button) return;
  const isTopEngineButton = button.getAttribute('title') === 'Conectar ao OmniVoice';
  const isSettingsButton = button.textContent?.trim().includes('Configurações');
  if (!isTopEngineButton && !isSettingsButton) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  openPanel();
}, true);
