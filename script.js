// ============================================================================
// 1. FUNCIONES UTILITARIAS Y DE SANITIZACIÓN
// ============================================================================

// Helper abreviado para seleccionar elementos del DOM
const $ = s => document.querySelector(s);

// Sanitiza cadenas de texto reemplazando caracteres especiales por sus entidades HTML
const esc = t => String(t == null ? '' : t).replace(/[&<">]/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;'
}[c]));

// Genera un ID único aleatorio de 7 caracteres alfanuméricos
const uid = () => Math.random().toString(36).slice(2, 9);

// Calcula el total de palabras en un texto
const wc = t => (t.trim().match(/\S+/g) || []).length;

// Encripta la contraseña usando SHA-256 (Web Crypto API)
async function hash(p) {
  try {
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(p));
    return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    return btoa(p);
  }
}

// ============================================================================
// 2. CONSTANTES Y ESTADO GLOBAL DE LA APLICACIÓN
// ============================================================================

// Diccionario con los nombres de las redes sociales soportadas
const NET = { ig: 'Instagram', tt: 'TikTok', fb: 'Facebook' };

// Diccionario con los nombres de los canales de acceso para el módulo del club
const CANAL = { story: 'Story de Instagram', dm: 'Mensaje directo (lista)', taquilla: 'Taquilla / venta directa' };

// Objeto de ESTADO PERSISTENTE (se guarda en LocalStorage)
let S = {
  users: [],      // Lista de usuarios registrados
  session: null,  // Usuario con sesión activa actualmente
  drafts: [],     // Lista de borradores y guiones
  conns: { ig: 0, tt: 0, fb: 0 }, // Estado de conexión de cada red social
  posts: [],      // Historial de publicaciones
  entries: []     // Lista de accesos/entradas registradas en el antro
};

// Carga el estado guardado en LocalStorage si existe
try {
  S = Object.assign(S, JSON.parse(localStorage.getItem('es1') || '{}'));
} catch (e) {}

// Guarda el estado actual serializado como JSON dentro de LocalStorage
const save = () => {
  try {
    localStorage.setItem('es1', JSON.stringify(S));
  } catch (e) {}
};

// Objeto de ESTADO VOLÁTIL / TEMPORAL DE LA INTERFAZ
const V = {
  tab: 'drafts',    // Pestaña activa ('drafts', 'pub', 'club')
  auth: 'reg',      // Modo del formulario de autenticación ('reg'=registro, 'in'=login)
  g: 0,             // Paso del flujo de login con Google
  gmail: '',        // Correo capturado en la simulación de Google
  cur: null,        // ID del borrador seleccionado
  caption: '',      // Texto/descripción de la publicación
  nets: { ig: 1, tt: 1, fb: 1 }, // Checkboxes de redes elegidas
  vname: '',        // Nombre del archivo de video
  vurl: '',         // Blob URL local del video
  when: '',         // Fecha y hora programada
  prog: null,       // Estado de progreso de publicación
  saved: ''         // Indicador de borrador guardado
};

// ============================================================================
// 3. LÓGICA DE MODO OSCURO / MODO CLARO
// ============================================================================

// Obtiene el tema guardado o la preferencia del sistema operativo
const getPreferredTheme = () => {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) return savedTheme;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

// Aplica el tema al HTML y actualiza el estado
const applyTheme = (theme) => {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  render(); // Re-renderiza para actualizar el icono del botón en la UI
};

// Alterna entre modo oscuro y claro
const toggleTheme = () => {
  const currentTheme = document.documentElement.getAttribute('data-theme') || getPreferredTheme();
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  applyTheme(newTheme);
};

// Helper para generar el botón del tema de manera reutilizable
const getThemeBtnHTML = () => {
  const currentTheme = document.documentElement.getAttribute('data-theme') || getPreferredTheme();
  const icon = currentTheme === 'dark' ? '☀️' : '🌙';
  return `<button id="theme-toggle" class="btn ghost sm" title="Cambiar tema"><span id="theme-icon">${icon}</span></button>`;
};

// ============================================================================
// 4. VISTAS DE LA INTERFAZ DE USUARIO
// ============================================================================

// Genera la vista del formulario de autenticación
function authView() {
  const g = V.g, reg = V.auth == 'reg';
  let body;

  if (g == 0) body = `<div class="seg">
    <button data-act="mode" data-v="reg" class="${reg ? 'on' : ''}">Crear cuenta</button>
    <button data-act="mode" data-v="in" class="${reg ? '' : 'on'}">Ingresar</button>
  </div>
  <label>Correo<input id="em" type="email" autocomplete="email"></label>
  <label>Contraseña<input id="pw" type="password" autocomplete="${reg ? 'new-password' : 'current-password'}"></label>
  ${reg ? '<label>Nombre de usuario<input id="un" autocomplete="username" placeholder="ej. mi_marca"></label>' : ''}
  <button class="btn" style="width:100%" data-act="${reg ? 'signup' : 'login'}">${reg ? 'Registrarme' : 'Entrar'}</button>
  <div class="or">o</div>
  <button class="btn ghost" style="width:100%" data-act="g1">Continuar con Google</button>`;
  
  else if (g == 1) body = `<h2>Cuenta de Google</h2>
  <p class="mu">Elige o escribe el correo de Google con el que quieres registrarte.</p>
  <label>Correo de Google<input id="gm" type="email" placeholder="tu@gmail.com"></label>
  <button class="btn" data-act="g2">Continuar</button> 
  <button class="btn ghost" data-act="g0">Volver</button>`;

  else body = `<h2>Elige tu nombre de usuario</h2>
  <p class="mu">${esc(V.gmail)}</p>
  <label>Nombre de usuario<input id="gu" placeholder="ej. mi_marca"></label>
  <button class="btn" data-act="g3">Crear cuenta</button> 
  <button class="btn ghost" data-act="g0">Cancelar</button>`;

  return `<main class="auth">
    <div class="card">
      <div class="row" style="justify-content:space-between;margin-bottom:12px">
        <div class="logo">OaHacks</div>
        ${getThemeBtnHTML()}
      </div>
      <p class="mu">Crea, programa y publica en Instagram, TikTok y Facebook desde una sola cuenta.</p>
      ${body}
      <p class="err" id="err"></p>
    </div>
  </main>`;
}

// Genera la vista del gestor de borradores
function draftsView() {
  const d = S.drafts.find(x => x.id == V.cur);

  const list = S.drafts.map(x => `<div class="item ${x.id == V.cur ? 'on' : ''}" data-act="open" data-v="${x.id}">
    <b>${esc(x.t || 'Sin título')}</b><br>
    <span class="tag">${x.k == 'g' ? 'Guion' : 'Borrador'}</span> 
    <span class="mu">${new Date(x.u).toLocaleDateString('es-MX')}</span>
  </div>`).join('') || '<p class="mu">Aún no tienes borradores.</p>';

  const ed = d ? `<div class="row">
    <label style="flex:2">Título<input id="d-t" value="${esc(d.t)}"></label>
    <label>Tipo<select id="d-k">
      <option value="b" ${d.k == 'b' ? 'selected' : ''}>Borrador</option>
      <option value="g" ${d.k == 'g' ? 'selected' : ''}>Guion</option>
    </select></label>
  </div>
  <label>Contenido<textarea id="d-b">${esc(d.b)}</textarea></label>
  <div class="row">
    <span class="mu" id="wc">${wc(d.b)} palabras · ${V.saved}</span>
    <button class="btn ghost sm" data-act="tpl">Insertar estructura de guion</button>
    <button class="btn ghost sm" data-act="dup">Duplicar</button>
    <button class="btn sm" data-act="usecap">Usar como caption</button>
    <button class="btn red sm" data-act="deld">Eliminar</button>
  </div>`
  : '<p class="mu">Selecciona o crea un borrador para editarlo.</p>';

  return `<div class="grid2"><div class="card"><h2>Mis textos</h2><button class="btn" style="width:100%;margin:0 0 10px" data-act="newd">+ Nuevo</button>${list}</div><div class="card"><h2>Editor</h2>${ed}</div></div>`;
}

// Genera la vista de publicación a redes sociales
function pubView() {
  const conn = Object.keys(NET).filter(k => S.conns[k]);

  const nets = Object.keys(NET).map(k => `<div class="net">
    <span><span class="dot ${S.conns[k] ? 'ok' : ''}"></span>${NET[k]}</span>
    <button class="btn sm ${S.conns[k] ? 'ghost' : ''}" data-act="conn" data-v="${k}">${S.conns[k] ? 'Desconectar' : 'Conectar'}</button>
  </div>`).join('');

  const sel = Object.keys(NET).map(k => `<label style="display:inline-flex;gap:6px;align-items:center;margin-right:14px;color:var(--tx)">
    <input type="checkbox" style="width:auto;margin:0" data-net="${k}" ${V.nets[k] && S.conns[k] ? 'checked' : ''} ${S.conns[k] ? '' : 'disabled'}>${NET[k]}
  </label>`).join('');

  const prog = V.prog ? `<div style="margin-top:12px">${Object.keys(V.prog).map(k => `<div class="net"><span>${NET[k]}</span><span class="tag">${V.prog[k]}</span></div>`).join('')}</div>` : '';

  const hist = S.posts.slice().reverse().slice(0, 8).map(p => `<tr>
    <td>${esc(p.v || 'Video')}</td>
    <td>${p.n.map(k => NET[k]).join(', ')}</td>
    <td>${esc(p.cap.slice(0, 40))}${p.cap.length > 40 ? '…' : ''}</td>
    <td><span class="tag">${p.w ? 'Programado ' + esc(p.w.replace('T', ' ')) : 'Publicado'}</span></td>
  </tr>`).join('');

  return `<div class="grid2">
    <div class="card"><h2>Cuenta única</h2><p class="mu">Conecta tus redes una sola vez; todas se publican desde esta cuenta.</p>${nets}<button class="btn ghost" data-act="connall">Conectar las 3</button></div>
    <div>
      <div class="card">
        <h2>Workflow de publicación</h2>
        <div class="flow"><span>1 Video</span>→<span>2 Caption único</span>→<span>3 Redes</span>→<span>4 Publicar o programar</span></div>
        <label>Video<input type="file" id="vid" accept="video/*"></label>
        ${V.vurl ? `<video src="${V.vurl}" controls></video>` : ''}
        ${V.vname && !V.vurl ? `<p class="mu">${esc(V.vname)}</p>` : ''}
        <label>Caption (el mismo en todas las redes)<textarea id="cap" style="min-height:110px" placeholder="Escribe tu caption, hashtags y menciones…">${esc(V.caption)}</textarea></label>
        <p class="mu" id="cc" style="margin:4px 0">${V.caption.length} caracteres${V.caption.length > 2200 ? ' · Instagram permite máx. 2,200' : ''}</p>
        <div style="margin-top:10px">${sel}</div>
        <label>Programar (opcional)<input type="datetime-local" id="when" value="${esc(V.when)}"></label>
        <button class="btn" data-act="pub" ${conn.length ? '' : 'disabled'}>${V.when ? 'Programar' : 'Publicar'} en simultáneo</button>
        ${conn.length ? '' : ' <span class="mu">Conecta al menos una red.</span>'}${prog}
      </div>
      <div class="card"><h2>Historial</h2>${hist ? `<table><tr><th>Video</th><th>Redes</th><th>Caption</th><th>Estado</th></tr>${hist}</table>` : '<p class="mu">Sin publicaciones todavía.</p>'}</div>
    </div>
  </div>`;
}

// Genera un elemento visual de barra estadistica
function bar(l, v, m, c) {
  return `<div class="bar">
    <div class="row" style="justify-content:space-between"><span>${l}</span><b style="flex:0">${v}</b></div>
    <div class="t"><i style="width:${m ? Math.round(v / m * 100) : 0}%;background:${c}"></i></div>
  </div>`;
}

// Genera la vista del panel de accesos
function clubView() {
  const E = S.entries;
  const n = f => E.filter(f).length;

  const ven = n(e => e.tipo == 'vendida');
  const reg = n(e => e.tipo == 'regalada');
  const st = n(e => e.canal == 'story');
  const dm = n(e => e.canal == 'dm');
  const tq = n(e => e.canal == 'taquilla');
  const T = E.length;
  const mx = Math.max(1, ven, reg);
  const mc = Math.max(1, st, dm, tq);

  const rows = E.slice().reverse().map(e => `<tr>
    <td>${esc(e.nombre)}</td>
    <td><span class="tag">${e.tipo == 'vendida' ? 'Vendida' : 'Regalada'}</span></td>
    <td>${CANAL[e.canal]}</td>
    <td>${esc(e.fecha)}</td>
    <td><button class="btn ghost sm" data-act="dele" data-v="${e.id}">Quitar</button></td>
  </tr>`).join('');

  return `<div class="stats">
    <div class="stat"><span class="mu">Accesos totales</span><b>${T}</b></div>
    <div class="stat"><span class="mu">Vendidos</span><b>${ven}</b></div>
    <div class="stat"><span class="mu">Regalados</span><b>${reg}</b></div>
    <div class="stat"><span class="mu">Registros por story</span><b style="color:var(--ac2)">${st}</b>${T ? Math.round(st / T * 100) + '% del total' : ''}</div>
  </div>
  <div class="grid2">
    <div class="card">
      <h2>Registrar acceso</h2>
      <label>Nombre o @usuario<input id="e-n"></label>
      <label>Tipo de acceso<select id="e-t"><option value="vendida">Entrada vendida</option><option value="regalada">Entrada regalada</option></select></label>
      <label>Canal de registro<select id="e-c">${Object.keys(CANAL).map(k => `<option value="${k}">${CANAL[k]}</option>`).join('')}</select></label>
      <label>Fecha del evento<input type="date" id="e-f" value="${new Date().toISOString().slice(0, 10)}"></label>
      <button class="btn" data-act="adde">Agregar</button> 
      <button class="btn ghost" data-act="seed">Cargar ejemplo</button>
      <p class="err" id="err"></p>
    </div>
    <div>
      <div class="card">
        <h2>Vendidos vs. regalados</h2>
        ${bar('Vendidos', ven, mx, 'var(--ac)')}
        ${bar('Regalados', reg, mx, 'var(--ac2)')}
        <h3 style="margin-top:16px">Por canal de acceso</h3>
        ${bar('Story de Instagram', st, mc, 'var(--ac2)')}
        ${bar('Mensaje directo (lista)', dm, mc, 'var(--ac)')}
        ${bar('Taquilla', tq, mc, 'var(--ok)')}
      </div>
      <div class="card">
        <h2>Lista de accesos</h2>
        ${rows ? `<div style="overflow-x:auto"><table><tr><th>Nombre</th><th>Tipo</th><th>Canal</th><th>Fecha</th><th></th></tr>${rows}</table></div>` : '<p class="mu">Aún no hay accesos registrados.</p>'}
      </div>
    </div>
  </div>`;
}

// ============================================================================
// 5. FUNCIÓN PRINCIPAL DE RENDERIZADO
// ============================================================================

function render() {
  const a = $('#app');

  if (!S.session) {
    a.innerHTML = authView();
    return;
  }

  const T = { drafts: 'Borradores y guiones', pub: 'Publicar', club: 'Accesos del antro' };

  a.innerHTML = `<header>
    <div class="logo">OaHacks</div>
    <div class="row" style="flex:0">
      ${getThemeBtnHTML()}
      <span class="mu">@${esc(S.session.u)}</span>
      <button class="btn ghost sm" data-act="out">Salir</button>
    </div>
  </header>
  <nav class="tabs">
    ${Object.keys(T).map(k => `<button data-act="tab" data-v="${k}" class="${V.tab == k ? 'on' : ''}">${T[k]}</button>`).join('')}
  </nav>
  ${V.tab == 'drafts' ? draftsView() : V.tab == 'pub' ? pubView() : clubView()}`;
}

// ============================================================================
// 6. CONTROLADORES DE ACCIÓN Y VALIDACIONES
// ============================================================================

const err = m => { const e = $('#err'); if (e) e.textContent = m; };
const okMail = s => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);
const okUser = s => /^[a-zA-Z0-9_.]{3,20}$/.test(s);

const A = {
  mode: v => { V.auth = v; render(); },

  async signup() {
    const em = $('#em').value.trim().toLowerCase();
    const pw = $('#pw').value;
    const u = $('#un').value.trim();

    if (!okMail(em)) return err('Escribe un correo válido.');
    if (pw.length < 6) return err('La contraseña debe tener al menos 6 caracteres.');
    if (!okUser(u)) return err('Usuario: 3 a 20 letras, números, punto o guion bajo.');
    if (S.users.some(x => x.em == em)) return err('Ese correo ya está registrado.');
    if (S.users.some(x => x.u.toLowerCase() == u.toLowerCase())) return err('Ese nombre de usuario ya existe.');

    S.users.push({ em, u, h: await hash(pw) });
    S.session = { em, u };
    save();
    render();
  },

  async login() {
    const em = $('#em').value.trim().toLowerCase();
    const h = await hash($('#pw').value);
    const x = S.users.find(x => x.em == em && x.h == h);

    if (!x) return err('Correo o contraseña incorrectos.');
    S.session = { em: x.em, u: x.u };
    save();
    render();
  },

  g1() { V.g = 1; render(); },
  g0() { V.g = 0; render(); },
  g2() {
    const m = $('#gm').value.trim().toLowerCase();
    if (!okMail(m)) return err('Escribe un correo válido.');
    const x = S.users.find(x => x.em == m);
    if (x) {
      S.session = { em: x.em, u: x.u };
      V.g = 0;
      save();
      return render();
    }
    V.gmail = m;
    V.g = 2;
    render();
  },
  g3() {
    const u = $('#gu').value.trim();
    if (!okUser(u)) return err('Usuario: 3 a 20 letras, números, punto o guion bajo.');
    if (S.users.some(x => x.u.toLowerCase() == u.toLowerCase())) return err('Ese nombre de usuario ya existe.');
    S.users.push({ em: V.gmail, u, h: 'google' });
    S.session = { em: V.gmail, u };
    V.g = 0;
    save();
    render();
  },

  out() { S.session = null; save(); render(); },
  tab(v) { V.tab = v; render(); },

  newd() {
    const d = { id: uid(), t: 'Nuevo borrador', k: 'b', b: '', u: Date.now() };
    S.drafts.unshift(d);
    V.cur = d.id;
    save();
    render();
  },

  open(v) { V.cur = v; V.saved = ''; render(); },

  dup() {
    const d = S.drafts.find(x => x.id == V.cur);
    const n = { ...d, id: uid(), t: d.t + ' (copia)', u: Date.now() };
    S.drafts.unshift(n);
    V.cur = n.id;
    save();
    render();
  },

  deld() {
    if (!confirm('¿Eliminar este texto?')) return;
    S.drafts = S.drafts.filter(x => x.id != V.cur);
    V.cur = null;
    save();
    render();
  },

  tpl() {
    const d = S.drafts.find(x => x.id == V.cur);
    d.k = 'g';
    d.b += (d.b ? '\n\n' : '') + 'GANCHO (0–3 s):\n\nDESARROLLO:\nEscena 1 —\nEscena 2 —\nEscena 3 —\n\nCIERRE Y LLAMADO A LA ACCIÓN:\n';
    d.u = Date.now();
    save();
    render();
  },

  usecap() {
    const d = S.drafts.find(x => x.id == V.cur);
    V.caption = d.b;
    V.tab = 'pub';
    render();
  },

  conn(v) { S.conns[v] = S.conns[v] ? 0 : 1; V.nets[v] = 1; save(); render(); },

  connall() {
    Object.keys(NET).forEach(k => { S.conns[k] = 1; V.nets[k] = 1; });
    save();
    render();
  },

  pub() {
    const ns = Object.keys(NET).filter(k => S.conns[k] && V.nets[k]);
    if (!V.vname) return alert('Selecciona un video.');
    if (!V.caption.trim()) return alert('Escribe un caption.');
    if (!ns.length) return alert('Elige al menos una red.');

    const w = V.when, p = {};
    ns.forEach(k => p[k] = w ? 'Programado' : 'Subiendo…');
    V.prog = p;
    render();

    let done = 0;
    ns.forEach((k, i) => setTimeout(() => {
      V.prog[k] = w ? 'Programado ✓' : 'Publicado ✓';
      done++;
      if (done == ns.length) {
        S.posts.push({ v: V.vname, cap: V.caption, n: ns, w });
        save();
      }
      if (V.tab == 'pub') render();
    }, w ? 300 * (i + 1) : 900 + i * 700));
  },

  adde() {
    const n = $('#e-n').value.trim();
    if (!n) return err('Escribe un nombre.');
    S.entries.push({
      id: uid(),
      nombre: n,
      tipo: $('#e-t').value,
      canal: $('#e-c').value,
      fecha: $('#e-f').value
    });
    save();
    render();
  },

  dele(v) {
    S.entries = S.entries.filter(e => e.id != v);
    save();
    render();
  },

  seed() {
    const N = ['Ana', 'Luis', 'Sofía', 'Diego', 'Valeria', 'Marco', 'Paola', 'Iván', 'Renata', 'Hugo'];
    N.forEach((n, i) => S.entries.push({
      id: uid(),
      nombre: '@' + n.toLowerCase(),
      tipo: i % 3 == 0 ? 'vendida' : 'regalada',
      canal: i % 3 == 0 ? 'taquilla' : i % 3 == 1 ? 'story' : 'dm',
      fecha: new Date().toISOString().slice(0, 10)
    }));
    save();
    render();
  }
};

// ============================================================================
// 7. MANEJADORES DE EVENTOS Y DELEGACIÓN
// ============================================================================

// Escucha clics globales (Maneja acciones [data-act] y el botón de tema #theme-toggle)
document.addEventListener('click', e => {
  if (e.target.closest('#theme-toggle')) {
    toggleTheme();
    return;
  }
  const t = e.target.closest('[data-act]');
  if (t && A[t.dataset.act]) A[t.dataset.act](t.dataset.v);
});

// Escucha la edición en tiempo real de campos
document.addEventListener('input', e => {
  const t = e.target, d = S.drafts.find(x => x.id == V.cur);

  if (t.id == 'd-t' || t.id == 'd-b') {
    d[t.id == 'd-t' ? 't' : 'b'] = t.value;
    d.u = Date.now();
    V.saved = 'Guardado';
    save();
    $('#wc').textContent = wc(d.b) + ' palabras · Guardado';
  } else if (t.id == 'cap') {
    V.caption = t.value;
    $('#cc').textContent = t.value.length + ' caracteres' + (t.value.length > 2200 ? ' · Instagram permite máx. 2,200' : '');
  } else if (t.id == 'when') {
    V.when = t.value;
  } else if (t.dataset.net) {
    V.nets[t.dataset.net] = t.checked ? 1 : 0;
  }
});

// Escucha cambios en controles de selección o subida de archivos
document.addEventListener('change', e => {
  const t = e.target;

  if (t.id == 'd-k') {
    const d = S.drafts.find(x => x.id == V.cur);
    d.k = t.value;
    save();
    render();
  } else if (t.id == 'vid' && t.files[0]) {
    if (V.vurl) URL.revokeObjectURL(V.vurl);
    V.vname = t.files[0].name;
    V.vurl = URL.createObjectURL(t.files[0]);
    render();
  } else if (t.id == 'when') {
    V.when = t.value;
    render();
  }
});

// ============================================================================
// 8. ARRANQUE DE LA APLICACIÓN
// ============================================================================

// Aplica el tema guardado/preferido en el HTML inicial
document.documentElement.setAttribute('data-theme', getPreferredTheme());

// Renderiza la aplicación por primera vez
render();