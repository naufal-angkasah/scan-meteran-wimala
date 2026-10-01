import os
from PIL import Image, ImageDraw, ImageFont

public_dir = os.path.join(os.path.dirname(__file__), '..', 'public')
os.makedirs(public_dir, exist_ok=True)

# 1. Generate Favicon SVG (Tema Air & Wimala Teal)
svg_content = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <!-- Rounded Background -->
  <rect width="64" height="64" rx="14" fill="#0f766e"/>
  
  <!-- Water Droplet Silhouette -->
  <path d="M32 10C32 10 18 27.5 18 38C18 45.7 24.3 52 32 52C39.7 52 46 45.7 46 38C46 27.5 32 10 32 10Z" fill="#14b8a6"/>
  
  <!-- Meter Dial Gauge Inside Droplet -->
  <circle cx="32" cy="38" r="9" fill="#042f2e" stroke="#ccfbf1" stroke-width="1.8"/>
  <line x1="32" y1="38" x2="37" y2="33" stroke="#f59e0b" stroke-width="2" stroke-linecap="round"/>
  <circle cx="32" cy="38" r="2" fill="#ffffff"/>
  
  <!-- Counter Window Digits -->
  <rect x="26" y="27" width="12" height="4.5" rx="1" fill="#042f2e" stroke="#5eead4" stroke-width="0.8"/>
  <circle cx="28.5" cy="29.2" r="0.8" fill="#5eead4"/>
  <circle cx="32" cy="29.2" r="0.8" fill="#5eead4"/>
  <circle cx="35.5" cy="29.2" r="0.8" fill="#5eead4"/>
</svg>"""

with open(os.path.join(public_dir, 'favicon.svg'), 'w', encoding='utf-8') as f:
    f.write(svg_content)

print("[OK] favicon.svg created!")

# 2. Function to generate raster icons
def create_brand_icon(size):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    
    # Scale helper
    s = size / 64.0
    
    # Background rounded
    rad = int(14 * s)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=rad, fill=(15, 118, 110, 255))
    
    # Droplet
    # Approximate polygon/arc
    drop_pts = [
        (32 * s, 10 * s),
        (22 * s, 23 * s),
        (18 * s, 33 * s),
        (18 * s, 40 * s),
        (22 * s, 47 * s),
        (32 * s, 52 * s),
        (42 * s, 47 * s),
        (46 * s, 40 * s),
        (46 * s, 33 * s),
        (42 * s, 23 * s),
    ]
    d.polygon(drop_pts, fill=(20, 184, 166, 255))
    
    # Bottom circle of droplet
    d.ellipse([(20 * s, 28 * s), (44 * s, 51 * s)], fill=(20, 184, 166, 255))
    
    # Gauge dial
    d.ellipse([(23 * s, 29 * s), (41 * s, 47 * s)], fill=(4, 47, 46, 255), outline=(204, 251, 241, 255), width=max(1, int(2 * s)))
    
    # Needle
    d.line([(32 * s, 38 * s), (37 * s, 33 * s)], fill=(245, 158, 11, 255), width=max(1, int(2.2 * s)))
    d.ellipse([(30.5 * s, 36.5 * s), (33.5 * s, 39.5 * s)], fill=(255, 255, 255, 255))
    
    # Counter frame
    d.rounded_rectangle([(25.5 * s, 24 * s), (38.5 * s, 28.5 * s)], radius=max(1, int(1 * s)), fill=(4, 47, 46, 255), outline=(94, 234, 212, 255), width=max(1, int(1 * s)))
    
    return img

# Save various PNG sizes
sizes = {
    'favicon-16x16.png': 16,
    'favicon-32x32.png': 32,
    'favicon.png': 48,
    'apple-touch-icon.png': 180,
    'icon-192.png': 192,
    'icon-512.png': 512,
}

for filename, sz in sizes.items():
    icon_img = create_brand_icon(sz)
    icon_img.save(os.path.join(public_dir, filename), 'PNG')
    print(f"[OK] {filename} ({sz}x{sz}) created!")

# 3. Create Multi-size favicon.ico
ico_img = create_brand_icon(64)
ico_img.save(
    os.path.join(public_dir, 'favicon.ico'),
    format='ICO',
    sizes=[(16, 16), (32, 32), (48, 48), (64, 64)]
)
print("[OK] favicon.ico created!")

# 4. Create PWA Screenshots ('sc')
# Mobile Screenshot (width 430, height 932)
sc_mobile = Image.new('RGB', (430, 932), color=(15, 23, 42))
d_m = ImageDraw.Draw(sc_mobile)
# Header
d_m.rectangle([0, 0, 430, 60], fill=(2, 6, 23))
d_m.text((20, 20), "REKAP METERAN AIR PDAM", fill=(45, 212, 191))
# Target QR box
d_m.rounded_rectangle([35, 120, 395, 480], radius=16, fill=(2, 6, 23), outline=(13, 148, 136), width=3)
d_m.text((120, 280), "[ CAMERA QR SCANNER ]", fill=(94, 234, 212))
# Card Unit
d_m.rounded_rectangle([35, 520, 395, 720], radius=12, fill=(2, 6, 23), outline=(51, 65, 85), width=2)
d_m.text((55, 545), "BLOK D-05 - Hendra Gunawan", fill=(255, 255, 255))
d_m.text((55, 580), "Stand Bulan Lalu: 164 m3", fill=(148, 163, 184))
d_m.text((55, 615), "Stand Baru (OCR): 182 m3 (+18 m3)", fill=(45, 212, 191))
# Button
d_m.rounded_rectangle([35, 760, 395, 830], radius=10, fill=(13, 148, 136))
d_m.text((150, 785), "SIMPAN CATATAN", fill=(255, 255, 255))
sc_mobile.save(os.path.join(public_dir, 'screenshot-mobile.png'), 'PNG')
print("[OK] screenshot-mobile.png created!")

# Desktop Screenshot (width 1280, height 720)
sc_desktop = Image.new('RGB', (1280, 720), color=(241, 245, 249))
d_d = ImageDraw.Draw(sc_desktop)
# Header
d_d.rectangle([0, 0, 1280, 56], fill=(15, 23, 42))
d_d.text((32, 18), "PDAM WIMALA LAND - PANEL ADMINISTRATOR", fill=(255, 255, 255))
# Table Container
d_d.rounded_rectangle([32, 88, 1248, 670], radius=8, fill=(255, 255, 255), outline=(203, 213, 225), width=1)
d_d.rectangle([33, 89, 1247, 130], fill=(248, 250, 252))
d_d.text((56, 102), "NO   BLOK    NAMA PEMILIK           BULAN LALU   BULAN INI    PEMAKAIAN    TAGIHAN      STATUS", fill=(71, 85, 105))
# Sample rows
for row_i in range(8):
    y = 150 + row_i * 44
    d_d.text((56, y), f"{row_i+1}    D-0{row_i+1}   Warga Kavling {row_i+1}          140 m3       158 m3       +18 m3       Rp 54.000    VALID", fill=(15, 23, 42))
    d_d.line([(33, y+32), (1247, y+32)], fill=(241, 245, 249), width=1)
sc_desktop.save(os.path.join(public_dir, 'screenshot-desktop.png'), 'PNG')
print("[OK] screenshot-desktop.png created!")
