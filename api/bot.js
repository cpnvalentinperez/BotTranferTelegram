const { Telegraf } = require('telegraf');
const axios = require('axios');
const pdfParse = require('pdf-parse');
const Tesseract = require('tesseract.js');
require('dotenv').config();

const bot = new Telegraf(process.env.BOT_TOKEN);
const GRUPO_DESTINO_ID = -4676268485;

// Canal privado para guardar estado (crea un canal privado y agrega el bot como admin)
const STORAGE_CHAT_ID = process.env.STORAGE_CHAT_ID || '@tu_canal_privado';

// Función para cargar el estado desde Telegram
async function cargarEstado() {
  try {
    // Buscar el último mensaje con el estado
    const messages = await bot.telegram.getChat(STORAGE_CHAT_ID);
    
    // Intentar obtener mensajes recientes
    const updates = await bot.telegram.getUpdates({ limit: 100 });
    
    // Buscar el último mensaje que contenga el estado
    const stateMessage = updates
      .reverse()
      .find(update => 
        update.message && 
        update.message.text && 
        update.message.text.startsWith('STATE:')
      );
    
    if (stateMessage) {
      const stateJson = stateMessage.message.text.replace('STATE:', '');
      return JSON.parse(stateJson);
    }
    
    return { saldoAcumulado: 0, avisoMillonHecho: false };
  } catch (error) {
    console.error('Error cargando estado:', error);
    return { saldoAcumulado: 0, avisoMillonHecho: false };
  }
}

// Función más simple: usar un chat privado contigo mismo
async function cargarEstadoSimple() {
  try {
    // Usar el chat contigo mismo como storage
    const chatId = process.env.ADMIN_CHAT_ID; // Tu chat ID personal
    if (!chatId) {
      return { saldoAcumulado: 0, avisoMillonHecho: false };
    }
    
    // Enviar comando para obtener el estado actual
    // (esto requiere que implementes un comando especial)
    return { saldoAcumulado: 0, avisoMillonHecho: false };
  } catch (error) {
    return { saldoAcumulado: 0, avisoMillonHecho: false };
  }
}

// Función para guardar estado usando memoria + notificación
async function guardarEstado(estado) {
  try {
    // Enviar el estado actual como mensaje privado al admin
    const adminChatId = process.env.ADMIN_CHAT_ID;
    if (adminChatId) {
      await bot.telegram.sendMessage(
        adminChatId,
        `🔄 Estado actualizado:\n💰 Saldo: ${formatearImporte(estado.saldoAcumulado)}\n🎉 Aviso millón: ${estado.avisoMillonHecho ? 'Sí' : 'No'}`,
        { disable_notification: true }
      );
    }
  } catch (error) {
    console.error('Error guardando estado:', error);
  }
}

// Variables en memoria (se pierden pero son respaldadas por mensajes)
let saldoAcumulado = 0;
let avisoMillonHecho = false;

// Función para configurar webhook
async function setupWebhook() {
  try {
    const webhookUrl = process.env.WEBHOOK_URL || 'https://bot-tranfer-telegram.vercel.app/api/bot';
    await bot.telegram.setWebhook(webhookUrl);
    console.log('✅ Webhook configurado en:', webhookUrl);
  } catch (error) {
    console.error('❌ Error configurando webhook:', error);
  }
}

function formatearImporte(numero) {
  return '$' + parseFloat(numero).toFixed(2)
    .replace('.', ',')
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

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
  
  // Guardar estado
  await guardarEstado({ saldoAcumulado, avisoMillonHecho });
  
  ctx.reply(`✅ Se sumó ${formatearImporte(valor)}. Saldo acumulado: ${formatearImporte(saldoAcumulado)}`);
  verificarUmbral(ctx);
});

bot.command('saldo', (ctx) => {
  ctx.reply(`💰 Saldo acumulado: ${formatearImporte(saldoAcumulado)}`);
});

bot.command('reset', async (ctx) => {
  saldoAcumulado = 0;
  avisoMillonHecho = false;
  
  // Guardar estado
  await guardarEstado({ saldoAcumulado, avisoMillonHecho });
  
  ctx.reply('🔄 Saldo reiniciado a $0,00');
});

// Comando para restaurar estado manualmente
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
  await guardarEstado({ saldoAcumulado, avisoMillonHecho });
  
  ctx.reply(`🔄 Saldo restaurado a: ${formatearImporte(saldoAcumulado)}`);
});

function verificarUmbral(ctx) {
  if (!avisoMillonHecho && saldoAcumulado >= 1000000) {
    avisoMillonHecho = true;
    ctx.reply(`🎉 ¡El saldo acumulado alcanzó ${formatearImporte(saldoAcumulado)}!`);
  }
}

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

⚠️ *Nota:* El saldo se guarda como respaldo, pero podría perderse entre reinicios del servidor.
  `;
  ctx.replyWithMarkdown(ayuda);
});

// Configuración para Vercel
module.exports = async (req, res) => {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Manejar preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Configurar webhook para Vercel
  if (req.method === 'POST') {
    try {
      await bot.handleUpdate(req.body);
      res.status(200).json({ ok: true });
    } catch (error) {
      console.error('Error procesando webhook:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  } else if (req.method === 'GET') {
    // Endpoint para verificar que el bot está funcionando
    res.status(200).json({ 
      message: 'Bot funcionando correctamente',
      saldoActual: formatearImporte(saldoAcumulado),
      timestamp: new Date().toISOString()
    });
  } else {
    res.status(405).json({ error: 'Método no permitido' });
  }
};

// Inicializar el bot según el entorno
if (process.env.NODE_ENV === 'production') {
  // En producción, configurar webhook
  setupWebhook();
  console.log('🤖 Bot configurado en modo producción con webhook...');
} else {
  // En desarrollo, usar polling
  bot.launch();
  console.log('🤖 Bot activo en modo desarrollo (polling)...');
}

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));