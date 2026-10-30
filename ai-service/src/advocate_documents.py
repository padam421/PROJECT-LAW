"""Bounded text extraction for advocate case papers; never treats metadata as evidence."""
import io
import zipfile
from pathlib import Path
from xml.etree import ElementTree

MAX_BYTES = 10 * 1024 * 1024
MAX_TEXT = 100000


def extract(name, data):
    if not data or len(data) > MAX_BYTES:
        raise ValueError('Each document must be nonempty and at most 10 MB.')
    suffix = Path(name).suffix.lower()
    warnings = []
    if suffix in ('.txt', '.csv'):
        try:
            text = data.decode('utf-8-sig')
        except UnicodeDecodeError:
            raise ValueError('Save this text file as UTF-8 and attach it again.')
    elif suffix == '.pdf':
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(data))
        if reader.is_encrypted:
            raise ValueError('Attach an unlocked copy of this PDF.')
        if len(reader.pages) > 150:
            raise ValueError('Split this PDF into files of at most 150 pages.')
        pages = []
        for index, page in enumerate(reader.pages):
            content = page.extract_text() or ''
            if len(content.strip()) < 20:
                warnings.append('Page %s has little or no readable text; provide its OCR text.' % (index + 1))
            pages.append('[Page %s]\n%s' % (index + 1, content))
        text = '\n\n'.join(pages)
        if not any(len(p.split(']', 1)[-1].strip()) >= 20 for p in pages):
            raise ValueError('This PDF appears scanned. OCR it or paste its text; no image text was read.')
    elif suffix == '.docx':
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            entry = archive.getinfo('word/document.xml')
            if entry.file_size > 8 * 1024 * 1024:
                raise ValueError('The Word document expands beyond the supported limit.')
            root = ElementTree.fromstring(archive.read(entry))
            ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
            text = '\n'.join(''.join(p.itertext()) for p in root.findall('.//w:p', ns))
    else:
        raise ValueError('Use PDF, DOCX, TXT or CSV. For images or old DOC files, provide OCR/text or convert to DOCX.')
    if not text.strip():
        raise ValueError('No readable text was found in this file.')
    if len(text) > MAX_TEXT:
        raise ValueError('This document exceeds 100,000 characters. Split it into smaller files; nothing was silently truncated.')
    return {'name': Path(name.replace('\\', '/')).name[:160], 'text': text,
            'characters': len(text), 'warnings': warnings}
