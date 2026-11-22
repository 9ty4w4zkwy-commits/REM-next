#!/usr/bin/env python3
"""Align Ovidio's four books to their narrated MP3s, word by word."""
import argparse
import json
import re
import subprocess
import unicodedata
from difflib import SequenceMatcher
from pathlib import Path
import whisper

ROOT = Path("content/books/metamorfosi-ovidio")
AUDIO = ROOT / "audio"
PARTS = {
    1: ["001_Libro_I_parte_1.mp3", "001_Libro_I_parte_2.mp3"],
    2: ["002_Libro_II_parte_1.mp3", "002_Libro_II_parte_2.mp3"],
    3: ["003_Libro_III.mp3"],
    4: ["004_Libro_IV.mp3"],
}

def norm(s):
    return "".join(c for c in unicodedata.normalize("NFKD", s.lower()) if c.isalnum() and not unicodedata.combining(c))

def tokens(s):
    return [(norm(m.group()), m.start()) for m in re.finditer(r"[^\W_]+(?:['’][^\W_]+)*", s, re.UNICODE)]

def duration(path):
    cmd = ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(path)]
    return float(subprocess.check_output(cmd, text=True).strip())

def run(book, model_name):
    files = sorted(ROOT.glob(f"libro-{book:02d}-capitolo-??*.txt"))
    if not files:
        raise RuntimeError(f"No text chapters for book {book}")
    chapters = []
    source = []
    for path in files:
        text = path.read_text(encoding="utf-8")
        start = len(source)
        source.extend(tokens(text))
        chapters.append((path, start, len(source)))
    print(f"Book {book}: {len(chapters)} chapters, {len(source)} words", flush=True)
    model = whisper.load_model(model_name)
    spoken = []
    shift = 0.0
    part_durations = []
    for name in PARTS[book]:
        path = AUDIO / name
        if not path.is_file():
            raise FileNotFoundError(path)
        length = duration(path)
        print(f"Transcribing {path} ({length:.1f}s), offset {shift:.1f}s", flush=True)
        result = model.transcribe(str(path), language="it", word_timestamps=True, fp16=False, verbose=False)
        for segment in result["segments"]:
            for word in segment.get("words", []):
                key = norm(word["word"])
                if key:
                    spoken.append((key, round(shift + float(word["start"]), 3), round(shift + float(word["end"]), 3)))
        part_durations.append(length)
        shift += length
    del model
    print(f"Matching {len(source)} text words with {len(spoken)} spoken words", flush=True)
    matcher = SequenceMatcher(None, [x[0] for x in source], [x[0] for x in spoken], autojunk=False)
    aligned = {}
    for tag, a, b, c, d in matcher.get_opcodes():
        if tag == "equal":
            for i, j in zip(range(a, b), range(c, d)):
                aligned[i] = {"offset": source[i][1], "start": spoken[j][1], "end": spoken[j][2]}
    summary = []
    for path, first, last in chapters:
        mapped = [aligned[i] for i in range(first, last) if i in aligned]
        coverage = len(mapped) / max(1, last - first)
        target = path.with_suffix(".words.json")
        data = {"chapter": path.stem.replace(" 2", ""), "method": f"whisper-{model_name}-word-timestamps", "coverage": round(coverage, 3), "duration": round(shift, 3), "parts": PARTS[book], "partDurations": part_durations, "words": mapped}
        target.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        summary.append({"chapter": data["chapter"], "coverage": data["coverage"], "matched": len(mapped), "total": last - first})
        print(f"{target.name}: {len(mapped)}/{last-first} ({coverage:.1%})", flush=True)
    (ROOT / f"libro-{book:02d}-alignment-report.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if min(x["coverage"] for x in summary) < 0.55:
        print("WARNING: low coverage; manual verification required", flush=True)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--book", type=int, required=True, choices=range(1, 5))
    parser.add_argument("--model", default="small")
    args = parser.parse_args()
    run(args.book, args.model)
