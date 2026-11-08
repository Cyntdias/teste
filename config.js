/* =========================================================
   CONFIGURAÇÃO DO APP
   ---------------------------------------------------------
   MODO 'local' -> os dados ficam salvos no próprio navegador.
                   Use para testar no VS Code (Live Server).
   MODO 'sheets'-> os dados vão direto para o Google Planilhas
                   pelo Apps Script. Cole o link /exec em URL_APPS_SCRIPT.
   MODO 'make'  -> os dados vão para o Google Sheets através
                   dos 4 cenários do Make.
                   Cole abaixo as URLs dos webhooks de cada cenário.
   ========================================================= */
const CONFIG = {
  MODO: 'local', // 'local', 'sheets' (Apps Script) ou 'make'

  // Link do Apps Script (Implantar > App da Web). Termina com /exec
  URL_APPS_SCRIPT: 'https://script.google.com/macros/s/COLE_AQUI_O_ID/exec',

  WEBHOOKS: {
    create: 'https://hook.us2.make.com/COLE_AQUI_O_WEBHOOK_DO_CENARIO_CREATE',
    read:   'https://hook.us2.make.com/COLE_AQUI_O_WEBHOOK_DO_CENARIO_READ',
    update: 'https://hook.us2.make.com/COLE_AQUI_O_WEBHOOK_DO_CENARIO_UPDATE',
    delete: 'https://hook.us2.make.com/COLE_AQUI_O_WEBHOOK_DO_CENARIO_DELETE'
  },

  APP_NOME: 'Caderneta',
  MAX_FUNCIONARIOS: 10,     // limite de funcionários (além do dono)
  DDI_WHATSAPP: '55',       // Brasil

  // Atualização automática: busca novos dados a cada X segundos
  // (só com o app aberto na tela). No Apps Script é grátis;
  // no Make, cada busca gasta ~3 créditos.
  // Use 0 para desligar. No modo 'local' a atualização é instantânea.
  ATUALIZAR_A_CADA_SEGUNDOS: 60
};
