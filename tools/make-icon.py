"""Generate the Razor City launcher icon from its own title and color palette."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
RES = ROOT / 'android/app/src/main/res'
FONT = '/usr/share/fonts/opentype/urw-base35/NimbusSansNarrow-Bold.otf'
DARK = '#0c0e0b'
GOLD = '#e0b15a'
PAPER = '#f3ead6'
BLOOD = '#ff8f78'
S = 1024

def design(transparent=False):
    im = Image.new('RGBA', (S,S), (0,0,0,0) if transparent else DARK)
    d = ImageDraw.Draw(im)
    # Distant port skyline and a street taper toward the title.
    d.polygon([(168,630),(168,410),(218,410),(218,482),(262,482),(262,380),(312,380),(312,507),(367,507),(367,447),(405,447),(405,600)], fill='#343b2a')
    d.polygon([(616,590),(616,470),(666,470),(666,386),(717,386),(717,493),(764,493),(764,419),(812,419),(812,636)], fill='#343b2a')
    d.line([(195,292),(829,292)], fill=GOLD, width=18)
    d.polygon([(728,284),(837,284),(794,312),(728,312)], fill=BLOOD)
    for label, size, y, color in [('RAZOR',148,330,GOLD),('CITY',224,478,PAPER)]:
        font = ImageFont.truetype(FONT,size)
        box=d.textbbox((0,0),label,font=font,stroke_width=0)
        x=(S-(box[2]-box[0]))//2
        d.text((x,y),label,font=font,fill=color,stroke_width=3,stroke_fill=DARK)
    d.rectangle((205,748,819,764),fill=GOLD)
    d.rectangle((205,780,495,788),fill=BLOOD)
    return im

icon=design()
icon.save(ROOT/'public/razor-city-icon.png',optimize=True)
for density,px in [('mdpi',48),('hdpi',72),('xhdpi',96),('xxhdpi',144),('xxxhdpi',192)]:
    dest=RES/f'mipmap-{density}'
    for name in ['ic_launcher.png','ic_launcher_round.png']:
        icon.resize((px,px),Image.Resampling.LANCZOS).save(dest/name,optimize=True)
    foreground=design(True).resize((px*9//4,px*9//4),Image.Resampling.LANCZOS)
    foreground.save(dest/'ic_launcher_foreground.png',optimize=True)
