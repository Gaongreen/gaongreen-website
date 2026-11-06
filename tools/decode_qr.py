# Decode a QR code PNG with OpenCV; prints the payload. Usage: python3 -I decode_qr.py image.png
# Exit codes: 0 decoded, 1 no QR found, 2 image unreadable, 3 OpenCV (cv2) not importable (NOTE: `python3 -I` ignores user site-packages, so a `pip install --user` cv2 is invisible).
import sys
try:
    import cv2
except Exception as e:
    sys.stderr.write('DECODER-UNAVAILABLE: cannot import cv2 (%s: %s)\n' % (type(e).__name__, e)); sys.exit(3)
img = cv2.imread(sys.argv[1])
if img is None:
    sys.stderr.write('DECODER-IMAGE-UNREADABLE: %s\n' % sys.argv[1]); sys.exit(2)
img = cv2.copyMakeBorder(img, 40, 40, 40, 40, cv2.BORDER_CONSTANT, value=(255,255,255))
for scale in (1, 2, 3):
    im = cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_NEAREST) if scale > 1 else img
    txt, pts, _ = cv2.QRCodeDetector().detectAndDecode(im)
    if txt: print(txt); sys.exit(0)
sys.stderr.write('DECODER-NO-QR-FOUND\n'); sys.exit(1)
