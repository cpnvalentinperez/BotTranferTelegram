const { Telegraf } = require('telegraf');
const axios = require('axios');
const pdfParse = require('pdf-parse');
const Tesseract = require('tesseract.js');
require('dotenv').config();

const bot = new Telegraf(process.env.BOT_TOKEN);
const GRUPO_DESTINO_ID = -4676268485;
let saldoAcumulado = 0;
let avisoMillonHecho = false;

function formatearImporte(numero) {
  return '$' + parseFloat(numero).toFixed(2)
    .replace('.', ',')
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

bot.on('document', async (ctx) => {
  const document = ctx.message.document;
  const fileId = document.file_id;
  const fileInfo = await ctx.telegram.getFile(fileId);
  const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${fileInfo.file_path}`;

  try {
    const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data);
    let text = '';

    if (document.mime_type === 'application/pdf') {
      const data = await pdfParse(buffer);
      text = data.text;
      let importes = buscarImporte(text);

      const posiblesCortados = importes.filter(i => i.match(/\.\d{1}$/));
      if (importes.length === 0 || posiblesCortados.length > 0) {
        const result = await Tesseract.recognize(
          buffer,
          'eng',
          {
            corePath: process.env.VERCEL_URL
              ? `https://${process.env.VERCEL_URL}/tesseract-core-simd.wasm`
              : `${process.env.LOCAL_URL || 'http://localhost:3000'}/tesseract-core-simd.wasm`
          }
        );
        text = result.data.text;
        importes = buscarImporte(text);
      }

      await ctx.telegram.sendDocument(GRUPO_DESTINO_ID, fileId);
    } else if (document.mime_type.startsWith('image')) {
      const result = await Tesseract.recognize(
        buffer,
        'eng',
        {
          corePath: process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}/tesseract-core-simd.wasm`
            : `${process.env.LOCAL_URL || 'http://localhost:3000'}/tesseract-core-simd.wasm`
        }
      );
      text = result.data.text;
      const importes = buscarImporte(text);
      const caption = importes.length
        ? `💰 Importes detectados:\n${importes.map(i => `• ${formatearImporte(i)}`).join('\n')}`
        : '❌ No se detectaron importes.';
      await ctx.reply(caption);
      await ctx.telegram.sendDocument(GRUPO_DESTINO_ID, fileId, { caption });
    }
  } catch (error) {
    // Error handling opcional
  }
});

bot.on('photo', async (ctx) => {
  const photo = ctx.message.photo.at(-1);
  const file = await ctx.telegram.getFile(photo.file_id);
  const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;

  try {
    const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
    const result = await Tesseract.recognize(
      Buffer.from(response.data),
      'eng',
      {
        corePath: process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}/tesseract-core-simd.wasm`
          : `${process.env.LOCAL_URL || 'http://localhost:3000'}/tesseract-core-simd.wasm`
      }
    );
    const text = result.data.text;
    const importes = buscarImporte(text);
    const caption = importes.length
      ? `💰 Importes detectados:\n${importes.map(i => `• ${formatearImporte(i)}`).join('\n')}`
      : '❌ No se detectaron importes.';
    await ctx.reply(caption);
    await ctx.telegram.sendPhoto(GRUPO_DESTINO_ID, photo.file_id, { caption });
  } catch (error) {
    // Error handling opcional
  }
});

function buscarImporte(text) {
  const matches = [...text.matchAll(/\$?\s?(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})/g)];
  const importes = matches.map(m => {
    let valor = m[1];
    if (valor.includes('.') && valor.includes(',')) {
      valor = valor.replace(/\./g, '').replace(',', '.');
    } else if (valor.includes(',') && valor.includes('.')) {
      valor = valor.replace(/,/g, '');
    } else if (valor.includes('.') && !valor.includes(',')) {
      const partes = valor.split('.');
      if (partes[1]?.length === 3) {
        valor = partes.join('');
      }
    }
    return parseFloat(valor).toFixed(2);
  });
  return importes;
}

bot.command('agregar', (ctx) => {
  const partes = ctx.message.text.split(' ');
  if (partes.length < 2) {
    return ctx.reply('⚠️ Usá el comando así: /agregar 1234.56');
  }
  const valor = parseFloat(partes[1].replace(',', '.'));
  if (isNaN(valor)) {
    return ctx.reply('❌ El valor ingresado no es válido.');
  }
  saldoAcumulado += valor;
  ctx.reply(`✅ Se sumó ${formatearImporte(valor)}. Saldo acumulado: ${formatearImporte(saldoAcumulado)}`);
  verificarUmbral(ctx);
});

bot.command('saldo', (ctx) => {
  ctx.reply(`💰 Saldo acumulado: ${formatearImporte(saldoAcumulado)}`);
});

bot.command('reset', (ctx) => {
  saldoAcumulado = 0;
  avisoMillonHecho = false;
  ctx.reply('🔄 Saldo reiniciado a $0,00');
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

📤 *Reenvío automático de documentos:*
• El bot reenvía cualquier *PDF* o *imagen* enviada al grupo destino.  
• Intenta detectar *importes* automáticamente usando OCR.

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

// Handler para Vercel
module.exports = async (req, res) => {
  if (req.method === 'POST') {
    try {
      await bot.handleUpdate(req.body);
      res.status(200).send('OK');
    } catch (err) {
      res.status(500).send('Error');
    }
  } else {
    res.status(200).send('Bot running (webhook endpoint)');
  }
}; 