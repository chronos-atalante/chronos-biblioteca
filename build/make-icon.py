#!/usr/bin/env python3
"""Gera o ícone do aplicativo (build/icon.png) usando apenas PIL."""

import os
from PIL import Image, ImageDraw

SIZE = 512
RADIUS = 110


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(len(a)))


def gradient(size, top, bottom):
    img = Image.new("RGBA", (size, size))
    px = img.load()
    for y in range(size):
        color = lerp(top, bottom, y / (size - 1))
        for x in range(size):
            px[x, y] = color
    return img


def rounded_mask(size, radius):
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    return mask


def main():
    out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "build")
    os.makedirs(out_dir, exist_ok=True)

    icon = gradient(SIZE, (77, 108, 240), (139, 92, 246))
    icon.putalpha(rounded_mask(SIZE, RADIUS))

    draw = ImageDraw.Draw(icon)

    # livro aberto
    left_page = [(58, 150), (248, 184), (248, 372), (58, 404)]
    right_page = [(264, 184), (454, 150), (454, 404), (264, 372)]
    draw.polygon(left_page, fill=(245, 247, 255, 255))
    draw.polygon(right_page, fill=(232, 236, 250, 255))

    # linhas das páginas
    line_color = (176, 186, 220, 255)
    for i in range(4):
        y = 215 + i * 42
        draw.line([(86, y), (222, y + 22)], fill=line_color, width=8)
        draw.line([(290, y + 22), (426, y)], fill=line_color, width=8)

    # barra de progresso
    track = (20, 24, 40, 255)
    fill = (78, 207, 139, 255)
    bx0, by0, bx1, by1 = 96, 434, 416, 466
    draw.rounded_rectangle((bx0, by0, bx1, by1), radius=16, fill=track)
    draw.rounded_rectangle((bx0, by0, bx0 + int((bx1 - bx0) * 0.68), by1), radius=16, fill=fill)

    # brilho sutil (respeitando o arredondamento)
    gloss = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    ImageDraw.Draw(gloss).ellipse((-120, -220, SIZE + 120, 200), fill=(255, 255, 255, 34))
    alpha = Image.composite(gloss.getchannel("A"), Image.new("L", (SIZE, SIZE), 0), rounded_mask(SIZE, RADIUS))
    gloss.putalpha(alpha)
    icon = Image.alpha_composite(icon, gloss)

    icon.save(os.path.join(out_dir, "icon.png"))
    print("ícone gerado em build/icon.png")


if __name__ == "__main__":
    main()
