#!/usr/bin/env python3
"""Match Montecristo narration to the exact REM ebook, with real word timestamps."""
import argparse
import json
import math
import re
import subprocess
import unicodedata
from difflib import SequenceMatcher
from pathlib import Path
import whisper

ROOT = Path("audio/montecristo")
TEXT = Path("content/books/montecristo")

def normalize(s):
    return "".join(c for c in unicodedata.normalize("NFKD", s.lower()) if c.isalnum() and not unicodedata.combining(c))

def duration(path):
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(path)], text=True).strip())

def prepare_audio(n):
    stem = f"capitolo-{n:02d}"
    path = ROOT / (stem + ".m4a")
    if n == 17 and not path.exists():
        parts = [ROOT / (stem + f"-parte-{i:02d}.m4a") for i in (1, 2)]
        for part in parts:
            if not part.is_file():
                raise FileNotFoundError(part)
        concat = ROOT / "concat-17.txt"
        concat.write_text("".join(f"file '{part.name}'\n" for part in parts), encoding="utf-8")
        try:
            subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(concat), "-map", "0:a:0", "-c:a", "copy", "-map_metadata", "-1", "-map_chapters", "-1", "-movflags", "+faststart", str(path)], check=True)
        finally:
            concat.unlink(missing_ok=True)
        if abs(duration(path) - sum(duration(p) for p in parts)) > 1:
            raise RuntimeError("Chapter 17 concatenation duration mismatch")
    if not path.is_file():
        raise FileNotFoundError(path)
    return path

def run(n, model):
    stem = f"capitolo-{n:02d}"
    path = prepare_audio(n)
    length = duration(path)
    content = (TEXT / (stem + ".txt")).read_bytes().decode("utf-8-sig")
    # Browser offsets are UTF-16 units, not Python Unicode code points.
    offsets = [0]
    for char in content:
        offsets.append(offsets[-1] + (2 if ord(char) > 0xffff else 1))
    source = [(normalize(m.group()), offsets[m.start()]) for m in re.finditer(r"[^\W_]+(?:['’][^\W_]+)*", content, re.UNICODE)]
    result = model.transcribe(str(path), language="it", word_timestamps=True, fp16=False, verbose=False)
    spoken = []
    for seg in result["segments"]:
        for w in seg.get("words", []):
            key = normalize(w["word"])
            start, end = float(w["start"]), float(w["end"])
            if key and math.isfinite(start) and math.isfinite(end) and 0 <= start <= end <= length + 0.2:
                spoken.append((key, start, min(end, length)))
    matcher = SequenceMatcher(None, [w[0] for w in source], [w[0] for w in spoken], autojunk=False)
    mapped = []
    for tag, a, b, c, d in matcher.get_opcodes():
        if tag == "equal":
            for i, j in zip(range(a, b), range(c, d)):
                start, end = round(spoken[j][1], 3), round(spoken[j][2], 3)
                if start <= end and (not mapped or start >= mapped[-1]["start"]):
                    mapped.append({"offset": source[i][1], "start": start, "end": end})
    coverage = len(mapped) / max(1, len(source))
    data = {"chapter": stem, "method": "whisper-small-word-timestamps", "coverage": round(coverage, 3), "duration": round(length, 3), "matched": len(mapped), "total": len(source), "words": mapped}
    (ROOT / (stem + ".words.json")).write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{stem}: {len(mapped)}/{len(source)} words ({coverage:.1%})", flush=True)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--first", type=int, required=True)
    parser.add_argument("--last", type=int, required=True)
    args = parser.parse_args()
    if not 1 <= args.first <= args.last <= 20:
        parser.error("Chapter range must be within 1..20")
    model = whisper.load_model("small")
    for chapter in range(args.first, args.last + 1):
        run(chapter, model)
