const express = require('express');
const { google } = require('googleapis');

const app = express();
const SPREADSHEET_ID = '1wke7gtIe3Np9LJsgAelPomaWLYFbYFHcU0ea-brcWB4';

const auth = new google.auth.GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

app.get('/', async (req, res) => {
  const startTime = Date.now();
  console.log('Iniciando execução governada no Cloud Run...');

  try {
    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Dados!A2:D',
    });

    const rows = response.data.values || [];
    let processados = 0;

    const updatedRows = rows.map((row) => {
      if (row[2] === 'Pendente') {
        processados++;
        return [
          row[0],
          row[1],
          'Processado (Cloud Run)',
          new Date().toISOString(),
        ];
      }
      return row;
    });

    if (processados > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Dados!A2:D',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: updatedRows },
      });
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`Sucesso: ${processados} registros atualizados em ${duration}s.`);

    res.status(200).json({
      status: 'Sucesso',
      ambiente: 'Google Cloud Run',
      registros_atualizados: processados,
      tempo_execucao_segundos: duration,
    });
  } catch (error) {
    console.error('Erro na execução:', error);
    res.status(500).json({ status: 'Erro', detalhe: error.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Serviço rodando na porta ${PORT}`);
});
