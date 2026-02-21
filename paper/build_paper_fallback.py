from __future__ import annotations

import re
import sys
from pathlib import Path

PAGE_LINE_LIMIT = 52


def tex_to_lines(tex: str) -> list[str]:
    lines: list[str] = []
    for raw in tex.splitlines():
        line = raw.strip()
        if not line:
            continue

        line = line.replace("\\section{", "SECTION: ").replace("}", "")
        line = line.replace("\\paragraph{", "PARAGRAPH: ")

        line = re.sub(r"\\citep\{[^}]*\}", "[citation]", line)
        line = re.sub(r"\\textbf\{([^}]*)\}", r"\1", line)
        line = re.sub(r"\\item", "-", line)
        line = re.sub(r"\\[a-zA-Z]+", "", line)
        line = line.replace("{", "").replace("}", "")
        line = re.sub(r"\s+", " ", line).strip()
        if not line:
            continue

        while len(line) > 95:
            split_at = line.rfind(" ", 0, 95)
            if split_at <= 0:
                split_at = 95
            lines.append(line[:split_at])
            line = line[split_at:].strip()
        lines.append(line)
    return lines


def escape_pdf_text(s: str) -> str:
    return s.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def content_stream(lines: list[str]) -> bytes:
    body = ["BT", "/F1 10 Tf", "14 TL", "50 760 Td"]
    first = True
    for line in lines:
        if not first:
            body.append("T*")
        body.append(f"({escape_pdf_text(line)}) Tj")
        first = False
    body.append("ET")
    return ("\n".join(body) + "\n").encode("latin-1", errors="replace")


def build_pdf(lines: list[str], out_path: Path) -> None:
    pages = [lines[i : i + PAGE_LINE_LIMIT] for i in range(0, len(lines), PAGE_LINE_LIMIT)]
    if not pages:
        pages = [["WorldModel Gym paper source is empty."]]

    objects: list[bytes] = []
    n_pages = len(pages)

    # Object numbering:
    # 1 catalog, 2 pages tree, per page: page obj then content obj, final: font obj
    font_obj = 3 + 2 * n_pages

    objects.append(b"<< /Type /Catalog /Pages 2 0 R >>")

    kids = " ".join(f"{3 + 2 * i} 0 R" for i in range(n_pages))
    objects.append(f"<< /Type /Pages /Kids [{kids}] /Count {n_pages} >>".encode("ascii"))

    for i, page_lines in enumerate(pages):
        page_obj = 3 + 2 * i
        content_obj = page_obj + 1

        page_dict = (
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            f"/Contents {content_obj} 0 R /Resources << /Font << /F1 {font_obj} 0 R >> >> >>"
        )
        objects.append(page_dict.encode("ascii"))

        stream = content_stream(page_lines)
        stream_obj = (
            f"<< /Length {len(stream)} >>\nstream\n".encode("ascii") + stream + b"endstream"
        )
        objects.append(stream_obj)

    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>")

    out = bytearray()
    out.extend(b"%PDF-1.4\n")
    offsets = [0]

    for idx, obj in enumerate(objects, start=1):
        offsets.append(len(out))
        out.extend(f"{idx} 0 obj\n".encode("ascii"))
        out.extend(obj)
        out.extend(b"\nendobj\n")

    xref_offset = len(out)
    out.extend(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
    out.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        out.extend(f"{offset:010d} 00000 n \n".encode("ascii"))

    out.extend(
        (
            f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
            f"startxref\n{xref_offset}\n%%EOF\n"
        ).encode("ascii")
    )

    out_path.write_bytes(out)


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: build_paper_fallback.py <input.tex> <output.pdf>")
        return 1

    in_path = Path(sys.argv[1])
    out_path = Path(sys.argv[2])
    if not in_path.exists():
        print(f"Input file not found: {in_path}")
        return 1

    lines = tex_to_lines(in_path.read_text(encoding="utf-8"))
    build_pdf(lines, out_path)
    print(f"Built fallback PDF: {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
