const { Telegraf } = require('telegraf');
const axios = require('axios');
const pdfParse = require('pdf-parse');
const Tesseract = require('tesseract.js');

// Reemplazá por tu token real
const bot = new Telegraf(process.env.BOT_TOKEN); // Mejor usar env

// ID del grupo al que querés reenviar la imagen
const GRUPO_DESTINO_ID = -4676268485; // reemplazá con tu chat_id real

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
      } else if (document.mime_type.startsWith('image')) {
        const result = await Tesseract.recognize(buffer, 'eng');
        text = result.data.text;
      }
  
      const importe = buscarImporte(text);
      const caption = importe ? `📄 Importe detectado: $${importe}` : '📄 Documento sin importe detectado.';
  
      //await ctx.telegram.sendDocument(GRUPO_DESTINO_ID, fileId, { caption });
      console.log('📄 Documento reenviado con análisis');
  
    } catch (error) {
      console.error('Error al procesar y reenviar documento:', error);
    }
  });
  
  bot.on('photo', async (ctx) => {
    const photo = ctx.message.photo.at(-1); // La de mayor resolución
    const file = await ctx.telegram.getFile(photo.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
  
    try {
      const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
      const result = await Tesseract.recognize(Buffer.from(response.data), 'eng');
      const text = result.data.text;
  
      const importe = buscarImporte(text);
      const caption = importe ? `🖼 Importe detectado: $${importe}` : '🖼 Imagen sin importe detectado.';
  
      //await ctx.telegram.sendPhoto(GRUPO_DESTINO_ID, photo.file_id, { caption });
      console.log('🖼 Imagen reenviada con análisis');
  
    } catch (error) {
      console.error('Error al procesar imagen:', error);
    }
  });
  
  // Utiliza una expresión regular para buscar importes en el texto
  function buscarImporte(text) {
    const match = text.match(/\$?\s?(\d{1,3}(?:[\.,]\d{3})*[\.,]\d{2})/);
    return match ? match[1].replace(',', '.') : null;
  }
  
  bot.launch();
  console.log('🤖 Bot activo...');
  
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));