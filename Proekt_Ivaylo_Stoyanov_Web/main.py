"""Разпознаване на символи чрез k най-близки съседи."""
import argparse
import csv
import json
from pathlib import Path

from PIL import Image
from sklearn.metrics import accuracy_score, confusion_matrix
from sklearn.neighbors import KNeighborsClassifier

SIZE = 16
CLASSES = json.loads(Path(__file__).with_name('dist').joinpath('classes.json').read_text(encoding='utf-8'))
LABELS = [item['id'] for item in CLASSES]
DATA = Path(__file__).with_name('data.csv')


def features(pixels):
    """Изрязва празните полета и центрира знака без промяна на пропорциите."""
    image = Image.frombytes('L', (SIZE, SIZE), bytes(255 * p for p in pixels))
    box = image.getbbox()
    if box is None:
        return None
    symbol = image.crop(box)
    width, height = symbol.size
    scale = 12 / max(width, height)
    symbol = symbol.resize(
        (max(1, round(width * scale)), max(1, round(height * scale))),
        Image.Resampling.BILINEAR,
    )
    normalized = Image.new('L', (SIZE, SIZE))
    normalized.paste(symbol, ((SIZE - symbol.width) // 2, (SIZE - symbol.height) // 2))
    return [pixel / 255 for pixel in normalized.get_flattened_data()]


def load_data():
    sets = {'train': ([], []), 'test': ([], [])}
    with DATA.open(newline='', encoding='utf-8') as source:
        for row in csv.DictReader(source):
            vectors, labels = sets[row['split']]
            vectors.append(features([int(bit) for bit in row['pixels']]))
            labels.append(row['label'])
    return sets


def evaluate(model, test):
    vectors, labels = test
    predicted = model.predict(vectors)
    accuracy = accuracy_score(labels, predicted)
    correct = sum(actual == guess for actual, guess in zip(labels, predicted))
    print(f'Точност: {accuracy:.1%} ({correct}/{len(labels)})')
    print('Редове: действителен знак. Колони: предсказан знак.')
    print('     ' + ' '.join(f'{label:>3}' for label in LABELS))
    for label, row in zip(LABELS, confusion_matrix(labels, predicted, labels=LABELS)):
        print(f'{label:>3}  ' + ' '.join(f'{count:3}' for count in row))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--evaluate', action='store_true', help='оценка върху тестовите данни')
    parser.parse_args()
    sets = load_data()
    model = KNeighborsClassifier(n_neighbors=5, metric='euclidean', weights='uniform')
    model.fit(*sets['train'])
    evaluate(model, sets['test'])


if __name__ == '__main__':
    main()
