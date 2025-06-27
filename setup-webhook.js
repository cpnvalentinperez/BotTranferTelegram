const { Telegraf } = require('telegraf');
require('dotenv').config();

const bot = new Telegraf(process.env.BOT_TOKEN);

async function setupWebhook() {
  try {
    // Reemplaza esta URL con tu dominio real de Vercel
    const webhookUrl = process.env.WEBHOOK_URL || 'https://bot-tranfer-telegram.vercel.app/api/bot';
    
    console.log('🔧 Configurando webhook...');
    console.log('URL del webhook:', webhookUrl);
    
    // Eliminar webhook existente
    await bot.telegram.deleteWebhook();
    console.log('✅ Webhook anterior eliminado');
    
    // Configurar nuevo webhook
    await bot.telegram.setWebhook(webhookUrl);
    console.log('✅ Nuevo webhook configurado exitosamente');
    
    // Verificar configuración
    const webhookInfo = await bot.telegram.getWebhookInfo();
    console.log('📋 Información del webhook:', JSON.stringify(webhookInfo, null, 2));
    
  } catch (error) {
    console.error('❌ Error configurando webhook:', error.message);
  } finally {
    process.exit(0);
  }
}

// Ejecutar configuración
setupWebhook(); 