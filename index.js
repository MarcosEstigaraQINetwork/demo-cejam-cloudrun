const express = require('express');
const { google } = require('googleapis');

const app = express();
const SPREADSHEET_ID = '1wke7gtIe3Np9LJsgAelPomaWLYFbYFHcU0ea-brcWB4';

const auth = new google.auth.GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

app.get('/', async (req, res) => {
  const startTime = Date.now();
  console.log('Iniciando auditoria de estoque governada no Cloud Run...');

  try {
    const sheets = google.sheets({ version: 'v4', auth });

    // 1. Lê todas as linhas da planilha de uma única vez
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Dados!A2:F',
    });

    const rows = response.data.values || [];
    let itensCriticos = 0;

    // 2. Processa a regra de estoque em memória (instantâneo)
    const updatedRows = rows.map((row) => {
      const estoqueAtual = Number(row[2]);
      const estoqueMinimo = Number(row[3]);
      const precisaRepor = estoqueAtual < estoqueMinimo;

      if (precisaRepor) itensCriticos++;

      return [
        row[0], // Codigo
        row[1], // Insumo
        row[2], // Estoque_Atual
        row[3], // Estoque_Minimo
        precisaRepor ? '⚠️ REPOR ESTOQUE (Cloud Run)' : '✅ Estoque OK (Cloud Run)',
        new Date().toISOString(),
      ];
    });

    // 3. Atualiza toda a planilha em uma única chamada em lote
    if (updatedRows.length > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Dados!A2:F',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: updatedRows },
      });
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`Auditoria concluída: ${rows.length} itens verificados, ${itensCriticos} em ponto de reposição (${duration}s).`);

    res.status(200).json({
      status: 'Sucesso',
      ambiente: 'Google Cloud Run',
      total_insumos_verificados: rows.length,
      alertas_reposicao_gerados: itensCriticos,
      tempo_execucao_segundos: duration,
    });
  } catch (error) {
    console.error('Erro na auditoria de estoque:', error);
    res.status(500).json({ status: 'Erro', detalhe: error.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Serviço de auditoria de estoque rodando na porta ${PORT}`);
});
