"""Generate deterministic Miguelito placeholder PNGs and his data manifest.

Miguelito is a proof-of-concept second resident used to build and test the
multi-resident village framework (talking to other residents, proximity,
etc.) before his real artwork exists. Distinct silhouette/palette from
Pepita on purpose, so it's obvious at a glance which resident is which
during development.
"""
from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
CHARACTER_ROOT = ROOT / "assets" / "characters" / "miguelito"
DIRECTIONS = ("down", "left", "right", "up")

ANIMATIONS = {}

def directed(name, frames, fps, loop=True):
    for direction in DIRECTIONS:
        ANIMATIONS[f"{name}_{direction}"] = (f"{name}/{direction}", frames, fps, loop)

directed("idle", 1, 1)
directed("walk", 6, 10)
directed("talk", 4, 8)

palette = {
    "outline": "#1c2340", "skin": "#f0dcc0", "hoodie": "#2f5fb0",
    "hoodie_dark": "#1e3f80", "beanie": "#8a3fc9", "shoe": "#4a3222"
}

def font(size=9):
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ]
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            pass
    return ImageFont.load_default()

def draw_miguelito(animation, frame, direction):
    image = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    bounce = -2 if "walk" in animation and frame % 2 else 0
    baseline = 119
    step = 6 if ("walk" in animation and frame % 2) else -6 if "walk" in animation else 0
    draw.ellipse((46 - step, baseline - 8, 61 - step, baseline - 2), fill=palette["shoe"], outline=palette["outline"], width=2)
    draw.ellipse((67 + step, baseline - 8, 82 + step, baseline - 2), fill=palette["shoe"], outline=palette["outline"], width=2)
    draw.rounded_rectangle((45, 76 + bounce, 83, 110), 10, fill=palette["hoodie"], outline=palette["outline"], width=3)
    draw.polygon([(45, 90 + bounce), (34, 78 + bounce), (40, 100)], fill=palette["hoodie_dark"], outline=palette["outline"])
    draw.polygon([(83, 90 + bounce), (94, 78 + bounce), (88, 100)], fill=palette["hoodie_dark"], outline=palette["outline"])
    draw.ellipse((37, 32 + bounce, 91, 82 + bounce), fill=palette["skin"], outline=palette["outline"], width=3)
    eye_shift = -3 if direction == "left" else 3 if direction == "right" else 0
    if direction != "up":
        draw.ellipse((49 + eye_shift, 52 + bounce, 58 + eye_shift, 61 + bounce), fill=palette["outline"])
        draw.ellipse((70 + eye_shift, 52 + bounce, 79 + eye_shift, 61 + bounce), fill=palette["outline"])
        mouth_open = 6 if "talk" in animation and frame % 2 else 2
        draw.ellipse((58, 65 + bounce, 70, 65 + bounce + mouth_open + 3), fill=palette["outline"])
    draw.pieslice((35, 20 + bounce, 93, 60 + bounce), 180, 360, fill=palette["beanie"], outline=palette["outline"], width=3)
    label = animation.replace("_", " ")
    draw.rounded_rectangle((6, 8, 122, 22), 4, fill=(28, 35, 64, 225))
    draw.text((64, 8), f"{label} {frame:02}", anchor="ma", fill="white", font=font(8))
    return image

manifest_animations = {}
for name, (folder, count, fps, loop) in ANIMATIONS.items():
    direction = name.rsplit("_", 1)[-1]
    prefix = name
    paths = []
    target = CHARACTER_ROOT / folder
    target.mkdir(parents=True, exist_ok=True)
    for frame in range(count):
        filename = f"miguelito_{prefix}_{frame:02}.png"
        relative = f"{folder}/{filename}"
        draw_miguelito(name, frame, direction).save(target / filename)
        paths.append(relative)
    manifest_animations[name] = {"frames": count, "fps": fps, "loop": loop, "paths": paths}

manifest = {
    "schemaVersion": 1,
    "id": "miguelito", "displayName": "Miguelito", "role": "mischievous kid",
    "frameWidth": 128, "frameHeight": 128, "defaultDirection": "down",
    "visualReference": {
        "status": "placeholder-only",
        "description": "Proof-of-concept second resident for the multi-resident village framework. Blue hoodie, purple beanie. Not final art.",
        "palette": palette,
        "baselineY": 119, "padding": 8, "bakedShadow": False
    },
    "movement": {"walkSpeed": 62, "skipSpeed": 80},
    "anchors": {"feet": [64, 119], "interaction": [64, 126]},
    "collisionBox": {"x": 42, "y": 72, "width": 44, "height": 47},
    "states": ["idle", "walking", "skipping", "talking", "dancing", "performingAction", "sitting", "sleeping", "falling", "disabled"],
    "statePriority": ["disabled", "falling", "performingAction", "talking", "dancing", "skipping", "walking", "sitting", "sleeping", "idle"],
    "personality": {
        "decisionIntervalMs": [2000, 6000],
        "autonomousBehaviours": [
            {"action": "idle", "weight": 0.55}, {"action": "walk", "weight": 0.45}
        ]
    },
    "interactionHooks": ["playerTouch", "otherCharacters"],
    "animations": manifest_animations
}
(CHARACTER_ROOT / "character.json").write_text(json.dumps(manifest, indent=2) + "\n")
print(f"Generated {sum(a[1] for a in ANIMATIONS.values())} placeholder frames across {len(ANIMATIONS)} animations.")
