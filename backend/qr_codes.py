import io
import uuid
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter
import qrcode

QR_SCHEME_PREFIX = "nexa:u/"
MARK_PATH = Path(__file__).resolve().parent / "assets" / "nexa-n-mark.png"

MODULE_PX = 12
BORDER_MODULES = 1
SUPERSAMPLE = 4
FINDER_SIZE = 7
MODULE_INSET = 0.16
LOGO_RATIO = 0.27


def new_qr_token() -> str:
    return str(uuid.uuid4())


def qr_payload(username: str, token: str) -> str:
    return f"{QR_SCHEME_PREFIX}{username}"


def render_qr_png(payload: str) -> bytes:
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=1,
        border=0,
    )
    qr.add_data(payload)
    qr.make(fit=True)
    image = _render_liquid_matrix(qr.get_matrix())
    buffer = io.BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()


def build_user_qr_png(username: str, token: str) -> bytes:
    return render_qr_png(qr_payload(username, token))


def _in_finder(row: int, col: int, n: int) -> bool:
    if row < FINDER_SIZE and col < FINDER_SIZE:
        return True
    if row < FINDER_SIZE and col >= n - FINDER_SIZE:
        return True
    if row >= n - FINDER_SIZE and col < FINDER_SIZE:
        return True
    return False


def _finder_origins(n: int) -> list[tuple[int, int]]:
    last = n - FINDER_SIZE
    return [(0, 0), (0, last), (last, 0)]


def _render_liquid_matrix(matrix: list[list[bool]]) -> Image.Image:
    n = len(matrix)
    cell = MODULE_PX * SUPERSAMPLE
    canvas = (n + BORDER_MODULES * 2) * cell

    layer = Image.new("L", (canvas, canvas), 0)
    draw = ImageDraw.Draw(layer)
    inset = max(1, int(cell * MODULE_INSET))

    for row, line in enumerate(matrix):
        for col, on in enumerate(line):
            if not on or _in_finder(row, col, n):
                continue
            x = (col + BORDER_MODULES) * cell
            y = (row + BORDER_MODULES) * cell
            draw.ellipse(
                (x + inset, y + inset, x + cell - 1 - inset, y + cell - 1 - inset),
                fill=255,
            )
            if col + 1 < n and line[col + 1] and not _in_finder(row, col + 1, n):
                draw.rectangle(
                    (x + cell // 2, y + inset, x + cell + cell // 2, y + cell - 1 - inset),
                    fill=255,
                )
            if row + 1 < n and matrix[row + 1][col] and not _in_finder(row + 1, col, n):
                draw.rectangle(
                    (x + inset, y + cell // 2, x + cell - 1 - inset, y + cell + cell // 2),
                    fill=255,
                )

    melted = layer.filter(ImageFilter.GaussianBlur(radius=max(1.0, cell * 0.10)))
    melted = melted.point(lambda pixel: 255 if pixel >= 128 else 0)

    color = melted.convert("RGB")
    draw_color = ImageDraw.Draw(color)
    for row, col in _finder_origins(n):
        _draw_finder(draw_color, row, col, cell)

    color = _embed_logo(color)
    final_size = canvas // SUPERSAMPLE
    return color.resize((final_size, final_size), Image.Resampling.LANCZOS)


def _draw_finder(draw: ImageDraw.ImageDraw, row: int, col: int, cell: int) -> None:
    x = (col + BORDER_MODULES) * cell
    y = (row + BORDER_MODULES) * cell
    outer = FINDER_SIZE * cell
    draw.rounded_rectangle(
        (x, y, x + outer, y + outer),
        radius=cell * 1.65,
        fill=(255, 255, 255),
    )
    inner = cell
    draw.rounded_rectangle(
        (x + inner, y + inner, x + outer - inner, y + outer - inner),
        radius=cell * 1.05,
        fill=(0, 0, 0),
    )
    pupil = cell * 2
    draw.rounded_rectangle(
        (x + pupil, y + pupil, x + outer - pupil, y + outer - pupil),
        radius=cell * 0.85,
        fill=(255, 255, 255),
    )


def _embed_logo(image: Image.Image) -> Image.Image:
    canvas = image.size[0]
    out = image.convert("RGBA")
    overlay = Image.new("RGBA", out.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    diameter = max(48, int(canvas * LOGO_RATIO))
    radius = diameter / 2
    cx = cy = canvas / 2
    pad = max(6, int(canvas * 0.014))
    draw.ellipse(
        (cx - radius - pad, cy - radius - pad, cx + radius + pad, cy + radius + pad),
        fill=(0, 0, 0, 255),
    )

    if MARK_PATH.exists():
        mark = Image.open(MARK_PATH).convert("RGBA")
        mark = _flatten_mark_black(mark)
        mark = mark.resize((diameter, diameter), Image.Resampling.LANCZOS)
        overlay.paste(mark, (int(cx - radius), int(cy - radius)), mark)

    return Image.alpha_composite(out, overlay).convert("RGB")


def _flatten_mark_black(mark: Image.Image) -> Image.Image:
    """Logo artwork uses near-black; match the QR canvas so the disc doesn't halo."""
    pixels = mark.load()
    width, height = mark.size
    for y in range(height):
        for x in range(width):
            red, green, blue, alpha = pixels[x, y]
            if alpha == 0:
                continue
            if red < 48 and green < 48 and blue < 48:
                pixels[x, y] = (0, 0, 0, 255)
    return mark
