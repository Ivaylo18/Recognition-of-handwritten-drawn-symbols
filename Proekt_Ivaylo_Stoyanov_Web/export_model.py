"""Записва обучаващите еталони като етикет и 256 пиксела във всеки запис."""
from pathlib import Path

from main import LABELS, load_data

vectors, labels = load_data()['train']
records = bytearray()
for vector, label in zip(vectors, labels):
    records.append(LABELS.index(label))
    records.extend(round(pixel * 255) for pixel in vector)
Path(__file__).with_name('dist').joinpath('training.bin').write_bytes(records)
