# PROYECTO — Asistente de Chat con IA (Copiloto)

> Documento vivo. Aquí llevamos la **idea, las decisiones y lo pendiente**.
> Se actualiza cada vez que definimos algo. Si cambiamos de conversación, se retoma desde aquí.

Última actualización: 2026-06-30

---

## 1. ¿Qué es? (la visión en una frase)
Un programa de escritorio para Windows que le **sugiere respuestas** a una chica webcam
mientras chatea con sus usuarios, para que no se agote repitiendo lo mismo ni tenga que
estar "encendida" todo el tiempo. La IA corre **local, gratis y sin internet**.

## 2. ¿Para quién?
- **Usuaria final:** una chica webcam (la clienta que compra el programa).
- **Autor/vendedor:** Sinfi (desarrolla y le vende el programa).

## 3. Cómo funciona (modo COPILOTO)
1. El usuario le escribe algo a ella en la plataforma.
2. Ella **pega** ese mensaje en el programa.
3. La IA **sugiere** una respuesta apropiada según la personalidad y el historial.
4. Ella la lee, la ajusta si quiere, y **ella misma la envía** en su plataforma.
   → El programa NO se conecta a la plataforma de cam (más seguro, sin romper reglas).

---

## 4. DECISIONES YA TOMADAS ✅
- **Modo:** Copiloto (sugiere, ella envía). NO automático.
- **Contenido:** Adulto y **adaptable al tono** del usuario (a veces picante, a veces solo charla/compañía).
- **Modelo IA:** Local, sin censura, bueno en español, tamaño 7B–8B. (Se probarán 2–3 y se elige.)
- **Todo gratis:** sin suscripciones, sin pagos, sin cuentas, sin nube. 100% offline tras instalar.
- **Portable:** se construye una vez y se entrega como **instalador `.exe`** que ella puede mover
  a distintas PCs (con RAM suficiente: ideal 16–32 GB).
- **Datos en local:** usuarios, chats, memoria y config guardados en su PC (SQLite). Sin límite de espacio práctico.
- **Interfaz:** en español.
- **Pantalla:** barra lateral con **conversaciones recientes** + **buscador** de clientes viejos;
  panel central con el chat; zona de configuración.

## 5. HARDWARE de la usuaria (confirmado)
- Portátil **Lenovo ThinkPad Z13**.
- CPU: **AMD Ryzen 7 PRO 6850U** (8 núcleos / 16 hilos).
- RAM: **32 GB LPDDR5** (excelente).
- GPU: **Radeon 680M integrada** (no dedicada) → se usa modo compatible (CPU/universal).
- SSD NVMe · Windows 11 Pro.
- **Veredicto:** viable. Modelos 7B–8B a ~3–10 s por respuesta. Suficiente para copiloto.

## 6. STACK TÉCNICO (lo maneja Sinfi/Claude, no la usuaria)
- App escritorio: **Electron + React**.
- Motor IA: **node-llama-cpp** (llama.cpp embebido, modo CPU/universal).
- Base de datos: **SQLite**.
- Empaquetado: **electron-builder** → un solo `.exe`.

## 7. PLAN POR FASES
1. Esqueleto visual (barra lateral + chat + config, sin IA).
2. Base de datos (crear usuarios, guardar/buscar conversaciones).
3. Conectar la IA (generar sugerencias).
4. Personalidad + memoria (config de tono, recordar conversaciones, resúmenes).
5. Afinar modelo y tono adulto/adaptable.
6. Empaquetar instalable portable.

---

## 8. DEFINICIÓN DE LA APP (respuestas del cuestionario) ✅

### 🧍 Personalidad de la IA
- **Un solo personaje** (ella, "Dahia"), pero con **personalidad 100% moldeable por un prompt** que
  la usuaria escribe/ajusta. Nada de personalidad fija: la escoge ella.
- **Límites (lo único prohibido):** nada ilegal, jamás continuar conversación con menores, nada ilegal
  en general. Picante y morboso SÍ, pero siempre dentro de lo legal.

### 💬 Sugerencias de respuesta
- **3 opciones** por defecto (cantidad **configurable/moldeable**).
- Al hacer clic en la que le gusta → **queda guardada en el historial de ese chat** como su respuesta
  **y se copia automáticamente al portapapeles** (para que ella solo pegue en su plataforma).
  Objetivo: **rápido y no tedioso**.
- **Longitud adaptable:** ni muy larga ni fría/cortante. Lo justo según la conversación.
- **Emojis naturales:** que NO parezca IA. De las 3 opciones, típicamente **una lleva emojis**;
  y cuando los use, que se comporte como persona real (repite el mismo emoji para enfatizar,
  no uno "de catálogo" distinto para cada cosa). No siempre emojis.

### ⚙️ Parámetros configurables por chat
- **Modo/tono:** charla / coqueto / explícito (y lo que definamos), configurable por conversación.
- **Idioma:** configurable de forma **rápida** (clientes en español, inglés, etc.).

### 👥 Clientes / usuarios
- **Datos por cliente:** nombre/apodo, gustos, qué le excita, idioma, cosas que dijo,
  cuánto suele gastar. (Todos aprobados.)
- **Notas manuales** de ella sobre cada cliente (además de lo que la IA recuerde sola). ✅
- **Etiquetas** para clasificar clientes (VIP, habitual, nuevo, pesado…). ✅
- **Muchos chats en paralelo** (es la razón de ser del programa: atiende a varios a la vez).
- La IA **recuerda** cada conversación (memoria + resúmenes para las largas).

### 🖥️ Uso diario
- **Respuestas rápidas guardadas:** por ahora NO (posible futuro).
- Barra lateral con **conversaciones recientes** (acceso rápido) + **buscador** de clientes viejos.

### 🎨 Aspecto (hereda la identidad de la app Dahia)
- **Modo claro y oscuro con switch.** ✅
- **Estilo:** el mismo de la app de finanzas de Dahia → **rosa pastel + glassmorphism (cristal)**,
  limpio, minimalista pero vivo, tierno/kawaii equilibrado.
- **Ícono/logo:** el gatito rosa de Dahia.
  Origen: `C:\Users\Sinfi\OneDrive\Infiniity Eventos\APP ZEVEN\APP DAHIA\logo-dahia.png`
- Modo oscuro = versión "rosadita nocturna" (como en su otra app).

---

## 9. FLUJO DE USO (cómo se usa en el día a día)
1. Llega un mensaje de un usuario en su plataforma de cam.
2. Ella lo **pega** en el chat de ese cliente dentro del programa.
3. La IA genera **3 sugerencias** (según personalidad + modo + idioma + memoria del cliente).
4. Ella hace clic en la que más le gusta → **se copia al portapapeles** y **queda en el historial**.
5. Ella pega la respuesta en su plataforma. Siguiente mensaje → se repite.
   → Todo manual del lado de la plataforma (el programa NO se conecta a la web de cam).

---

## 10. DECISIONES FINALES ✅
- **Nombre del programa:** **Dahia Chat**.
- **Idioma:** se fija **por cada chat** (cada cliente tiene el suyo).
- **Personalidad:** **una global** (quién es ella) **+ ajuste fino por chat** cuando quiera para un cliente especial.
- **Entrada:** con **ayuda del portapapeles** (el programa detecta cuando ella copia y lo carga solo).

---

## 11. MOTOR DE IA — LOCAL + PLAN B DE PAGO (agnóstico) ✅
La app se diseña **"agnóstica de motor"**: un interruptor en ajustes para cambiar de fuente de IA sin rehacer nada.
- **Modo Local** (plan A): gratis, offline, privado. Modelo 7B–8B sin censura.
- **Modo API** (plan B / red de seguridad): de pago, económico, si la local no convence.
  Corre modelos más grandes/mejores sin exigirle a la PC, pero **requiere internet** y los chats
  **salen de la PC** hacia el proveedor (menos privado).
- **Proveedores de pago que SÍ permiten contenido adulto** (las mainstream tipo ChatGPT/Claude/Gemini lo prohíben):
  - **OpenRouter** — pago por uso (centavos), acceso a modelos sin censura. Muy flexible.
  - **Featherless / ArliAI / Infermatic** — mensualidad plana (~USD 9–25), "barra libre" de modelos roleplay sin censura.
  - **DeepInfra / Together** — pago por uso, modelos abiertos sin censura.
- **Estado:** dejar el modo API **listo para conectar pero apagado por defecto**. Plan A sigue siendo local.

## 12. ATAJO GLOBAL (abrir la app desde cualquier programa) ✅
- Ella **selecciona** el mensaje del cliente en su plataforma y presiona un **atajo global**.
- Dahia Chat **aparece al instante** con ese texto ya cargado + un **selector de a qué chat/cliente va**.
- Elige el chat → salen las sugerencias → pica una → se copia sola → la pega en su plataforma.
- **Atajo por defecto:** `Ctrl+Shift+D` (NO `Ctrl+T` porque choca con "nueva pestaña" del navegador).
  **Configurable** por si prefiere otro.
- Encaja con la decisión del portapapeles: máxima rapidez, sin buscar la app en la barra de tareas.
- **Al aparecer con el atajo:** muestra los chats en orden de **más recientes**, con **buscador** y botón **"Nuevo chat"**.

## 13. IDENTIFICACIÓN DEL CLIENTE ✅
- Cada cliente se registra e identifica por su **nombre de usuario** (el de su plataforma de cam).
- La **búsqueda** es por ese nombre de usuario (+ etiquetas).

---

## 14. ESTADO DEL PROYECTO
- **2026-06-30:** Definición cerrada. Iniciando **Fase 1 — Esqueleto visual** (Electron + React,
  estilo gatito rosa / glassmorphism, claro-oscuro). Sin IA ni datos reales todavía.
- **2026-06-30:** ✅ **Fase 1 COMPLETADA.** App Electron+React funcionando (`npm run dev`).
  - Barra lateral (logo gatito, buscador, "Nuevo chat", conversaciones recientes con badges).
  - Panel de chat (burbujas, modo/idioma/etiquetas, pegar mensaje + botón Generar + 3 sugerencias).
  - Al elegir sugerencia: se copia al portapapeles (IPC Electron) + queda en el historial.
  - Ficha de cliente (idioma, modo, etiquetas, memoria, notas manuales).
  - Switch claro/oscuro. Atajo global Ctrl+Shift+D (demo de captura de portapapeles).
  - Todo con datos de ejemplo (mock), sin IA ni base de datos aún.
  - Estructura: electron-vite · src/main · src/preload · src/renderer (React+TS).
  - **Siguiente:** Fase 2 (base de datos SQLite: clientes/chats reales, guardar y buscar).
- **Actualizaciones (decidido):** **Opción A — automática** (electron-updater + GitHub Releases).
  Descarga solo lo que cambió (el modelo/cerebro NO se re-descarga). Los datos de ella se conservan.
  Se implementa en Fase 6. Solo el PRIMER instalado es el pesado.
- **2026-06-30:** Iniciando **Fase 2 — Base de datos** (clientes/chats/notas reales, guardar y buscar).
- **2026-06-30:** ✅ **Fase 2 COMPLETADA.** Base de datos real funcionando y persistente.
  - Motor: **sql.js** (SQLite en WASM, JS puro). Se descartó better-sqlite3 porque exige compilar
    con Visual Studio (no instalado). sql.js NO compila nada → portable idéntico en cualquier PC. ✔
  - Archivo de datos: `%APPDATA%\dahia-chat\dahia.db` (fuera del programa → las actualizaciones NO lo borran).
  - Tablas: `clients` (usuario, tags, idioma, modo, memoria, notas) y `messages` (por cliente).
  - IPC main↔renderer: listClients/getClient/createClient/updateClient/deleteClient/addMessage.
  - La UI ya NO usa datos falsos: crea clientes reales, guarda mensajes elegidos, edita ficha
    (idioma, modo, etiquetas, memoria, notas) y todo persiste al cerrar/abrir.
  - Verificado en ejecución: 3 clientes + 6 mensajes guardados y leídos correctamente.
  - **Siguiente:** Fase 3 (conectar la IA local para generar las sugerencias reales).
- **2026-07-01:** 🔄 **Fase 3 EN CURSO — IA local.**
  - Motor: **node-llama-cpp v3** instalado. Se importa de forma diferida (ESM) desde el main CJS.
  - ✅ Verificado en su PC: backend **Vulkan** activo con **8.27 GB VRAM** (Radeon 680M) → el modelo
    corre en la gráfica integrada, no solo CPU. Más rápido de lo previsto.
  - **Modelo elegido:** DarkIdol-Llama-3.1-8B-Instruct-1.2-Uncensored **Q4_K_M** (4.92 GB).
    Basado en Llama 3.1 (buen español), afinado roleplay, sin censura. Regla: si no convence, se BORRA.
  - Carpeta única de modelos: `models/` (dev) → `%APPDATA%\dahia-chat\models\` (instalado). Borrar = 1 archivo.
  - Código listo: `src/main/ai.ts` (carga modelo, construye personalidad+tono+idioma+memoria, genera N
    opciones y las parsea), `src/main/settings.ts` (config global en JSON).
  - UI: botón "✨ Generar" ya llama a la IA real (estado "Pensando…", manejo de errores).
    Modal de **Ajustes ⚙️**: nombre del personaje, personalidad global (prompt moldeable), nº de
    sugerencias, estado del modelo.
  - ✅ **Fase 3 COMPLETADA.** Modelo descargado y **generación real verificada**.
    - Prueba: cliente coqueto en español → 3 opciones naturales, en personaje, solo una con emoji. ✔
    - Velocidad: carga ~13 s (una vez al abrir) + ~13 s la 1ª generación (calienta Vulkan);
      siguientes más rápidas. Usable para copiloto.
    - **Modelo DarkIdol APROBADO, se queda.** Corre en Vulkan (Radeon 680M).
  - 🔧 **Fix:** botón "Nuevo chat" no funcionaba porque Electron bloquea `window.prompt()`.
    Reemplazado por un modal propio (`NewChatModal`). También se instalaron @types/react(-dom).
  - 🔧 **Fix (doble chat):** al cambiar de chat aparecía un panel "fantasma" duplicado.
    Causa: StrictMode + Fast Refresh remontaban el ChatPanel (vía `key`) y dejaban el viejo.
    Solución: quitado StrictMode, ChatPanel ya no se remonta (resetea estado con useEffect),
    y la ficha pasó a ser un **drawer lateral** (oculto por defecto, se abre con ℹ️). Layout ahora
    siempre 2 columnas (lista + chat) → más limpio. Solo ocurría en desarrollo; no en la app final.
  - ✅ **Cronómetro** añadido: cuenta en vivo en el botón ("💭 Pensando... 3.4s") y muestra el
    tiempo total junto a las sugerencias ("⏱️ generado en X.Xs").
  - ✅ **Atajo global funcional** (`Ctrl+Shift+D`): captura el texto del portapapeles y abre el
    selector "Respuesta rápida" (texto editable + recientes + buscador + nuevo cliente). Al elegir
    chat → genera automáticamente. Componente `QuickCapture`; ChatPanel recibe `prefill` (texto
    inyectado + nonce) y genera solo.
  - ✅ **Modo compacto:** barra lateral plegable a un riel de ~68px (solo avatares, con tooltip,
    punto de no leídos y ítem activo resaltado). Botón « para compactar / ☰ para expandir. Ancho
    mínimo de ventana bajado a 420px. Preferencia (compacto y tema) recordada en localStorage.
    Pensado para ponerla como franja lateral junto a la plataforma sin ocupar espacio.
  - ✅ **Memoria de conversaciones largas.** Cada cliente tiene un **resumen automático** (columnas
    `summary` + `summarized_count` en DB, con migración para DBs viejas). Los últimos 10 mensajes van
    tal cual + el resumen de todo lo anterior. Se resume solo cuando hay ≥8 mensajes nuevos fuera de
    la ventana reciente (justo antes de generar; no en cada respuesta). Función `ai.summarize`
    (temp 0.3). El resumen se muestra en la ficha como "🧠 Memoria automática (IA)".
    Verificado: de 9 mensajes extrajo nombre/ciudad/trabajo/gustos/cumpleaños/promesa/tono (6 s).
  - ✅ **Retroalimentación / aprendizaje global (IA):** botón 🚩 en cada sugerencia. Ella explica qué
    está mal (no viable/error de lógica o gramática) y queda como **corrección global** (tabla
    `corrections`) que se inyecta en el system prompt de TODAS las generaciones ("errores a evitar").
    Ejemplo real que motivó esto: cliente "me inspiras mucho" → opción mala "Me alegro que me
    inspires" (sujeto invertido) → debería ser "me alegra inspirarte". Se gestionan (ver/borrar) en
    Ajustes ⚙️. Es memoria de TODO el proyecto, no de un cliente.
  - ✅ **Gestión de clientes:** en la ficha, editar nombre de usuario (✏️) y borrar cliente (con
    confirmación de 2 pasos). Evita usuarios duplicados al crear (usernameExists).
  - ✅ **Pulido:** botón "🔄 Regenerar" (otras 3 opciones sin re-pegar), limpiar "no leídos" al abrir
    un chat, atajo con usuario existente enruta al chat en vez de duplicar.
  - 🔧 **Fix (alucinaciones):** el modelo inventaba contexto (ej. a "Hola como estas" respondía
    "qué bien que hayas salido"). Añadida regla "NO INVENTES" al system prompt (no asumir hechos que
    el usuario no dijo). Verificado: ya no inventa. También se bajó el contexto (gen 3072 / resumen
    2048) con `createContextSafe` que reintenta con menos si la VRAM está justa (robustez iGPU).
  - 🔧 **Fix (calidad "se queda corto"):** respuestas flojas/incoherentes. NO era el modelo, era la
    config. Cambios: temperatura 0.85→**0.7** (más coherencia), quitado el "3 opciones DISTINTAS"
    (forzaba variedad rara), prompt pide respuestas naturales/bien escritas que devuelvan la
    conversación, e IDIOMA exige "natural y correcto sin errores". Verificado: respuestas mucho
    mejores (coquetas, coherentes, preguntan de vuelta). DarkIdol se mantiene.
    Si algún día se quiere aún más calidad en español: candidatos Qwen2.5-7B uncensored o Mistral-Nemo 12B.
  - ✅ **Prompt base SÓLIDO** (reescrito con el criterio experto de Sinfi tras analizar varias tandas).
    Reglas fijas en el código (buildSystem): mujer real con voz propia · objetivo = enganchar y avanzar
    (según tono) · español correcto · NO repetir palabras del cliente (anti-eco, ej. "cachondo") ·
    máx un "!" · emoji con medida 0–1 consistente · NO inventar · GANCHO obligatorio (pregunta/
    insinuación que pase la iniciativa) · ESCALADA (no frenar si está caliente) · límites legales.
    La base es fija; Dahia solo cambia el TONO (charla/coqueto/explícito). Cambió la regla vieja de
    "una opción con emoji" → ahora "emoji con medida". Se sigue afinando probando con Regenerar.
  - ✅ **Mecánica de VENTA DEL PRIVADO** (regla de negocio clave, del criterio de Sinfi): cuando el
    cliente quiere ver/ir a más, la IA NO dice sí/no; mueve la zanahoria al privado con estructura de
    3 partes — (1) validar+calentar, (2) tease con promesa concreta (sin darlo gratis), (3) invitación
    clara al privado + razón ("aquí no, a la vista de todos"). Nunca gratis, nunca enfría, nunca "casi"
    vago. Se incluyeron 2 ejemplos few-shot en el prompt para que no rompa el español. Verificado:
    ahora sí insinúa qué verá y empuja al privado con gancho, en español correcto.
  - 🔧 **Fix (consistencia de las 3 opciones):** a veces 1 de 3 se olvidaba del privado (perdía la
    venta, porque cualquiera se puede enviar). El prompt de usuario ahora EXIGE que, si el cliente
    pide ver/ir a más, las 3 opciones muevan al privado (validar→tease→cierre CTA); ninguna puede
    regalar ni enfriar; varían en palabras, no en estructura. Verificado: las 3 empujan al privado.
    Nota: DarkIdol aún suelta algún nit de gramática ocasional (aceptable; se pule con 🚩 o, si molesta
    mucho, se evaluaría cambiar a Qwen2.5-7B/Mistral-Nemo).
  - 🔧 **Fix (foco + framing del privado):** dos bugs detectados por Sinfi — (1) INVERSIÓN DE FOCO:
    al cerrar giraba a "yo quiero verte a ti" (él paga para verla a ELLA) → regla "FOCO SIEMPRE EN ÉL,
    habla de lo que ÉL va a ver"; (2) FRAMING NEGATIVO: "aquí no puedo mostrarte" suena a barrera →
    regla "FRAMING POSITIVO: aquí un poco (probadita/aperitivo), allá todo". Ejemplos del prompt
    reescritos a estilo positivo. Añadido "evita palabras formales (desnudez/esplendor)". Verificado.
  - 🔬 **Evaluación rigurosa (rúbrica 3 capas de Sinfi) → CAMBIO DE MODELO.** Se reescribió el prompt
    base con las 3 capas (universales + adaptar al registro + no vender a destiempo) y se corrieron
    10 casos (saludo, caliente, personal/bajón, tierno, pregunta por ella, casual, objeción…).
    Resultado: DarkIdol falló 10/10 — **vende a destiempo** (mete el privado en momentos tiernos/
    personales/casuales) y **errores de gramática** recurrentes (m'hija, ¿quiere?/¿querés?, verte/verme).
    Es el techo del modelo. **Decisión: cambiar a Qwen2.5-7B-Instruct-abliterated-v2 (sin censura),
    mismo peso (~4.7 GB) pero mejor en instrucciones matizadas y español.** Se borra DarkIdol (cero basura).
    También se corrigió el prompt de turno para que lea el momento ANTES de vender.
  - ✅ **Modelo cambiado a Qwen2.5-7B-abliterated-v2** (4.36 GiB). DarkIdol BORRADO (cero basura).
  - 🏗️ **Arquitectura NUEVA — enrutador de dos pasos (clave para la consistencia):**
    Paso 1 = un mini-clasificador barato lee el momento del cliente → una palabra
    (caliente / tierno / personal / pregunta / casual / neutro). Paso 2 = generar con SOLO el guion
    de ese momento. En los registros NO sexuales el guion NI menciona la venta → **imposible vender
    a destiempo** (esto arregla el fallo que ni el prompt ni el cambio de modelo resolvían solos).
    Además: penalización de repetición (mata la degeneración/caracteres chinos de Qwen).
    Validado en las 10 pruebas: tierno/personal/pregunta ya NO venden; caliente sí con estructura.
    Pendiente de pulir: el clasificador a veces marca un saludo como "caliente" (mejorado con
    ejemplos few-shot), y nits sueltos.
    Archivos: `ai.ts` → `classifyRegister()`, `GUION` (guion por registro), `buildSystem(reg)`.
  - 🔬 **2ª batería (motor de 2 pasos):** arquitectura CONFIRMADA — cero venta a destiempo (tierno/
    personal/casual/pregunta ya no venden), clasificador 10/10, emojis rotos ":paso:" arreglados
    (regla + limpieza). Quedan micro-fallos de español de Qwen-Q4 (inglés "sweet", palabras pegadas
    "PuesResultaque", "canosos", tildes) → techo de calidad de Q4 abliterated.
  - 🔧 **Fixes de prompt:** solo-español (nada de inglés), emojis reales o ninguno (nunca :nombre:),
    limpieza de placeholders en clean(), y manejo de objeción "muéstrame gratis" en guion caliente.
  - ⬆️ **Subiendo el modelo a Qwen Q5_K_M** (mejor calidad que Q4, misma velocidad, cabe en VRAM).
    Se DESCARTÓ Nemo-12B por lento en su iGPU (mata la usabilidad con muchos clientes). Se borra el Q4.
  - ❌ **Q5 reveló DEALBREAKER de Qwen:** en una prueba, una opción se degeneró en un PÁRRAFO EN
    CHINO; el clasificador se volvió inestable (leyó saludo/tierno como caliente → vendió mal);
    volvió la inversión de foco e inventó un precio. Qwen (chino + abliterated) tiene fuga de chino
    e inestabilidad → INACEPTABLE para producto. **Qwen DESCARTADO (ambos quants).**
  - ⬆️ **Cambio a Rocinante-12B-v1.1** (basado en Mistral-Nemo, europeo, sin riesgo de chino, afinado
    para roleplay adulto). Se MIDE velocidad real en su iGPU: si aceptable → gana por calidad;
    si muy lento → fallback a un Mistral-7B. La ARQUITECTURA de 2 pasos se mantiene (es model-agnóstica).
  - **Siguiente:** test de calidad + VELOCIDAD de Rocinante; decidir; borrar los descartados; Fase 6.
- **2026-07-21:** 🌩️ **MODO API (OpenRouter) IMPLEMENTADO** (antes era solo un placeholder). Se
  decidió pagar API porque ningún modelo local convenció. Arquitectura de 2 modelos, elegida con
  pruebas reales:
  - **Generador:** `thedrummer/cydonia-24b-v4.1` (roleplay sin censura, ~3-4s, buen español).
    Alternativas en Ajustes: Euryale 70B (más calidad, más lento), Rocinante 12B (más barato).
  - **Clasificador:** `mistralai/ministral-14b-2512` (acertó 6/6; los de roleplay clasifican mal,
    ej. Cydonia mandó "muéstrame las tetas" a *personal*).
  - **DeepSeek V4 descartado**: es razonador → lento y caro para chat en vivo.
  - `provider: { sort: 'throughput' }` para evitar proveedores lentos (algunos tardaban 15-20s).
  - Selector **Local/API** + llave + modelo en Ajustes ⚙️. La llave se guarda en userData, no en git.
  - Costo real ~$0.0001 USD (~$0.53 COP) por generación → $20.000 COP/mes alcanza de sobra.
- **2026-07-21:** ✅ **Contador de gasto** en la barra lateral (modo API): gasto del mes en pesos con
  barra de progreso vs el tope de la llave, gasto de hoy, crédito restante, y el costo de cada
  generación junto al tiempo. Usa los datos que OpenRouter ya calcula (`/api/v1/key`), no una DB local.
- **2026-07-21:** ✅ **Atajo Ctrl+Shift+D mejorado**: ahora copia la SELECCIÓN sola (SendKeys en
  Windows), un paso menos. (Validar en el .exe.)
- **2026-07-21:** 🔧 **Auto-actualización implementada** (electron-updater + GitHub Releases, Fase 6):
  módulo `updater.ts` (revisa al abrir + cada 6h, descarga en segundo plano, ofrece reiniciar; datos
  y modelo se conservan) + bloque `publish` en electron-builder.yml. **Pendiente:** crear el repo de
  GitHub y poner owner/repo en la config.
- **DECISIÓN llave:** la llave de OpenRouter es **de ella** (Sinfi maneja su cuenta). Se embebe SU
  llave en SU instalador, con **tope de crédito** para no pasarse. (Sembrado de la llave por defecto:
  se cablea al empaquetar.)
- **2026-07-21:** 🚫🧠 **FIX CLAVE — la IA ya NO inventa datos de ella (es una persona REAL).**
  Bug detectado por Sinfi: a "hablame sobre ti" daba 3 opciones con datos inventados y CONTRADICTORIOS
  (24 de Barcelona / argentina / 26 años). Causa: el guion de "pregunta" decía "inventa detalles".
  Solución (perfil real + preguntar-cuando-falta):
  - **Perfil real de Dahia** (tabla `persona_facts`, global, persistente para siempre): edad, ciudad,
    a qué se dedica, etc. Se inyecta en el prompt como "TUS DATOS REALES" + regla dura "NUNCA inventes
    datos personales tuyos; usa solo esto".
  - **Detección de dato faltante:** solo cuando el registro es "pregunta", un chequeo barato
    (ministral) mira si el cliente pide un dato que NO tenemos. Si falta → la app NO genera: abre un
    modal (`AskFactModal`) que se lo pide a ELLA; ella lo escribe una vez, se guarda para siempre
    (`db.upsertFact`) y se regenera con el dato real. El filtro por "pregunta" evita falsos positivos.
  - Editable en Ajustes ⚙️ → "🙋 Sobre mí — datos reales" (ver/añadir/borrar).
  - Archivos: `db.ts` (persona_facts + listFacts/upsertFact/deleteFact), `ai.ts` (buildFacts,
    detectMissingFact, classify expuesto, GUION.pregunta reescrito), `index.ts` (orquesta: clasifica→
    si falta dato devuelve `needFact`→si no, genera con facts+register), `AskFactModal`, Ajustes.
- **2026-07-21:** 🛡️ **Robustez ante caídas de proveedores** (la app se colgaba cuando Cydonia daba
  502/hang). Fixes en `ai.ts`:
  - **Timeout de 10s** por intento (AbortController) → nunca "pensando" eterno; si tarda, salta.
  - **Cadena de respaldo de modelos** con PROVEEDORES DISTINTOS: principal Cydonia 24B → Euryale 70B
    (NextBit) → Hermes-3 70B (DeepInfra, muy confiable) → Mythomax 13B (NextBit). Si uno da 502/429/
    timeout, salta solo al siguiente. Casi imposible que fallen todos.
  - Mensaje claro en UI si fallan todos ("servidores saturados, intenta en unos segundos").
  - Nota: los modelos de TheDrummer (Cydonia/Rocinante) tienen proveedores intermitentes; por eso el
    respaldo en DeepInfra es clave.
