const { Telegraf } = require('telegraf');
const axios = require('axios');
const pdfParse = require('pdf-parse');
const Tesseract = require('tesseract.js');
require('dotenv').config();

const bot = new Telegraf(process.env.BOT_TOKEN);
const GRUPO_DESTINO_ID = -4676268485;
let saldoAcumulado = 0;
let avisoMillonHecho = false;


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
        console.log('⚠️ Aplicando OCR por posibles errores en PDF...');
        const result = await Tesseract.recognize(buffer, 'eng');
        text = result.data.text;
        importes = buscarImporte(text);
      }

      // NO SE ENVÍA CAPTION PARA PDF
      await ctx.telegram.sendDocument(GRUPO_DESTINO_ID, fileId);
      console.log('📄 Documento PDF reenviado sin caption');

    } else if (document.mime_type.startsWith('image')) {
      const result = await Tesseract.recognize(buffer, 'eng');
      text = result.data.text;
      const importes = buscarImporte(text);
      const caption = importes.length
        ? `💰 Importes detectados:\n${importes.map(i => `• $${i}`).join('\n')}`
        : '❌ No se detectaron importes.';
      await ctx.reply(caption);
      await ctx.telegram.sendDocument(GRUPO_DESTINO_ID, fileId, { caption });
      console.log('🖼 Imagen reenviada con análisis');
    }

  } catch (error) {
    console.error('Error al procesar y reenviar documento:', error);
  }
});

bot.on('photo', async (ctx) => {
  const photo = ctx.message.photo.at(-1);
  const file = await ctx.telegram.getFile(photo.file_id);
  const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;

  try {
    const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
    const result = await Tesseract.recognize(Buffer.from(response.data), 'eng');
    const text = result.data.text;

    const importes = buscarImporte(text);
    const caption = importes.length
      ? `💰 Importes detectados:\n${importes.map(i => `• $${i}`).join('\n')}`
      : '❌ No se detectaron importes.';

    await ctx.reply(caption);
    await ctx.telegram.sendPhoto(GRUPO_DESTINO_ID, photo.file_id, { caption });
    console.log('🖼 Imagen reenviada con análisis');

  } catch (error) {
    console.error('Error al procesar imagen:', error);
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
    return ctx.reply('⚠️ Usá el comando así: /agregar 123.45');
  }

  const valor = parseFloat(partes[1].replace(',', '.'));
  if (isNaN(valor)) {
    return ctx.reply('❌ El valor ingresado no es válido.');
  }

  saldoAcumulado += valor;
  ctx.reply(`✅ Se sumó $${valor.toFixed(2)}. Saldo acumulado: $${saldoAcumulado.toFixed(2)}`);
  verificarUmbral(ctx); // <-- chequea si se llegó al millón

});

bot.command('saldo', (ctx) => {
  ctx.reply(`💰 Saldo acumulado: $${saldoAcumulado.toFixed(2)}`);
});

bot.command('reset', (ctx) => {
  saldoAcumulado = 0;
  avisoMillonHecho = false;
  ctx.reply('🔄 Saldo reiniciado a $0.00');
});

function verificarUmbral(ctx) {
  if (!avisoMillonHecho && saldoAcumulado >= 1000000) {
    avisoMillonHecho = true;
    ctx.reply('🎉 ¡El saldo acumulado alcanzó $1.000.000!');
  }
}


bot.launch();
console.log('🤖 Bot activo...');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
