const express = require('express');
const cors = require('cors'); // ✅ aqui

const fetch = require('node-fetch');
const FormData = require('form-data');
require('dotenv').config();

const app = express();
app.use(cors()); // ✅ aqui libera CORS para qualquer domínio
app.use(express.json());

app.post('/convert', async (req, res) => {
  const { filename, format } = req.body;

  const jobRes = await fetch('https://api.cloudconvert.com/v2/jobs', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.CLOUDCONVERT_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tasks: {
        import: { operation: 'import/upload' },
        convert: {
          operation: 'convert',
          input: 'import',
          input_format: filename.split('.').pop(),
          output_format: format
        },
        export: { operation: 'export/url', input: 'convert' }
      }
    }),
  });

  const job = await jobRes.json();
  const exportTask = job.data.tasks.find(task => task.name === 'export');
  const downloadUrl = exportTask?.result?.files?.[0]?.url;

  res.json({ downloadUrl });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Servidor rodando na porta', PORT));
