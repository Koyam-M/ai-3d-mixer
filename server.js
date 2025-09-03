// 1. 専門ツールを読み込む
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const { exec } = require("child_process");
const fs = require("fs");

// 2. サーバーの基本設定
const app = express();
const port = 3000;

// 3. ツールの設定
app.use(cors());
app.use("/output", express.static(path.join(__dirname, "output")));

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});
const upload = multer({ storage: storage });

// 4. ルーティング（お客さんへの対応マニュアル）
app.post("/upload", upload.single("audioFile"), (req, res) => {
  if (!req.file) {
    return res
      .status(400)
      .send({ message: "ファイルがアップロードされませんでした。" });
  }

  console.log("ファイルを受信:", req.file.path);
  const inputFile = req.file.path;
  const outputDir = "output";
  const songName = path.basename(inputFile, path.extname(inputFile));
  const songOutputDir = path.join(outputDir, songName);

  const createSuccessResponse = () => {
    // ★★★ 5パート分のファイルパスを返すように変更 ★★★
    const files = {
      vocals: path.join("output", songName, "vocals.wav").replace(/\\/g, "/"),
      drums: path.join("output", songName, "drums.wav").replace(/\\/g, "/"),
      bass: path.join("output", songName, "bass.wav").replace(/\\/g, "/"),
      piano: path.join("output", songName, "piano.wav").replace(/\\/g, "/"),
      other: path.join("output", songName, "other.wav").replace(/\\/g, "/"),
    };
    return res.send({ message: "音源分離が完了しました。", files: files });
  };

  if (
    fs.existsSync(songOutputDir) &&
    fs.existsSync(path.join(songOutputDir, "piano.wav"))
  ) {
    console.log(`キャッシュを発見: ${songOutputDir}`);
    return createSuccessResponse();
  }

  console.log("Spleeterによる音源分離を開始します...");

  const spleeterExecutable =
    "C:\\Users\\mikit\\anaconda3\\envs\\spleeter-env\\Scripts\\spleeter.exe";
  // ★★★ AIモデルを「5stems」にアップグレード ★★★
  const command = `"${spleeterExecutable}" separate -p spleeter:5stems -o ${outputDir} "${inputFile}"`;

  exec(command, (error, stdout, stderr) => {
    if (error || (stderr && stderr.includes("ERROR"))) {
      console.error(`実行エラー: ${error || stderr}`);
      return res.status(500).send({
        message: "音源分離中にエラーが発生しました。",
        error: stderr || error.message,
      });
    }

    console.log(`標準出力: ${stdout}`);
    if (stderr) {
      console.warn(`標準エラー（警告）: ${stderr}`);
    }
    console.log("音源分離が完了しました！");

    return createSuccessResponse();
  });
});

// 5. サーバーの起動
app.listen(port, () => {
  console.log(`サーバーが http://localhost:${port} で起動しました。`);
});
