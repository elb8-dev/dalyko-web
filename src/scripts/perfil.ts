/**
 * Runtime del perfil — port a vanilla TS del comp reactivo de Claude Design.
 *
 * Enlaza el markup convertido mediante atributos `data-*`:
 *   data-t="var"          texto
 *   data-style="tpl"      plantilla de estilo con {var}
 *   data-if="var"         mostrar/ocultar
 *   data-val="var"        valor de input
 *   data-on-click|input|submit="handler"
 */

type Estado = {
  etapa: number;
  auto: boolean;
  abierto: Record<number, boolean>;
  filtro: string;
  ip: string;
  ua: string;
  dia: number;
  fecha: string;
  hash: string;
  sec: string;
  segundos: number;
  scrollMax: number;
  ref: string | null;
  copiado: boolean;
  fNombre: string;
  fCorreo: string;
  fOrg: string;
  fMensaje: string;
  trampa: string;
  envio: 'idle' | 'enviando' | 'ok';
  errorForm: string;
  refEnvio: string;
};

const st: Estado = {
  etapa: 0, auto: true, abierto: {}, filtro: 'todos',
  ip: '203.0.113.42', ua: '', dia: 0, fecha: '', hash: '················',
  sec: 'perfil', segundos: 0, scrollMax: 0, ref: null, copiado: false,
  fNombre: '', fCorreo: '', fOrg: '', fMensaje: '', trampa: '',
  envio: 'idle', errorForm: '', refEnvio: '',
};

const CORREO = 'daly@icam.es';

/* ---------- derivados ---------- */

function dispositivo(): string {
  const s = st.ua.toLowerCase();
  if (/bot|crawler|spider|headless/.test(s)) return 'bot';
  if (/ipad|tablet/.test(s)) return 'tablet';
  if (/mobi|android|iphone/.test(s)) return 'movil';
  return 'escritorio';
}

function navegador(): string {
  const u = st.ua;
  if (/Edg\//.test(u)) return 'Edge';
  if (/OPR\/|Opera/.test(u)) return 'Opera';
  if (/Firefox\//.test(u)) return 'Firefox';
  if (/Chrome\//.test(u)) return 'Chrome';
  if (/Safari\//.test(u)) return 'Safari';
  return 'otro';
}

function visible(etiquetas: string[]): boolean {
  return st.filtro === 'todos' || etiquetas.includes(st.filtro);
}

/** Reproduce la derivación real de `src/lib/analitica.ts` en el navegador. */
async function calcular(): Promise<void> {
  const d = new Date();
  d.setDate(d.getDate() + st.dia);
  st.fecha = d.toISOString().slice(0, 10);
  const entrada = `sal:${st.fecha}|${st.ip}|${st.ua}`;
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(entrada));
    st.hash = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
  } catch {
    st.hash = '················';
  }
  pintar();
}

function vals(): Record<string, unknown> {
  const nodo = (i: number) => ({
    s: st.etapa === i ? 1.12 : 1,
    b: st.etapa === i ? 'var(--laton)' : 'var(--panel-linea)',
    c: st.etapa === i ? 'var(--laton-claro)' : 'var(--panel-suave)',
  });
  const n = [0, 1, 2, 3, 4].map(nodo);
  const chip = (k: string) => (st.filtro === k ? 1 : 0);
  const chipTxt = (k: string) => (st.filtro === k ? 'var(--papel)' : 'var(--texto-suave)');
  const ab = (k: number) => !!st.abierto[k];

  const v: Record<string, unknown> = {
    navProyectos: st.sec === 'proyectos' ? 1 : 0,
    navDespliegue: st.sec === 'despliegue' ? 1 : 0,
    navMedicion: st.sec === 'medicion' ? 1 : 0,
    navDecisiones: st.sec === 'decisiones' ? 1 : 0,
    hash: st.hash, fecha: st.fecha, ip: st.ip,
    segundos: st.segundos, scrollMax: st.scrollMax,
    dispositivo: dispositivo(), navegador: navegador(),
    refJson: st.ref ? `"${st.ref}"` : 'null',
    refTexto: st.ref ?? '(sin ref)',
    etiquetaPlay: st.auto ? 'recorriendo' : 'pausado',
    etiquetaCopia: st.copiado ? 'copiado' : CORREO,
    fTodo: chip('todos'), fTodoTxt: chipTxt('todos'),
    fTs: chip('TypeScript'), fTsTxt: chipTxt('TypeScript'),
    fApi: chip('Integración'), fApiTxt: chipTxt('Integración'),
    fData: chip('Datos'), fDataTxt: chipTxt('Datos'),
    v1: visible(['TypeScript', 'Datos']),
    v2: visible(['Integración', 'Datos']),
    v3: visible(['Integración']),
    v4: visible(['Datos']),
    fNombre: st.fNombre, fCorreo: st.fCorreo, fOrg: st.fOrg, fMensaje: st.fMensaje,
    enviado: st.envio === 'ok',
    formAbierto: st.envio !== 'ok',
    hayError: !!st.errorForm,
    mensajeError: st.errorForm,
    refEnvio: st.refEnvio,
    etiquetaEnvio: st.envio === 'enviando' ? 'Enviando…' : 'Enviar mensaje',
    opacidadEnvio: st.envio === 'enviando' ? 0.6 : 1,
  };
  for (let i = 0; i < 5; i++) {
    v[`s${i}`] = n[i].s; v[`b${i}`] = n[i].b; v[`c${i}`] = n[i].c;
    v[`e${i}`] = st.etapa === i;
  }
  for (let i = 1; i <= 4; i++) {
    v[`a${i}`] = ab(i);
    v[`t${i}`] = ab(i) ? 'Cerrar' : 'Ver detalle';
    v[`r${i}`] = ab(i) ? 180 : 0;
  }
  return v;
}

/* ---------- pintado ---------- */

function pintar(): void {
  const v = vals();

  document.querySelectorAll<HTMLElement>('[data-t]').forEach((el) => {
    const k = el.dataset.t!;
    if (k in v) el.textContent = String(v[k] ?? '');
  });

  document.querySelectorAll<HTMLElement>('[data-style]').forEach((el) => {
    const tpl = el.dataset.style!;
    el.setAttribute(
      'style',
      tpl.replace(/\{([A-Za-z0-9_]+)\}/g, (_, k) => String(v[k] ?? '')),
    );
  });

  document.querySelectorAll<HTMLElement>('[data-if]').forEach((el) => {
    const k = el.dataset.if!;
    el.style.display = v[k] ? 'contents' : 'none';
  });

  document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-val]').forEach((el) => {
    const k = (el as HTMLElement).dataset.val!;
    const nuevo = String(v[k] ?? '');
    if (el.value !== nuevo) el.value = nuevo;
  });
}

/* ---------- envío del formulario ---------- */

async function enviarFormulario(e?: Event): Promise<void> {
  e?.preventDefault();
  if (st.envio === 'enviando') return;

  const nombre = st.fNombre.trim();
  const correo = st.fCorreo.trim();
  const mensaje = st.fMensaje.trim();

  const fallo = (m: string) => { st.errorForm = m; pintar(); };
  if (!nombre) return fallo('Falta el nombre.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo)) return fallo('El correo no parece válido.');
  if (mensaje.length < 10) return fallo('Escribe un mensaje algo más largo (mínimo 10 caracteres).');

  st.envio = 'enviando';
  st.errorForm = '';
  pintar();

  try {
    const r = await fetch('/api/contacto', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        nombre, correo,
        organizacion: st.fOrg.trim(),
        mensaje,
        ref: st.ref,
        empresa_web: st.trampa, // honeypot: el servidor descarta si viene relleno
      }),
    });
    if (!r.ok) throw new Error('envio');
    const datos = (await r.json().catch(() => ({}))) as { referencia?: string };
    st.refEnvio = datos.referencia ?? '';
    st.envio = 'ok';
  } catch {
    st.envio = 'idle';
    st.errorForm = 'No se ha podido enviar. Escríbeme directamente a ' + CORREO + '.';
  }
  pintar();
}

/* ---------- manejadores ---------- */

const handlers: Record<string, (e: Event) => void> = {
  copiar: () => {
    navigator.clipboard?.writeText(CORREO).then(() => {
      st.copiado = true; pintar();
      setTimeout(() => { st.copiado = false; pintar(); }, 1800);
    });
  },
  rotarDia: () => { st.dia += 1; void calcular(); },
  cambiarIp: (e) => { st.ip = (e.target as HTMLInputElement).value; void calcular(); },
  ref1: () => { st.ref = 'enfaf'; pintar(); },
  ref2: () => { st.ref = 'acme'; pintar(); },
  ref0: () => { st.ref = null; pintar(); },
  togglePlay: () => { st.auto = !st.auto; pintar(); },
  filtrarTodo: () => { st.filtro = 'todos'; pintar(); },
  filtrarTs: () => { st.filtro = 'TypeScript'; pintar(); },
  filtrarApi: () => { st.filtro = 'Integración'; pintar(); },
  filtrarData: () => { st.filtro = 'Datos'; pintar(); },
  cNombre: (e) => { st.fNombre = (e.target as HTMLInputElement).value; },
  cCorreo: (e) => { st.fCorreo = (e.target as HTMLInputElement).value; },
  cOrg: (e) => { st.fOrg = (e.target as HTMLInputElement).value; },
  cMensaje: (e) => { st.fMensaje = (e.target as HTMLTextAreaElement).value; },
  cTrampa: (e) => { st.trampa = (e.target as HTMLInputElement).value; },
  enviar: (e) => { void enviarFormulario(e); },
};
for (let i = 0; i < 5; i++) handlers[`ir${i}`] = () => { st.etapa = i; st.auto = false; pintar(); };
for (let i = 1; i <= 4; i++) handlers[`abrir${i}`] = () => { st.abierto[i] = !st.abierto[i]; pintar(); };

/* ---------- arranque ---------- */

export function iniciar(): void {
  st.ua = navigator.userAgent;
  try { st.ref = new URLSearchParams(location.search).get('ref'); } catch { /* nada */ }

  const enlazar = (attr: string, evento: string) => {
    document.querySelectorAll<HTMLElement>(`[data-on-${attr}]`).forEach((el) => {
      const h = handlers[el.dataset[`on${attr[0].toUpperCase()}${attr.slice(1)}`] as string];
      if (h) el.addEventListener(evento, h);
    });
  };
  enlazar('click', 'click');
  enlazar('input', 'input');
  enlazar('submit', 'submit');

  // Reloj de lectura y scroll (alimentan la demo de medición).
  setInterval(() => { st.segundos += 1; pintar(); }, 1000);
  addEventListener('scroll', () => {
    const alto = document.documentElement.scrollHeight - innerHeight;
    const p = alto > 0 ? Math.round((scrollY / alto) * 100) : 0;
    if (p > st.scrollMax) { st.scrollMax = Math.min(100, p); pintar(); }
  }, { passive: true });

  // Sección activa en la navegación.
  const secciones = ['perfil', 'proyectos', 'despliegue', 'medicion', 'decisiones', 'contacto'];
  const obs = new IntersectionObserver((entradas) => {
    entradas.forEach((x) => { if (x.isIntersecting) { st.sec = x.target.id; pintar(); } });
  }, { rootMargin: '-45% 0px -50% 0px' });
  secciones.forEach((id) => { const el = document.getElementById(id); if (el) obs.observe(el); });

  // Recorrido automático del pipeline de despliegue.
  setInterval(() => { if (st.auto) { st.etapa = (st.etapa + 1) % 5; pintar(); } }, 2200);

  // Revelado al entrar en viewport.
  const rev = new IntersectionObserver((entradas) => {
    entradas.forEach((x) => {
      if (x.isIntersecting) {
        (x.target as HTMLElement).style.opacity = '1';
        (x.target as HTMLElement).style.transform = 'none';
        rev.unobserve(x.target);
      }
    });
  }, { rootMargin: '0px 0px -10% 0px' });
  document.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(14px)';
    el.style.transition = 'opacity .6s ease, transform .6s ease';
    rev.observe(el);
  });

  void calcular();
}
