# Decode a QR code PNG with OpenCV; prints the payload (or nothing + exit 1). Usage: python3 -I decode_qr.py image.png
import sys, cv2
img = cv2.imread(sys.argv[1])
if img is None: sys.exit(2)
img = cv2.copyMakeBorder(img, 40, 40, 40, 40, cv2.BORDER_CONSTANT, value=(255,255,255))
for scale in (1, 2, 3):
    im = cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_NEAREST) if scale > 1 else img
    txt, pts, _ = cv2.QRCodeDetector().detectAndDecode(im)
    if txt: print(txt); sys.exit(0)
sys.exit(1)
