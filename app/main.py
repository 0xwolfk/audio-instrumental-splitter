import io
import shutil
import threading
import uuid
import zipfile
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse, HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from app.separator import VALID_BITRATES, separate

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
OUTPUT_DIR = BASE_DIR / "outputs"

app = FastAPI(title="Audio Instrumental Splitter")
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")

# In-memory job tracker. Fine for a single-user local app.
jobs: dict[str, dict] = {}


def run_job(job_id: str, input_path: Path, bitrate: int):
    job = jobs[job_id]
    try:
        job["status"] = "processing"
        job["progress"] = 0

        def on_progress(pct: int):
            job["progress"] = pct

        stems = separate(input_path, OUTPUT_DIR / job_id, bitrate=bitrate, progress_callback=on_progress)
        job["status"] = "done"
        job["progress"] = 100
        job["stems"] = {name: str(path) for name, path in stems.items()}
    except Exception as exc:
        job["status"] = "error"
        job["error"] = str(exc)


@app.get("/", response_class=HTMLResponse)
def index():
    return (BASE_DIR / "static" / "index.html").read_text(encoding="utf-8")


@app.post("/api/separate")
async def create_job(file: UploadFile = File(...), bitrate: int = Form(320)):
    if Path(file.filename).suffix.lower() != ".mp3":
        raise HTTPException(status_code=400, detail="Only MP3 files are accepted")
    if bitrate not in VALID_BITRATES:
        raise HTTPException(status_code=400, detail="Bitrate must be 128 or 320")

    job_id = uuid.uuid4().hex
    job_dir = UPLOAD_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    input_path = job_dir / "source.mp3"
    with input_path.open("wb") as f:
        shutil.copyfileobj(file.file, f)

    jobs[job_id] = {"status": "queued", "filename": file.filename, "progress": 0}
    thread = threading.Thread(target=run_job, args=(job_id, input_path, bitrate), daemon=True)
    thread.start()

    return {"job_id": job_id}


@app.get("/api/status/{job_id}")
def get_status(job_id: str):
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {
        "status": job["status"],
        "progress": job.get("progress", 0),
        "error": job.get("error"),
        "ready": job["status"] == "done",
    }


@app.get("/api/download/{job_id}/{stem}")
def download(job_id: str, stem: str):
    job = jobs.get(job_id)
    if not job or job.get("status") != "done":
        raise HTTPException(status_code=404, detail="Job not ready")
    stem_path = job["stems"].get(stem)
    if not stem_path:
        raise HTTPException(status_code=404, detail="Stem not found")
    return FileResponse(stem_path, filename=f"{stem}.mp3", media_type="audio/mpeg")


@app.get("/api/download/{job_id}/zip/both")
def download_zip(job_id: str):
    job = jobs.get(job_id)
    if not job or job.get("status") != "done":
        raise HTTPException(status_code=404, detail="Job not ready")

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_STORED) as zf:
        for name, path in job["stems"].items():
            zf.write(path, arcname=f"{name}.mp3")
    buffer.seek(0)

    headers = {"Content-Disposition": "attachment; filename=stems.zip"}
    return StreamingResponse(buffer, media_type="application/zip", headers=headers)
