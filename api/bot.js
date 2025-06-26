const { Telegraf } = require('telegraf');
require('dotenv').config(); // This line loads environment variables from a .env file

// Initialize the bot with your Telegram Bot Token
// IMPORTANT: On Vercel, this BOT_TOKEN must be set as an Environment Variable in your project settings.
const bot = new Telegraf(process.env.BOT_TOKEN);

// Global variables for the accumulated balance and the million-dollar notification flag.
// BE AWARE: These variables are VOLATILE in serverless environments like Vercel.
// They will reset between invocations or after periods of inactivity.
// For persistent storage, you would need an external database.
let saldoAcumulado = 0;
let avisoMillonHecho = false;

/**
 * Formats a number as a monetary amount in a localized format (e.g., $1.234,56 for Argentina).
 * @param {number} numero - The number to format.
 * @returns {string} The formatted monetary string.
 */
function formatearImporte(numero) {
  const num = parseFloat(numero);
  if (isNaN(num)) return '$0,00';

  return '$' + num.toFixed(2)
    .replace('.', ',') // Replace decimal point with comma for Argentinian format
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.'); // Add thousands separators
}

// --- Bot Commands ---

// Handles the /start command: Welcomes the user.
bot.command('start', (ctx) => {
  ctx.replyWithMarkdown(`
🤖 ¡Hola! Soy tu *Bot de Saldo para Tranfers*

Podés llevar un registro de tu dinero con estos comandos:
💰 \`/agregar <importe>\`
📊 \`/saldo\`
🔄 \`/reset\`

Usa /ayuda para ver todos los comandos disponibles.
  `);
});

// Handles the /agregar command: Adds an amount to the accumulated balance.
bot.command('agregar', (ctx) => {
  const partes = ctx.message.text.split(' ');
  if (partes.length < 2) {
    return ctx.reply('⚠️ Usá: /agregar 1234.56 o /agregar 1234,56');
  }

  // Joins parts and cleans up currency symbols/spaces, then replaces comma with dot for parseFloat
  const valorTexto = partes.slice(1).join(' ').replace(/[$\s]/g, '');
  let valor = parseFloat(valorTexto.replace(',', '.'));

  if (isNaN(valor) || valor <= 0) {
    return ctx.reply('⚠️ Ingresá un valor numérico válido. Ejemplo: /agregar 1234.56');
  }

  saldoAcumulado += valor;
  ctx.reply(`✅ Sumado: ${formatearImporte(valor)}\n💰 Total: ${formatearImporte(saldoAcumulado)}`);

  // Special notification when the balance exceeds one million for the first time
  if (!avisoMillonHecho && saldoAcumulado >= 1000000) {
    avisoMillonHecho = true;
    // Add a small delay for the celebratory message
    setTimeout(() => {
      ctx.reply(`🎉🎊 ¡FELICITACIONES! 🎊🎉\n💰 ¡Tu saldo superó el millón!\n📈 Total: ${formatearImporte(saldoAcumulado)}`);
    }, 1000);
  }
});

// Handles the /saldo command: Displays the current accumulated balance.
bot.command('saldo', (ctx) => {
  ctx.reply(`💰 Saldo acumulado: ${formatearImporte(saldoAcumulado)}`);
});

// Handles the /reset command: Resets the balance to zero.
bot.command('reset', (ctx) => {
  saldoAcumulado = 0;
  avisoMillonHecho = false;
  ctx.reply('🔄 Saldo reiniciado a $0,00');
});

// Handles the /ayuda command: Provides help information and available commands.
bot.command('ayuda', (ctx) => {
  ctx.replyWithMarkdown(`
📌 *Bot de Saldo Personal*

*Comandos disponibles:*
• \`/agregar <importe>\` – Suma un importe al saldo (ej: \`/agregar 1500.50\`, \`/agregar 2.300,75\`)
• \`/saldo\` – Muestra el saldo actual
• \`/reset\` – Reinicia el saldo a cero
• \`/ayuda\` – Muestra esta ayuda
  `);
});

// Handles the /test command: Checks if the bot is functioning and connected to Telegram.
bot.command('test', async (ctx) => {
  try {
    const botInfo = await ctx.telegram.getMe();
    ctx.reply(`✅ Bot funcionando correctamente!\n🤖 ${botInfo.first_name} (@${botInfo.username})`);
  } catch (error) {
    ctx.reply(`❌ Error: ${error.message}`);
  }
});

// --- Global Error Handling ---
// Catches any unhandled errors within the bot's processing.
bot.catch((err, ctx) => {
  console.error('❌ Error en bot:', err);
  ctx.reply('❌ Ocurrió un error inesperado. Intentá de nuevo en unos momentos.');
});

// --- Vercel Deployment Configuration ---
// This is the core part for Vercel. Instead of bot.launch(),
// Vercel expects an exported function to handle incoming requests (webhooks).
module.exports = async (req, res) => {
  try {
    // If the request is a POST request (Telegram webhook)
    if (req.method === 'POST') {
      await bot.handleUpdate(req.body, res);
    } else {
      // For GET requests (e.g., direct browser access to the Vercel URL)
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Telegram Bot is running. Send POST requests to this URL for webhook updates.');
    }
  } catch (err) {
    console.error('Error handling webhook update:', err);
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
};

// --- Local Development (Optional) ---
// This block allows you to run the bot locally using `node index.js`
// and listen for long-polling updates, useful for testing without Vercel deployment.
if (process.env.NODE_ENV === 'development' && !process.env.VERCEL) {
  console.log('🤖 Iniciando bot en modo desarrollo (long polling)...');
  bot.launch()
    .then(() => console.log('✅ Bot lanzado correctamente en desarrollo'))
    .catch(err => {
      console.error('❌ Error lanzando bot en desarrollo:', err);
      process.exit(1); // Exit if bot fails to launch locally
    });

  // Graceful shutdown for local development
  process.once('SIGINT', () => {
    console.log('🛑 Cerrando bot (SIGINT)...');
    bot.stop('SIGINT');
  });
  process.once('SIGTERM', () => {
    console.log('🛑 Cerrando bot (SIGTERM)...');
    bot.stop('SIGTERM');
  });
} else if (!process.env.BOT_TOKEN) {
  // Warn if BOT_TOKEN is missing when not in local dev (e.g., in Vercel but not configured)
  console.error('❌ BOT_TOKEN no está configurado. El bot no funcionará.');
  // In a Vercel environment, this error will be caught by the module.exports if it happens.
}