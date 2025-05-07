const { Telegraf } = require('telegraf');

// Reemplazá por tu token real
const bot = new Telegraf('7940903614:AAEF8bFcLvTr_6T9ykijMUF-t5Zwvwstmic');

// ID del grupo al que querés reenviar la imagen
const GRUPO_DESTINO_ID = -4676268485; // reemplazá con tu chat_id real

bot.on('photo', async (ctx) => {
  const fromChat = ctx.chat.id;
  const messageId = ctx.message.message_id;

  try {
    await ctx.telegram.copyMessage(GRUPO_DESTINO_ID, fromChat, messageId);
    console.log(`Imagen reenviada a ${GRUPO_DESTINO_ID}`);
  } catch (error) {
    console.error('Error al reenviar imagen:', error);
  }
});

bot.on('document', async (ctx) => {
    const document = ctx.message.document;
  
    try {
      await ctx.telegram.sendDocument(
        GRUPO_DESTINO_ID,
        document.file_id,
        {
          caption: ctx.message.caption || '', // conserva el caption si hay
        }
      );
      console.log('📄 PDF reenviado con éxito');
    } catch (error) {
      console.error('Error al reenviar PDF:', error);
    }
  });

bot.launch();
console.log('🤖 Bot activo...');

// Finaliza correctamente al recibir SIGINT o SIGTERM
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
