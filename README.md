# Audio Instrumental Splitter

Split an MP3 into isolated **vocals** and **instrumental** tracks, entirely
on your own machine, using [Demucs](https://github.com/facebookresearch/demucs).

## Features

- Drag-and-drop MP3 upload (MP3 in, MP3 out)
- Choose output quality: 128 kbps or 320 kbps
- Optional higher-quality separation mode (`--shifts 2`) — better results,
  ~1.5-3x slower, off by default
- Live progress bar while the track is splitting
- Download vocals / instrumental separately, or both together as a `.zip`
- Old job files are purged automatically after 24h so disk usage doesn't grow unbounded
- Runs fully locally — no audio is uploaded anywhere

## Setup

Requires Python 3.10+ and [ffmpeg](https://ffmpeg.org/download.html) on your `PATH`
(`ffmpeg -version` should work in your terminal — on Windows, install with
`winget install Gyan.FFmpeg` and open a **new** terminal afterwards so the
updated `PATH` takes effect).

```bash
python -m venv .venv
.venv\Scripts\activate      # Windows
source .venv/bin/activate   # macOS/Linux

pip install torch==2.13.0 --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt
pip install demucs==4.0.1 --no-deps
```

## Run

```bash
uvicorn app.main:app --reload
```

Open http://127.0.0.1:8000 and drop in an MP3.

The first split will download the Demucs `htdemucs` model (~80 MB) and cache
it locally, so it only happens once.

## How it works

- **Backend** — FastAPI (`app/main.py`) accepts the upload, kicks off a
  background thread that shells out to `demucs.separate` (`app/separator.py`),
  and streams progress back to the browser via polling. Old upload/output
  folders are swept on startup and before each new job.
- **Separation** — Demucs' `htdemucs` model with `--two-stems=vocals`
  produces `vocals.mp3` and `no_vocals.mp3` at the requested bitrate,
  parallelized across 4 CPU workers (`-j 4`) for faster CPU-only inference.
  Enabling "higher quality" adds `--shifts 2` (test-time shift averaging)
  for a modest quality bump at the cost of extra passes.
- **Frontend** — a single static page (`app/static`), using
  [Lucide](https://lucide.dev) icons and the [Figtree](https://github.com/erinmlaughlin/figtree)
  typeface (italic for headers, normal for body/caption text).

## Credits

Separation is powered by [Demucs](https://github.com/facebookresearch/demucs),
an open-source model from Meta AI Research (FAIR), MIT licensed.
