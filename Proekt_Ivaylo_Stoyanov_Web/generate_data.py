"""Създава възпроизводими синтетични растери без дубликати между дяловете."""
import csv
import math
import random

from PIL import Image, ImageDraw

from main import CLASSES, DATA, LABELS, SIZE, features

STROKES = {item['id']: item['paths'] for item in CLASSES}
rng = random.Random(42)


def sample(label, test):
    turn = rng.uniform(-.32, .32) if test else rng.uniform(-.17, .17)
    sin, cos = math.sin(turn), math.cos(turn)
    width = rng.uniform(3.0, 6.2)
    height = width * rng.uniform(.85, 1.15)
    cx, cy = rng.uniform(6.5, 8.5), rng.uniform(6.5, 8.5)
    jitter = .72 if test else .42
    image = Image.new('1', (SIZE, SIZE))
    draw = ImageDraw.Draw(image)
    thickness = rng.choice([1, 1, 1, 2])
    for path in STROKES[label]:
        # Повторените върхове остават свързани при затворени контури.
        corners = {}
        points = []
        for point in path:
            key = tuple(point)
            if key not in corners:
                x, y = point[0] * width, point[1] * height
                corners[key] = (
                    round(cx + cos * x - sin * y + rng.uniform(-jitter, jitter)),
                    round(cy + sin * x + cos * y + rng.uniform(-jitter, jitter)),
                )
            points.append(corners[key])
        if len(points) == 1:
            draw.point(points[0], fill=1)
        else:
            draw.line(points, fill=1, width=thickness)
    return ''.join(map(str, image.get_flattened_data()))


def main():
    seen = set()
    train_vectors = set()
    with DATA.open('w', newline='', encoding='utf-8') as destination:
        output = csv.writer(destination, lineterminator="\n")
        output.writerow(['split', 'label', 'pixels'])
        for split, count in [('train', 180), ('test', 50)]:
            for label in LABELS:
                added = 0
                while added < count:
                    pixels = sample(label, split == 'test')
                    if pixels in seen:
                        continue
                    vector = tuple(features([int(bit) for bit in pixels]))
                    if split == "test" and vector in train_vectors:
                        continue
                    if split == "train":
                        train_vectors.add(vector)
                    seen.add(pixels)
                    output.writerow([split, label, pixels])
                    added += 1


if __name__ == '__main__':
    main()
