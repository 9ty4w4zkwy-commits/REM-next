#!/usr/bin/env python3
"""Generate a word-level audio timeline for any Pinocchio chapter using Whisper."""
import argparse, json, re, unicodedata, urllib.request, html
from difflib import SequenceMatcher
from pathlib import Path
from bs4 import BeautifulSoup
import whisper

def normalize(s):
    return ''.join(c for c in unicodedata.normalize('NFKD',s.lower()) if c.isalnum() and not unicodedata.combining(c))

def tokens(s):
    return [(normalize(m.group()),m.start(),m.end()) for m in re.finditer(r"[^\W_]+(?:['’][^\W_]+)*",s,re.UNICODE)]

parser=argparse.ArgumentParser()\nparser.add_argument("--chapter",type=int,default=1)\nargs=parser.parse_args()\nif not 1<=args.chapter<=36: parser.error("chapter must be 1..36")\napi=f"https://it.wikisource.org/w/api.php?action=parse&format=json&formatversion=2&prop=text&page=Le_avventure_di_Pinocchio/Capitolo_{args.chapter}"
request=urllib.request.Request(api,headers={"User-Agent":"REMNextAudioAlignment/1.0 (GitHub Actions)"})
with urllib.request.urlopen(request,timeout=60) as response:
    payload=json.load(response)
soup=BeautifulSoup(payload["parse"]["text"],"html.parser")
root=soup.select_one(".mw-parser-output") or soup
for node in root.select("style,script,table,.mw-editsection,.ws-noexport,.noprint,.mw-cite-backlink,.reference,.mw-references-wrap,.printfooter,.catlinks,.mw-parser-output > nav,.header-container,.ws-summary,.ws-title"):
    node.decompose()
paragraphs=[re.sub(r'\s+',' ',p.get_text()).strip() for p in root.select('p')]
content='\n\n'.join(p for p in paragraphs if len(p)>25)
source=tokens(content)
audio=f"audio/pinocchio/capitolo-{args.chapter:02d}.m4a"\nif not Path(audio).is_file(): raise FileNotFoundError(audio)
model=whisper.load_model("small")
result=model.transcribe(audio,language="it",word_timestamps=True,fp16=False,verbose=False)
spoken=[(normalize(w["word"]),float(w["start"]),float(w["end"])) for seg in result["segments"] for w in seg.get("words",[]) if normalize(w["word"])]
matcher=SequenceMatcher(None,[w[0] for w in source],[w[0] for w in spoken],autojunk=False)
mapped=[]
for tag,a,b,c,d in matcher.get_opcodes():
    if tag=="equal":
        for i,j in zip(range(a,b),range(c,d)):
            mapped.append({"offset":source[i][1],"start":round(spoken[j][1],3),"end":round(spoken[j][2],3)})
coverage=len(mapped)/max(1,len(source))
output={"chapter":f"capitolo-{args.chapter}","method":"whisper-small-word-timestamps","coverage":round(coverage,3),"duration":round(max((w[2] for w in spoken),default=0),3),"words":mapped}
Path(f"audio/pinocchio/capitolo-{args.chapter:02d}.words.json").write_text(json.dumps(output,ensure_ascii=False,separators=(',',':')),encoding="utf-8")
print(f"Matched {len(mapped)}/{len(source)} words, coverage {coverage:.1%}")
if coverage<0.55:
    raise RuntimeError("Alignment coverage too low: check that audio and ebook contain the same text")
