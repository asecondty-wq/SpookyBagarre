"""Measure how much a Tripo model is turned about the vertical axis, so prep/rig can face it straight.

The A-pose images are drawn with a slight three-quarter turn, so the models come out turned by 5 to 20 degrees.
The arm span (the widest horizontal axis of the upper body) should lie along x. Prints the corrected rotz.

  run.ps1 yaw.py --id micron --height 1.85 --rotz -90
"""
import os
import sys
import math
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "lib"))
import sb  # noqa: E402

A = sb.args()
cid = A["id"]
h = float(A.get("height", 1.7))
rotz = float(A.get("rotz", 0))
lo, hi = float(A.get("lo", 0.3)), float(A.get("hi", 0.8))
src = os.path.join(sb.ROOT, "tools", "art", "tripo", cid + ".glb")
sb.reset()
body = sb.load_character(src, h, rotz)
pts = [(v.co.x, v.co.y) for v in body.data.vertices if lo * h <= v.co.z <= hi * h]
mx = sum(p[0] for p in pts) / len(pts)
my = sum(p[1] for p in pts) / len(pts)
sxx = sum((p[0] - mx) ** 2 for p in pts)
syy = sum((p[1] - my) ** 2 for p in pts)
sxy = sum((p[0] - mx) * (p[1] - my) for p in pts)
theta = 0.5 * math.atan2(2 * sxy, sxx - syy)  # major axis angle
deg = math.degrees(theta)
if deg > 45:
    deg -= 90
if deg < -45:
    deg += 90
sb.log("major axis %.1f deg (spread x %.3f y %.3f) -> rotz %.1f" % (deg, math.sqrt(sxx / len(pts)), math.sqrt(syy / len(pts)), rotz - deg))


def side_angle(ps, frac):
    xmax = max(p[0] for p in ps)
    xmin = min(p[0] for p in ps)
    L = [p for p in ps if p[0] > xmax * frac]
    R = [p for p in ps if p[0] < xmin * frac]
    if not L or not R:
        return float("nan")
    lx, ly = sum(p[0] for p in L) / len(L), sum(p[1] for p in L) / len(L)
    rx, ry = sum(p[0] for p in R) / len(R), sum(p[1] for p in R) / len(R)
    return math.degrees(math.atan2(ly - ry, lx - rx))


hands = side_angle(pts, 0.75)
feet = side_angle([(v.co.x, v.co.y) for v in body.data.vertices if v.co.z < 0.07 * h], 0.4)
sb.log("hands %.1f deg -> rotz %.1f | feet %.1f deg -> rotz %.1f" % (hands, rotz - hands, feet, rotz - feet))
