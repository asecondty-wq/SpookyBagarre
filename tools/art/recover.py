"""Codex generates the images but often fails to copy them into the sandboxed folder.
Read a log of refs.ps1 / apose.ps1 and copy each generated image to <dir>/<name>.png.

  python recover.py <log file> <target dir>
"""
import os
import re
import shutil
import sys

log, dst = sys.argv[1], sys.argv[2]
home = os.path.expanduser("~")
last = None
for line in open(log, encoding="utf-8", errors="replace"):
    m = re.search(r"generated_images[/\\][^>)\]\s]+?\.png", line)
    if m:
        last = os.path.join(home, ".codex", m.group(0).replace("/", os.sep))
    m2 = re.match(r"MISSING (\w+)", line.strip())
    if m2 and last:
        name = m2.group(1)
        target = os.path.join(dst, name + ".png")
        if os.path.exists(last) and not os.path.exists(target):
            shutil.copy(last, target)
            print("recovered", name)
        last = None
