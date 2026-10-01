import os
import math
from PIL import Image, ImageDraw, ImageFont

public_dir = os.path.join(os.path.dirname(__file__), '..', 'public')
os.makedirs(public_dir, exist_ok=True)

# Font helper
def get_font(name, size):
    try:
        font_path = os.path.join(r'C:\Windows\Fonts', name)
        if os.path.exists(font_path):
            return ImageFont.truetype(font_path, size)
    except:
        pass
    return ImageFont.load_default()

# -------------------------------------------------------------
# 1. DRAW WATER METER EMBLEM
# -------------------------------------------------------------
def draw_meter_icon(draw, cx, cy, radius):
    r = radius
    # Outer dark ring
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(15, 118, 110), outline=(20, 184, 166), width=max(3, int(r * 0.05)))
    
    # Inner metallic bezel
    r_in = r * 0.92
    draw.ellipse([cx - r_in, cy - r_in, cx + r_in, cy + r_in], fill=(4, 47, 46), outline=(94, 234, 212), width=max(2, int(r * 0.03)))
    
    # Meter Dial Face
    r_face = r * 0.78
    draw.ellipse([cx - r_face, cy - r_face, cx + r_face, cy + r_face], fill=(2, 44, 34))

    # Dial Tick Marks
    for i in range(12):
        angle = i * (2 * math.pi / 12)
        x1 = cx + (r_face * 0.82) * math.cos(angle)
        y1 = cy + (r_face * 0.82) * math.sin(angle)
        x2 = cx + (r_face * 0.94) * math.cos(angle)
        y2 = cy + (r_face * 0.94) * math.sin(angle)
        draw.line([x1, y1, x2, y2], fill=(94, 234, 212), width=max(2, int(r * 0.025)))

    # Droplet Shape inside
    drop_w = r * 0.35
    drop_h = r * 0.5
    drop_top = cy - r * 0.4
    drop_pts = [
        (cx, drop_top),
        (cx - drop_w * 0.7, cy - r * 0.1),
        (cx - drop_w, cy + r * 0.15),
        (cx, cy + drop_h * 0.8),
        (cx + drop_w, cy + r * 0.15),
        (cx + drop_w * 0.7, cy - r * 0.1)
    ]
    draw.polygon(drop_pts, fill=(13, 148, 136))
    draw.ellipse([cx - drop_w, cy - r * 0.1, cx + drop_w, cy + drop_h * 0.75], fill=(20, 184, 166))

    # Numeric Counter Window (like water meter digits)
    box_w = r * 0.85
    box_h = r * 0.28
    box_x = cx - box_w / 2
    box_y = cy + r * 0.22
    draw.rounded_rectangle([box_x, box_y, box_x + box_w, box_y + box_h], radius=int(r * 0.05), fill=(10, 15, 29), outline=(204, 251, 241), width=max(2, int(r * 0.02)))

    # Digits "0 0 1 8 2"
    digit_font = get_font('consolab.ttf', int(box_h * 0.7)) or get_font('arialbd.ttf', int(box_h * 0.65))
    text_digits = "00182"
    text_bbox = draw.textbbox((0, 0), text_digits, font=digit_font)
    tw = text_bbox[2] - text_bbox[0]
    th = text_bbox[3] - text_bbox[1]
    draw.text((cx - tw / 2, box_y + (box_h - th) / 2 - 2), text_digits, fill=(255, 255, 255), font=digit_font)

    # Meter Needle
    needle_angle = -math.pi / 4  # pointing up-right
    nx = cx + (r_face * 0.6) * math.cos(needle_angle)
    ny = cy + (r_face * 0.6) * math.sin(needle_angle)
    draw.line([cx, cy, nx, ny], fill=(245, 158, 11), width=max(3, int(r * 0.04)))
    # Center Pin
    pin_r = r * 0.08
    draw.ellipse([cx - pin_r, cy - pin_r, cx + pin_r, cy + pin_r], fill=(255, 255, 255), outline=(245, 158, 11), width=2)

# -------------------------------------------------------------
# 2. GENERATE SQUARE SHARE CARD (600 x 600 px) - for WhatsApp link preview
# -------------------------------------------------------------
def make_square_og():
    size = 600
    img = Image.new('RGB', (size, size), color=(15, 23, 42))
    d = ImageDraw.Draw(img)

    # Gradient background
    for y in range(size):
        ratio = y / size
        r = int(15 * (1 - ratio) + 4 * ratio)
        g = int(50 * (1 - ratio) + 30 * ratio)
        b = int(60 * (1 - ratio) + 40 * ratio)
        d.line([(0, y), (size, y)], fill=(r, g, b))

    # Accent glow circle behind meter
    for rad in range(240, 200, -10):
        alpha = int((rad - 200) * 1.5)
        d.ellipse([300 - rad, 270 - rad, 300 + rad, 270 + rad], outline=(15, 118, 110))

    # Draw Emblem in center
    draw_meter_icon(d, 300, 270, 150)

    # Top brand tag
    tag_font = get_font('segoeuib.ttf', 24) or get_font('arialbd.ttf', 24)
    tag_text = "W I M A L A   L A N D"
    bbox_tag = d.textbbox((0, 0), tag_text, font=tag_font)
    d.text((300 - (bbox_tag[2] - bbox_tag[0]) / 2, 45), tag_text, fill=(94, 234, 212), font=tag_font)

    # Bottom Title
    title_font = get_font('segoeuib.ttf', 34) or get_font('arialbd.ttf', 34)
    title_text = "REKAP METERAN AIR"
    bbox_title = d.textbbox((0, 0), title_text, font=title_font)
    d.text((300 - (bbox_title[2] - bbox_title[0]) / 2, 465), title_text, fill=(255, 255, 255), font=title_font)

    # Bottom Subtitle Pill
    pill_w = 340
    pill_h = 42
    pill_x = 300 - pill_w / 2
    pill_y = 515
    d.rounded_rectangle([pill_x, pill_y, pill_x + pill_w, pill_y + pill_h], radius=21, fill=(13, 148, 136))
    sub_font = get_font('segoeuib.ttf', 18) or get_font('arialbd.ttf', 18)
    sub_text = "Scan QR • Gemini OCR • Validasi"
    bbox_sub = d.textbbox((0, 0), sub_text, font=sub_font)
    d.text((300 - (bbox_sub[2] - bbox_sub[0]) / 2, pill_y + 11), sub_text, fill=(255, 255, 255), font=sub_font)

    img.save(os.path.join(public_dir, 'og-image-square.png'), 'PNG')
    print("[OK] og-image-square.png created (600x600)")

# -------------------------------------------------------------
# 3. GENERATE LANDSCAPE SHARE CARD (1200 x 630 px) - Open Graph standard
# -------------------------------------------------------------
def make_landscape_og():
    w, h = 1200, 630
    img = Image.new('RGB', (w, h), color=(15, 23, 42))
    d = ImageDraw.Draw(img)

    # Gradient background
    for y in range(h):
        ratio = y / h
        r = int(10 * (1 - ratio) + 3 * ratio)
        g = int(45 * (1 - ratio) + 20 * ratio)
        b = int(55 * (1 - ratio) + 35 * ratio)
        d.line([(0, y), (w, y)], fill=(r, g, b))

    # Left Meter Emblem
    draw_meter_icon(d, 260, 315, 170)

    # Right Content
    rx = 500

    # Brand badge
    d.rounded_rectangle([rx, 110, rx + 240, 148], radius=8, fill=(15, 118, 110))
    badge_font = get_font('segoeuib.ttf', 18) or get_font('arialbd.ttf', 18)
    d.text((rx + 20, 120), "KAWASAN WIMALA LAND", fill=(204, 251, 241), font=badge_font)

    # Big Title
    title_font = get_font('segoeuib.ttf', 52) or get_font('arialbd.ttf', 52)
    d.text((rx, 170), "Rekap Meteran Air PDAM", fill=(255, 255, 255), font=title_font)

    # Subtitle
    desc_font = get_font('segoeui.ttf', 24) or get_font('arial.ttf', 24)
    d.text((rx, 248), "Sistem Pencatatan, Pemindaian OCR & Tagihan", fill=(148, 163, 184), font=desc_font)
    d.text((rx, 282), "Khusus Petugas Lapangan & Panel Administrator", fill=(148, 163, 184), font=desc_font)

    # Feature Pills
    pills = [
        ("SCAN QR KAVLING", 180),
        ("GEMINI VISION OCR", 205),
        ("EKSPOR EXCEL A4", 185)
    ]
    px = rx
    pill_font = get_font('segoeuib.ttf', 16) or get_font('arialbd.ttf', 16)
    for text, pw in pills:
        d.rounded_rectangle([px, 360, px + pw, 405], radius=8, fill=(2, 44, 34), outline=(45, 212, 191), width=2)
        d.text((px + 18, 372), text, fill=(94, 234, 212), font=pill_font)
        px += pw + 18

    # Bottom Link
    url_font = get_font('consolab.ttf', 20) or get_font('arialbd.ttf', 20)
    d.text((rx, 460), "https://scan-meteran-wimala.vercel.app", fill=(45, 212, 191), font=url_font)

    img.save(os.path.join(public_dir, 'og-image.png'), 'PNG')
    print("[OK] og-image.png created (1200x630)")

make_square_og()
make_landscape_og()
