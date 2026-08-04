"""Generate deterministic Pepita placeholder PNGs and her data manifest."""
from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
CHARACTER_ROOT = ROOT / "assets" / "characters" / "pepita"
DIRECTIONS = ("down", "left", "right", "up")

ANIMATIONS = {}

def directed(name, frames, fps, loop=True):
    for direction in DIRECTIONS:
        ANIMATIONS[f"{name}_{direction}"] = (f"{name}/{direction}", frames, fps, loop, {})

directed("idle", 6, 6)
directed("walk", 8, 10)
directed("skip", 8, 12)
directed("talk", 6, 8)
ANIMATIONS["dance_down"] = ("dance/down", 12, 12, True, {})

for expression in ("happy", "excited", "sad", "angry", "scared", "surprised", "confused", "love", "laughing", "sleepy"):
    ANIMATIONS[f"expression_{expression}"] = (f"expressions/{expression}", 1, 1, False, {})

actions = {
    "wave": (6, 10, {}), "clap": (6, 10, {}),
    "smell_flowers": (8, 10, {}), "arrange_bouquet": (10, 10, {}),
    "throw_petals": (8, 12, {"4": "spawn_petals"}),
    "water_flowers": (10, 10, {"4": "spawn_water"}),
    "give_flower": (8, 10, {"4": "transfer_flower"}),
    "sit": (4, 6, {}), "sleep": (6, 4, {}), "fall": (6, 10, {}),
    "celebrate": (10, 12, {}),
}
for name, (frames, fps, events) in actions.items():
    ANIMATIONS[name] = (f"actions/{name}", frames, fps, False, events)

palette = {
    "outline": "#3b2146", "cream": "#fff1d1", "purple": "#733d91",
    "pink": "#ed5791", "orange": "#f39a3c", "turquoise": "#47c4ba",
    "brown": "#70422f", "hair": "#2b2131"
}

def font(size=10):
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

def draw_pepita(animation, frame, direction):
    image = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    bounce = -2 if ("walk" in animation or "skip" in animation) and frame % 2 else 0
    cx, baseline = 64, 119
    # Feet, dress, braids, skull and crown share fixed anchors across every placeholder.
    draw.ellipse((45, baseline-8, 60, baseline-2), fill=palette["brown"], outline=palette["outline"], width=2)
    draw.ellipse((68, baseline-8, 83, baseline-2), fill=palette["brown"], outline=palette["outline"], width=2)
    draw.polygon([(47, 74+bounce), (81, 74+bounce), (88, 109), (40, 109)], fill=palette["purple"], outline=palette["outline"])
    draw.line((50, 88+bounce, 78, 88+bounce), fill=palette["turquoise"], width=3)
    draw.arc((47, 91+bounce, 81, 105), 0, 180, fill=palette["orange"], width=2)
    draw.line((43, 64+bounce, 36, 98), fill=palette["hair"], width=7)
    draw.line((85, 64+bounce, 92, 98), fill=palette["hair"], width=7)
    draw.ellipse((35, 30+bounce, 93, 82+bounce), fill=palette["cream"], outline=palette["outline"], width=3)
    eye_shift = -2 if direction == "left" else 2 if direction == "right" else 0
    if direction != "up":
        draw.ellipse((48+eye_shift, 49+bounce, 57+eye_shift, 61+bounce), fill=palette["outline"])
        draw.ellipse((70+eye_shift, 49+bounce, 79+eye_shift, 61+bounce), fill=palette["outline"])
        draw.arc((57, 61+bounce, 72, 73+bounce), 15, 165, fill=palette["pink"], width=2)
    else:
        draw.arc((47, 51+bounce, 80, 68+bounce), 190, 350, fill=palette["outline"], width=3)
    for x, color in ((45, palette["orange"]), (56, palette["pink"]), (67, palette["turquoise"]), (78, palette["orange"])):
        draw.ellipse((x-6, 28+bounce, x+6, 39+bounce), fill=color, outline=palette["outline"], width=1)
    # Basket stays on Pepita's right side; right-facing art is not mechanically flipped.
    draw.arc((75, 77+bounce, 103, 99+bounce), 180, 360, fill=palette["brown"], width=3)
    draw.rounded_rectangle((78, 87+bounce, 101, 103+bounce), 4, fill=palette["orange"], outline=palette["outline"], width=2)
    label = animation.replace("expression_", "expr ").replace("_", " ")
    draw.rounded_rectangle((8, 8, 120, 23), 4, fill=(59, 33, 70, 225))
    draw.text((64, 8), f"{label} {frame:02}", anchor="ma", fill="white", font=font(9))
    draw.line((54, baseline, 74, baseline), fill=palette["turquoise"], width=1)
    return image

manifest_animations = {}
for name, (folder, count, fps, loop, events) in ANIMATIONS.items():
    direction = name.rsplit("_", 1)[-1] if name.rsplit("_", 1)[-1] in DIRECTIONS else "down"
    prefix = name.replace("expression_", "")
    paths = []
    target = CHARACTER_ROOT / folder
    target.mkdir(parents=True, exist_ok=True)
    for frame in range(count):
        filename = f"pepita_{prefix}_{frame:02}.png"
        relative = f"{folder}/{filename}"
        draw_pepita(name, frame, direction).save(target / filename)
        paths.append(relative)
    manifest_animations[name] = {"frames": count, "fps": fps, "loop": loop, "paths": paths}
    if events:
        manifest_animations[name]["events"] = events

manifest = {
    "schemaVersion": 1,
    "id": "pepita", "displayName": "Pepita", "role": "florist",
    "frameWidth": 128, "frameHeight": 128, "defaultDirection": "down",
    "visualReference": {
        "status": "concept-only-not-included",
        "description": "Cheerful chibi Dia de los Muertos skeleton florist with flower crown, braids, purple embroidered dress, brown shoes and flower basket.",
        "palette": palette,
        "baselineY": 119, "padding": 8, "bakedShadow": False
    },
    "movement": {"walkSpeed": 55, "skipSpeed": 75},
    "anchors": {"feet": [64, 119], "interaction": [64, 126]},
    "collisionBox": {"x": 42, "y": 72, "width": 44, "height": 47},
    "states": ["idle", "walking", "skipping", "talking", "dancing", "performingAction", "sitting", "sleeping", "falling", "disabled"],
    "statePriority": ["disabled", "falling", "performingAction", "talking", "dancing", "skipping", "walking", "sitting", "sleeping", "idle"],
    "personality": {
        "decisionIntervalMs": [2000, 6000],
        "autonomousBehaviours": [
            {"action": "idle", "weight": 0.50}, {"action": "walk", "weight": 0.25},
            {"action": "skip", "weight": 0.10}, {"action": "smell_flowers", "weight": 0.05},
            {"action": "arrange_bouquet", "weight": 0.05}, {"action": "wave", "weight": 0.05}
        ]
    },
    "interactionHooks": ["playerTouch", "flowers", "flowerBeds", "wateringCan", "otherCharacters", "xolo", "festivalStage", "benches", "floristStall"],
    "animations": manifest_animations
}
(CHARACTER_ROOT / "character.json").write_text(json.dumps(manifest, indent=2) + "\n")
print(f"Generated {sum(item[1] for item in ANIMATIONS.values())} placeholder frames across {len(ANIMATIONS)} animations.")
