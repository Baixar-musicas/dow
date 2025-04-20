const express = require("express");
const fetch = require("node-fetch");
const FormData = require("form-data");
const cors = require("cors");
const multer = require("multer");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

app.post("/convert", upload.single("file"), async (req, res) => {
  try {
    const fileBuffer = req.file.buffer;
    const filename = req.file.originalname;
    const format = req.body.format;

    const inputFormat = filename.split('.').pop();

    const form = new FormData();
    form.append("file", fileBuffer, filename);

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

    const job = await jobResponse.json();
    res.json(job);
  } catch (error) {
    console.error("Erro ao processar conversão:", error);
    res.status(500).json({ error: "Erro ao processar conversão." });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log("Servidor rodando na porta", PORT));
