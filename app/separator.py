import re
import subprocess
import sys
from pathlib import Path
from typing import Callable, Optional

MODEL = "htdemucs"
VALID_BITRATES = (128, 320)
JOBS = 4  # parallel chunk workers; same model/quality, just split across more CPU workers
PROGRESS_RE = re.compile(r"(\d{1,3})%\|")


def separate(
    input_path: Path,
    output_dir: Path,
    bitrate: int = 320,
    progress_callback: Optional[Callable[[int], None]] = None,
) -> dict[str, Path]:
    """Run Demucs two-stems separation and return paths to the resulting MP3 stems."""
    if bitrate not in VALID_BITRATES:
        raise ValueError(f"bitrate must be one of {VALID_BITRATES}")

    output_dir.mkdir(parents=True, exist_ok=True)

    cmd = [
        sys.executable,
        "-m",
        "demucs.separate",
        "-n",
        MODEL,
        "--two-stems",
        "vocals",
        "--mp3",
        "--mp3-bitrate",
        str(bitrate),
        "-j",
        str(JOBS),
        "-o",
        str(output_dir),
        str(input_path),
    ]
    process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )

    # Demucs reports progress via a tqdm bar that redraws with "\r", so we
    # read char-by-char and parse whichever line segment is currently buffered.
    buffer = ""
    tail = ""
    while True:
        char = process.stdout.read(1)
        if char == "" and process.poll() is not None:
            break
        if char in ("\r", "\n"):
            if buffer.strip():
                tail = buffer
                if progress_callback:
                    match = PROGRESS_RE.search(buffer)
                    if match:
                        progress_callback(min(int(match.group(1)), 100))
            buffer = ""
        else:
            buffer += char
    returncode = process.wait()
    if returncode != 0:
        raise RuntimeError(tail or "Demucs separation failed")

    stem_dir = output_dir / MODEL / input_path.stem
    vocals = stem_dir / "vocals.mp3"
    instrumental = stem_dir / "no_vocals.mp3"
    if not vocals.exists() or not instrumental.exists():
        raise RuntimeError("Demucs did not produce the expected output files")

    return {"vocals": vocals, "instrumental": instrumental}
