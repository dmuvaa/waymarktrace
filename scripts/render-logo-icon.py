from PIL import Image, ImageDraw

INK = (23, 39, 42, 255)
PAPER = (243, 241, 234, 255)
NEEDLE = (212, 83, 72, 255)


def draw_logo(size: int) -> Image.Image:
    scale = 8
    canvas = size * scale
    image = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    unit = canvas / 64

    def point(x: float, y: float) -> tuple[float, float]:
        return (x * unit, y * unit)

    radius = 14 * unit
    draw.rounded_rectangle((0, 0, canvas - 1, canvas - 1), radius=radius, fill=INK)
    box = [point(11.5, 11.5), point(52.5, 52.5)]
    draw.ellipse(box, outline=PAPER, width=max(1, round(2.4 * unit)))

    tick = max(1, round(1.8 * unit))
    for start, end in (
        ((32, 7.4), (32, 10.8)),
        ((32, 53.2), (32, 56.6)),
        ((7.4, 32), (10.8, 32)),
        ((53.2, 32), (56.6, 32)),
    ):
        draw.line([point(*start), point(*end)], fill=PAPER, width=tick)

    draw.polygon([point(32, 14.5), point(37.2, 32), point(32, 32), point(26.8, 32)], fill=NEEDLE)
    draw.polygon([point(32, 49.5), point(26.8, 32), point(32, 32), point(37.2, 32)], fill=PAPER)
    center = 1.35 * unit
    draw.ellipse(
        (canvas / 2 - center, canvas / 2 - center, canvas / 2 + center, canvas / 2 + center),
        fill=INK,
    )
    return image.resize((size, size), Image.Resampling.LANCZOS)


logo = draw_logo(256)
logo.save("/tmp/waymarktrace-logo.png")
logo.save("src/app/favicon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
