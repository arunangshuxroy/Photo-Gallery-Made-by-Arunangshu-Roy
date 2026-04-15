import os
import uuid
from flask import Flask, request, jsonify, render_template
from werkzeug.utils import secure_filename
from dotenv import load_dotenv
from services import s3

load_dotenv()

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024  # 10 MB

ALLOWED_TYPES = {"image/jpeg", "image/png"}
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png"}


def valid_file(file):
    ext = os.path.splitext(file.filename)[1].lower()
    return file.content_type in ALLOWED_TYPES and ext in ALLOWED_EXTENSIONS


def unique_filename(original):
    ext = os.path.splitext(secure_filename(original))[1].lower()
    return f"{uuid.uuid4().hex}{ext}"


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/upload", methods=["POST"])
def upload():
    file = request.files.get("image")
    if not file or not valid_file(file):
        return jsonify({"error": "Only JPEG and PNG files are allowed."}), 400

    filename = unique_filename(file.filename)
    try:
        s3.upload_file(file, filename, file.content_type)
        return jsonify({"filename": filename, "url": s3.presigned_url(filename)}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/images")
def images():
    try:
        return jsonify(s3.list_files())
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/delete/<filename>", methods=["DELETE"])
def delete(filename):
    try:
        s3.delete_file(filename)
        return jsonify({"deleted": filename})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5005)
