"""Generate SongMatch store assets: icon, adaptive foreground, splash."""
import os
from PIL import Image, ImageDraw, ImageFont

BG = (7, 7, 8, 255)
LIME = (200, 255, 61, 255)
OUT = "mobile/assets"
os.makedirs(OUT, exist_ok=True)

HELV = "/System/Library/Fonts/Helvetica.ttc"


def draw_note(d: ImageDraw.ImageDraw, cx: int, cy: int, s: float, color=LIME):
    """Eighth-note motif: head ellipse + stem + flag."""
    # Head (tilted ellipse)
    d.ellipse([cx - 52 * s, cy + 18 * s, cx + 28 * s, cy + 78 * s], fill=color)
    # Stem
    d.rectangle([cx + 20 * s, cy - 110 * s, cx + 36 * s, cy + 48 * s], fill=color)
    # Flag/beam curve approximated with a thick arc (chord)
    d.arc([cx - 60 * s, cy - 150 * s, cx + 90 * s, cy - 20 * s],
          start=300, end=90, fill=color, width=int(18 * s))


def icon():
    img = Image.new("RGBA", (1024, 1024), BG)
    d = ImageDraw.Draw(img)
    draw_note(d, 512, 512, 2.1)
    img.save(f"{OUT}/icon.png")


def adaptive_foreground():
    # Transparent bg; artwork inside the 72dp safe circle (~440px radius zone)
    img = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    draw_note(d, 512, 540, 1.7)
    img.save(f"{OUT}/adaptive-icon.png")


def splash():
    W, H = 1242, 2436
    img = Image.new("RGBA", (W, H), BG)
    d = ImageDraw.Draw(img)
    draw_note(d, W // 2, H // 2 - 120, 2.4)
    try:
        font = ImageFont.truetype(HELV, 96)
        small = ImageFont.truetype(HELV, 44)
    except OSError:
        font = ImageFont.load_default()
        small = font
    for text, f, y, fill in [
        ("songmatch", font, H // 2 + 260, (245, 245, 247, 255)),
        ("SING WHAT SUITS YOUR VOICE", small, H // 2 + 380, (184, 184, 192, 255)),
    ]:
        box = d.textbbox((0, 0), text, font=f)
        d.text(((W - (box[2] - box[0])) / 2, y), text, font=f, fill=fill)
    img.save(f"{OUT}/splash.png")


icon()
adaptive_foreground()
splash()
print("assets written:", sorted(os.listdir(OUT)))
