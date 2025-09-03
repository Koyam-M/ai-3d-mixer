import os
import subprocess
from pathlib import Path
from flask import Flask, request, jsonify, send_from_directory

# 1. サーバーの基本設定
app = Flask(__name__, static_folder='public', static_url_path='')

# 2. ファイルの保存場所を設定
UPLOAD_FOLDER = 'uploads'
OUTPUT_FOLDER = 'output'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

# 3. ルーティング（お客さんへの対応マニュアル）

# ホームページ (index.html) を表示する
@app.route('/')
def index():
    return send_from_directory('public', 'index.html')

# 分離された音声ファイルを提供する
@app.route('/output/<path:filename>')
def serve_output_file(filename):
    return send_from_directory(OUTPUT_FOLDER, filename, as_attachment=True)

# 音源分離の処理を行う
@app.route('/upload', methods=['POST'])
def upload_file():
    if 'audioFile' not in request.files:
        return jsonify({"message": "ファイルがありません"}), 400
    
    file = request.files['audioFile']
    if file.filename == '':
        return jsonify({"message": "ファイルが選択されていません"}), 400

    # ファイルを保存
    input_filepath = os.path.join(UPLOAD_FOLDER, file.filename)
    file.save(input_filepath)
    print(f"ファイルを受信: {input_filepath}")

    # Spleeterのコマンドを実行
    song_name = Path(file.filename).stem
    song_output_dir = os.path.join(OUTPUT_FOLDER, song_name)
    
    # Hugging Face Spacesの環境ではフルパスを指定する必要がある場合がある
    spleeter_command = [
        "python", "-m", "spleeter", "separate",
        "-p", "spleeter:5stems",
        "-o", OUTPUT_FOLDER,
        input_filepath
    ]
    
    print("Spleeterによる音源分離を開始します...")
    try:
        # タイムアウトを300秒（5分）に設定
        subprocess.run(spleeter_command, check=True, timeout=300)
    except subprocess.CalledProcessError as e:
        print(f"実行エラー: {e}")
        return jsonify({"message": "音源分離中にエラーが発生しました。"}), 500
    except subprocess.TimeoutExpired:
        print("タイムアウトエラー")
        return jsonify({"message": "処理がタイムアウトしました。短い曲でお試しください。"}), 500

    print("音源分離が完了しました！")

    # 元のアップロードファイルを削除
    os.remove(input_filepath)

    # 結果のファイルパスをクライアントに返す
    files = {
        "vocals": f"output/{song_name}/vocals.wav",
        "drums": f"output/{song_name}/drums.wav",
        "bass": f"output/{song_name}/bass.wav",
        "piano": f"output/{song_name}/piano.wav",
        "other": f"output/{song_name}/other.wav",
    }
    return jsonify({"message": "音源分離が完了しました。", "files": files})

# 4. サーバーの起動（Hugging Faceが自動でやってくれるので不要）
# if __name__ == '__main__':
#     app.run(host='0.0.0.0', port=7860)