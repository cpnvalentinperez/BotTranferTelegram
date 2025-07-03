const { Telegraf } = require('telegraf');
const axios = require('axios');
const pdfParse = require('pdf-parse');
const Tesseract = require('tesseract.js');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

const bot = new Telegraf(process.env.BOT_TOKEN);
const GRUPO_DESTINO_ID = -4676268485;

// Archivo para guardar el estado
const STATE_FILE = path.join('/tmp', 'bot_state.json');

// Función para cargar el estado
async function cargarEstado() {
  try {
    const data = await fs.readFile(STATE_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // Si no existe el archivo, crear estado inicial
    return {
      saldoAcumulado: 0,
      avisoMillonHecho: false
    };
  }
}

// Función para guardar el estado
async function guardarEstado(estado) {
  try {
    await fs.writeFile(STATE_FILE, JSON.stringify(estado, null, 2));
  } catch (error) {
    console.error('Error guardando estado:', error);
  }
}

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

  // Cargar estado actual
  const estado = await cargarEstado();
  
  // Actualizar saldo
  estado.saldoAcumulado += valor;
  
  // Guardar estado
  await guardarEstado(estado);
  
  ctx.reply(`✅ Se sumó ${formatearImporte(valor)}. Saldo acumulado: ${formatearImporte(estado.saldoAcumulado)}`);
  
  // Verificar umbral
  await verificarUmbral(ctx, estado);
});

bot.command('saldo', async (ctx) => {
  const estado = await cargarEstado();
  ctx.reply(`💰 Saldo acumulado: ${formatearImporte(estado.saldoAcumulado)}`);
});

bot.command('reset', async (ctx) => {
  const estado = {
    saldoAcumulado: 0,
    avisoMillonHecho: false
  };
  await guardarEstado(estado);
  ctx.reply('🔄 Saldo reiniciado a $0,00');
});

async function verificarUmbral(ctx, estado) {
  if (!estado.avisoMillonHecho && estado.saldoAcumulado >= 1000000) {
    estado.avisoMillonHecho = true;
    await guardarEstado(estado);
    ctx.reply(`🎉 ¡El saldo acumulado alcanzó ${formatearImporte(estado.saldoAcumulado)}!`);
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

🎉 *Aviso automático:*  
Cuando el saldo acumulado llega o supera *$1.000.000,00*, el bot avisa automáticamente.
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
    const estado = await cargarEstado();
    res.status(200).json({ 
      message: 'Bot funcionando correctamente',
      saldoActual: formatearImporte(estado.saldoAcumulado),
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