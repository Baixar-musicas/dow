require('dotenv').config();

const express = require("express");
const fetch = require("node-fetch");
const FormData = require("form-data");
const cors = require("cors");
const multer = require("multer");

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

app.post("/convert", upload.single("file"), async (req, res) => {
  try {
    const fileBuffer = req.file?.buffer;
    const filename = req.file?.originalname;
    const format = req.body?.format;

    if (!fileBuffer || !filename || !format) {
      return res.status(400).json({ error: "Dados ausentes: arquivo ou formato." });
    }

    const inputFormat = filename.split(".").pop();
    const form = new FormData();
    form.append("file", fileBuffer, filename);

    // Cria o JOB
    const jobResponse = await fetch("https://api.cloudconvert.com/v2/jobs", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.CLOUDCONVERT_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        tasks: {
          import: { operation: "import/upload" },
          convert: {
            operation: "convert",
            input: "import",
            input_format: inputFormat,
            output_format: format
          },
          export: { operation: "export/url", input: "convert" }
        }
      })
    });

    const jobData = await jobResponse.json();
    const uploadTask = jobData.data.tasks.find(t => t.name === "import");

    // Envia o arquivo para o endpoint de upload
    const uploadResponse = await fetch(uploadTask.result.form.url, {
      method: "POST",
      body: (() => {
        const realForm = new FormData();
        Object.entries(uploadTask.result.form.parameters).forEach(([key, value]) => {
          realForm.append(key, value);
        });
        realForm.append("file", fileBuffer, filename);
        return realForm;
      })()
    });

    if (!uploadResponse.ok) {
      return res.status(500).json({ error: "Falha no upload do arquivo para CloudConvert." });
    }

    // Aguarda a conversão finalizar
    const jobId = jobData.data.id;
    let convertedUrl = null;
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Espera 2s

      const statusRes = await fetch(`https://api.cloudconvert.com/v2/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${process.env.CLOUDCONVERT_API_KEY}` }
      });
      const statusData = await statusRes.json();
      const exportTask = statusData.data.tasks.find(t => t.name === "export" && t.status === "finished");

      if (exportTask?.result?.files?.[0]?.url) {
        convertedUrl = exportTask.result.files[0].url;
        break;
      }
    }

    if (convertedUrl) {
      res.json({ downloadUrl: convertedUrl });
    } else {
      res.status(500).json({ error: "A conversão não foi concluída a tempo." });
    }

  } catch (err) {
    console.error("Erro ao processar conversão:", err);
    res.status(500).json({ error: "Erro ao processar conversão." });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log("Servidor rodando na porta", PORT));
