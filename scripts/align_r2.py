#!/usr/bin/env python3
"""Manual R2 alignment: exact input text and original remote audio; no audio committed."""
import argparse
import hashlib
import json
import math
import re
import subprocess
import tempfile
import unicodedata
import urllib.request
from difflib import SequenceMatcher
from pathlib import Path
from urllib.parse import quote
import whisper

BASE = "https://rem-audio.9ty4w4zkwy.workers.dev/"
def norm(s):
    return "".join(c for c in unicodedata.normalize("NFKD", s.lower()) if c.isalnum() and not unicodedata.combining(c))

def tokens(text):
    offsets = [0]
    for char in text:
        offsets.append(offsets[-1] + (2 if ord(char) > 0xffff else 1))
    return [(norm(m.group()), offsets[m.start()]) for m in re.finditer(r"[^\W_]+(?:['’][^\W_]+)*", text)]

def download(book, name, target):
    if not re.fullmatch(r"[A-Za-z0-9_-][A-Za-z0-9_. -]*\.(?:m4a|mp3|m4b|aac|ogg|wav)", name, re.I):
        raise ValueError("Invalid audio filename")
    request = urllib.request.Request(BASE + book + "/" + quote(name), headers={"User-Agent": "REM-alignment/1.0"})
    with urllib.request.urlopen(request, timeout=120) as response, target.open("wb") as out:
        if response.status != 200 or not response.headers.get("Content-Type", "").startswith("audio/"):
            raise RuntimeError("Invalid audio response")
        expected = response.headers.get("Content-Length")
        digest = hashlib.sha256()
        size = 0
        while chunk := response.read(1024 * 1024):
            out.write(chunk)
            digest.update(chunk)
            size += len(chunk)
        if not size or (expected is not None and size != int(expected)):
            raise RuntimeError("Incomplete audio download")
    print(f"{name}: {size} bytes SHA256 {digest.hexdigest()}", flush=True)
    return digest.hexdigest()

def duration(path):
    value = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(path)], text=True))
    if not math.isfinite(value) or value <= 0:
        raise RuntimeError("Invalid audio duration")
    return value

def align(book, text_paths, tracks, output_dir, model, chapter_mode):
    source, boundaries = [], []
    for path in text_paths:
        start = len(source)
        content = path.read_bytes().decode("utf-8")
        if content.startswith("\ufeff"):
            raise RuntimeError("Remove BOM before alignment")
        source.extend(tokens(content))
        boundaries.append((path, start, len(source)))
    spoken, durations, hashes = [], [], []
    shift = 0.0
    with tempfile.TemporaryDirectory() as tmp:
        for i, name in enumerate(tracks):
            audio = Path(tmp) / f"{i}{Path(name).suffix}"
            hashes.append(download(book, name, audio))
            length = duration(audio)
            result = model.transcribe(str(audio), language="it", word_timestamps=True, fp16=False, verbose=False)
            for segment in result["segments"]:
                for word in segment.get("words", []):
                    key, start, end = norm(word["word"]), float(word["start"]), float(word["end"])
                    if key and math.isfinite(start) and math.isfinite(end) and 0 <= start <= end <= length + .2:
                        spoken.append((key, round(shift + min(start, length), 3), round(shift + min(end, length), 3)))
            durations.append(length)
            shift += length
    matched = {}
    matcher = SequenceMatcher(None, [x[0] for x in source], [x[0] for x in spoken], autojunk=False)
    for tag, a, b, c, d in matcher.get_opcodes():
        if tag == "equal":
            for i, j in zip(range(a,b), range(c,d)):
                matched[i] = {"offset":source[i][1], "start":spoken[j][1], "end":spoken[j][2]}
    pending = []
    for path, first, last in boundaries:
        words = [matched[i] for i in range(first,last) if i in matched]
        coverage = len(words)/max(1,last-first)
        chapter = path.stem.replace(" 2","")
        data = {"chapter":chapter,"method":"whisper-small-word-timestamps","coverage":round(coverage,3),"duration":round(shift,3),"matched":len(words),"total":last-first,"parts":tracks,"partDurations":durations,"audioSha256":hashes,"words":words}
        if coverage < .55 or not words or any(a["offset"]>=b["offset"] or a["start"]>b["start"] for a,b in zip(words,words[1:])):
            raise RuntimeError(f"{chapter}: invalid alignment ({coverage:.1%})")
        print(f"{chapter}: {coverage:.1%} matched",flush=True)
        pending.append((output_dir / (path.stem+".words.json"),data))
    output_dir.mkdir(parents=True,exist_ok=True)
    for path,data in pending:
        path.write_text(json.dumps(data,ensure_ascii=False,separators=(",",":")),encoding="utf-8")

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--book", choices=["montecristo","metamorfosi-ovidio"], required=True)
    p.add_argument("--first",type=int,required=True)
    p.add_argument("--last",type=int,required=True)
    p.add_argument("--tracks",default="")
    args=p.parse_args()
    root=Path("content/books")/args.book
    if args.book=="montecristo":
        if not 21<=args.first<=args.last<=120:
            p.error("Select chapters 21–120")
        model=whisper.load_model("small")
        for n in range(args.first,args.last+1):
            stem=f"capitolo-{n:02d}"
            align(args.book,[root/(stem+".txt")],[stem+".m4a"],Path("audio/montecristo"),model,True)
    else:
        if not 5<=args.first==args.last<=15:
            p.error("Select one Ovidio book 5–15")
        tracks=[s.strip() for s in args.tracks.split(",") if s.strip()]
        files=sorted(root.glob(f"libro-{args.first:02d}-capitolo-??*.txt"))
        if not tracks or not files or len(set(tracks))!=len(tracks):
            p.error("Provide ordered unique MP3 filenames and exact text chapters")
        align(args.book,files,tracks,root,whisper.load_model("small"),False)

if __name__=="__main__":
    main()
