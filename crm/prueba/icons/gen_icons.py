"""Genera los iconos PWA + Android (launcher) del CRM a partir del logo oficial.
Quita el fondo blanco del logo (flood-fill desde las esquinas + erosion de 1px
para el fleco de antialiasing) y compone cada variante sobre el color de marca
o transparente segun corresponda. Correr una vez (o cuando cambie el logo).
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

HERE = Path(__file__).parent
SRC = Path(r"C:\Users\Usuario\Claude\CRM\logo_oficial_1024.png")
ANDROID_RES = Path(r"C:\Users\Usuario\Claude\CRM\lotus-crm-mobile\android\app\src\main\res")
THEME_COLOR = (8, 11, 22)  # #080b16

ANDROID_DENSITIES = {
    "mdpi": (48, 108),
    "hdpi": (72, 162),
    "xhdpi": (96, 216),
    "xxhdpi": (144, 324),
    "xxxhdpi": (192, 432),
}


def logo_sin_fondo():
    im = Image.open(SRC).convert("RGBA")
    w, h = im.size
    for corner in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        ImageDraw.floodfill(im, corner, (0, 0, 0, 0), thresh=60)
    r, g, b, a = im.split()
    a = a.filter(ImageFilter.MinFilter(3))
    im = Image.merge("RGBA", (r, g, b, a))
    return im.crop(im.getbbox())


def compose(logo, canvas_size, scale, bg=None):
    canvas = Image.new("RGBA", (canvas_size, canvas_size), bg + (255,) if bg else (0, 0, 0, 0))
    target = int(canvas_size * scale)
    scaled = logo.copy()
    scaled.thumbnail((target, target), Image.LANCZOS)
    x = (canvas_size - scaled.width) // 2
    y = (canvas_size - scaled.height) // 2
    canvas.alpha_composite(scaled, (x, y))
    return canvas


def badge(logo):
    icon = compose(logo, 72, 0.62, None)
    blanco = Image.new("RGBA", icon.size, (255, 255, 255, 0))
    blanco.putalpha(icon.getchannel("A"))
    return blanco


def main():
    logo = logo_sin_fondo()

    # --- PWA / web ---
    compose(logo, 192, 0.72, THEME_COLOR).convert("RGB").save(HERE / "icon-192.png")
    compose(logo, 512, 0.72, THEME_COLOR).convert("RGB").save(HERE / "icon-512.png")
    compose(logo, 512, 0.58, THEME_COLOR).convert("RGB").save(HERE / "icon-maskable-512.png")
    compose(logo, 192, 0.58, THEME_COLOR).convert("RGB").save(HERE / "icon-maskable-192.png")
    badge(logo).save(HERE / "badge-72.png")
    compose(logo, 180, 0.72, THEME_COLOR).convert("RGB").save(HERE / "apple-touch-icon.png")
    print("Iconos PWA generados en", HERE)

    # --- Android (Capacitor) ---
    if ANDROID_RES.is_dir():
        for density, (legacy_size, fg_size) in ANDROID_DENSITIES.items():
            d = ANDROID_RES / f"mipmap-{density}"
            compose(logo, legacy_size, 0.66, THEME_COLOR).convert("RGB").save(d / "ic_launcher.png")
            compose(logo, legacy_size, 0.66, THEME_COLOR).convert("RGB").save(d / "ic_launcher_round.png")
            compose(logo, fg_size, 0.58, None).save(d / "ic_launcher_foreground.png")
        bg_xml = ANDROID_RES / "values" / "ic_launcher_background.xml"
        bg_xml.write_text(
            '<?xml version="1.0" encoding="utf-8"?>\n'
            "<resources>\n"
            f'    <color name="ic_launcher_background">#{THEME_COLOR[0]:02x}{THEME_COLOR[1]:02x}{THEME_COLOR[2]:02x}</color>\n'
            "</resources>\n",
            encoding="utf-8",
        )
        print("Iconos Android generados en", ANDROID_RES)
    else:
        print("(saltado Android: no existe", ANDROID_RES, "-- correr sync-mobile/cap add android primero)")


if __name__ == "__main__":
    main()
