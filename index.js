const { Telegraf } = require('telegraf');
const axios = require('axios');
//const pdfParse = require('pdf-parse');
const Tesseract = require('tesseract.js');

// Importar configuración de Firebase
const { database } = require('./firebaseConfig');

// Variables globales
let saldoAcumulado = 0;
let avisoMillonHecho = false;

// Inicializar el bot de Telegram
const bot = new Telegraf(process.env.BOT_TOKEN);
const GRUPO_DESTINO_ID = -4676268485; // Reemplaza con tu ID de grupo si lo usas

// Función para cargar el estado desde Firebase
async function cargarEstado() {
  try {
    const storedSaldo = await database.ref('estado/saldo').once('value');
    const storedAviso = await database.ref('estado/avisoMillonHecho').once('value');

    saldoAcumulado = storedSaldo.val() || 0;
    avisoMillonHecho = storedAviso.val() || false;

    console.log(`Estado cargado de Firebase: Saldo ${saldoAcumulado}, Aviso ${avisoMillonHecho}`);
  } catch (error) {
    console.error('❌ Error cargando estado desde Firebase:', error);
    saldoAcumulado = 0;
    avisoMillonHecho = false;
  }
}

// Función para guardar el estado en Firebase
async function guardarEstado() {
  try {
    await database.ref('estado/saldo').set(saldoAcumulado);
    await database.ref('estado/avisoMillonHecho').set(avisoMillonHecho);

    console.log('✅ Estado guardado en Firebase.');

    // Además de guardar en DB, seguir enviando un mensaje al admin como backup visual
    const adminChatId = process.env.ADMIN_CHAT_ID;
    if (adminChatId) {
      const mensajeEstado = `🔄 *Estado actualizado:*\n💰 Saldo: ${formatearImporte(saldoAcumulado)}\n🎉 Aviso millón: ${avisoMillonHecho ? 'Sí' : 'No'}`;
      await bot.telegram.sendMessage(adminChatId, mensajeEstado, { parse_mode: 'Markdown', disable_notification: true })
        .catch(err => console.error('Error enviando mensaje de estado al admin:', err));
    }
  } catch (error) {
    console.error('❌ Error guardando estado en Firebase:', error);
  }
}

// Funciones auxiliares
function formatearImporte(numero) {
  return '$' + parseFloat(numero).toFixed(2)
    .replace('.', ',')
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function verificarUmbral(ctx) {
  if (!avisoMillonHecho && saldoAcumulado >= 1000000) {
    avisoMillonHecho = true;
    ctx.reply(`🎉 ¡El saldo acumulado alcanzó ${formatearImporte(saldoAcumulado)}!`);
    // Guardar el estado después de verificar el umbral (ya que avisoMillonHecho cambió)
    guardarEstado();
  }
}

// Comandos del bot
bot.command('agregar', async (ctx) => {
  const partes = ctx.message.text.split(' ');
  if (partes.length < 2) {
    return ctx.reply('⚠️ Usá el comando así: /agregar 1234.56');
  }

  const valor = parseFloat(partes[1].replace(',', '.'));
  if (isNaN(valor)) {
    return ctx.reply('❌ El valor ingresado no es válido.');
  }

  saldoAcumulado += valor;
  await guardarEstado(); // <<-- Guardar estado después de modificarlo

  ctx.reply(`✅ Se sumó ${formatearImporte(valor)}. Saldo acumulado: ${formatearImporte(saldoAcumulado)}`);
  verificarUmbral(ctx);
});

bot.command('saldo', (ctx) => {
  // El saldo ya está cargado en la variable global
  ctx.reply(`💰 Saldo acumulado: ${formatearImporte(saldoAcumulado)}`);
});

bot.command('reset', async (ctx) => {
  saldoAcumulado = 0;
  avisoMillonHecho = false;

  await guardarEstado(); // <<-- Guardar estado después de modificarlo

  ctx.reply('🔄 Saldo reiniciado a $0,00');
});

bot.command('restaurar', async (ctx) => {
  const partes = ctx.message.text.split(' ');
  if (partes.length < 2) {
    return ctx.reply('⚠️ Usá: /restaurar 1234.56');
  }

  const valor = parseFloat(partes[1].replace(',', '.'));
  if (isNaN(valor)) {
    return ctx.reply('❌ El valor ingresado no es válido.');
  }

  saldoAcumulado = valor;
  await guardarEstado(); // <<-- Guardar estado después de modificarlo

  ctx.reply(`🔄 Saldo restaurado a: ${formatearImporte(saldoAcumulado)}`);
});

bot.command('ayuda', (ctx) => {
  const ayuda = `
📌 *Comandos disponibles:*

💵 *Comandos de saldo:*

• \`/agregar <importe>\` – Suma un importe manual al saldo acumulado.  
  _Ejemplo:_ \`/agregar 1234.56\`

• \`/saldo\` – Muestra el saldo acumulado actual.

• \`/reset\` – Reinicia el saldo a \`$0,00\` y borra el aviso de millón.

• \`/restaurar <importe>\` – Restaura el saldo a un valor específico.  
  _Ejemplo:_ \`/restaurar 500000\`

🎉 *Aviso automático:*  
Cuando el saldo acumulado llega o supera *$1.000.000,00*, el bot avisa automáticamente.

✅ *Nota:* El saldo se guarda de forma persistente en Firebase, por lo que no se perderá entre reinicios.
`;
  ctx.replyWithMarkdown(ayuda);
});

// Configuración y lanzamiento del bot
async function startBot() {
  await cargarEstado(); // Carga el estado inicial desde Firebase
  bot.launch(); // Inicia el bot en modo polling (escuchando mensajes)
  console.log('🤖 Bot de Telegram activo y escuchando...');
}

// Inicia el bot
startBot();

// Manejo de señales para detener el bot limpiamente
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));