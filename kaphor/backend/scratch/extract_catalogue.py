import zipfile
import xml.etree.ElementTree as ET
import os

def extract_text(docx_path):
    document = zipfile.ZipFile(docx_path)
    xml_content = document.read('word/document.xml')
    document.close()
    
    tree = ET.fromstring(xml_content)
    
    # Namespaces
    ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
    
    text = []
    for paragraph in tree.findall('.//w:p', ns):
        p_text = []
        for run in paragraph.findall('.//w:r', ns):
            t = run.find('.//w:t', ns)
            if t is not None:
                p_text.append(t.text)
        text.append(''.join(p_text))
    
    return '\n'.join(text)

import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

catalogue_path_women = r'c:\Users\Insiyah\Kaphor\ethnic_wear_catalogue_women.docx'
catalogue_path_men = r'c:\Users\Insiyah\Kaphor\rental_catalogue_mens.docx'
catalogue_path_thrift = r'c:\Users\Insiyah\Kaphor\KAPHOR THRIFT DATA DETAILS.docx'

with open(r'c:\Users\Insiyah\Kaphor\kaphor\backend\scratch\catalogue_text.txt', 'w', encoding='utf-8') as f:
    if os.path.exists(catalogue_path_women):
        f.write("--- WOMEN ---\n")
        f.write(extract_text(catalogue_path_women))
    
    if os.path.exists(catalogue_path_men):
        f.write("\n\n--- MEN ---\n")
        f.write(extract_text(catalogue_path_men))
    
    if os.path.exists(catalogue_path_thrift):
        f.write("\n\n--- THRIFT ---\n")
        f.write(extract_text(catalogue_path_thrift))
