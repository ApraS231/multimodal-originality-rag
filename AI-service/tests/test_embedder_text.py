import pytest
from app.core.embedder_text import TextChunker, TextEmbedder, get_text_embedder

def test_chunk_page_words():
    # Buat 300 kata buatan dengan koordinat geometri berurutan
    words = []
    for i in range(300):
        # Koordinat bertambah berurutan untuk mempermudah verifikasi min-max
        words.append({
            "text": f"word{i}",
            "x1": float(i * 10),
            "y1": float(i * 10),
            "x2": float(i * 10 + 8),
            "y2": float(i * 10 + 8)
        })
        
    # Jalankan chunking (chunk_size=250, overlap=50)
    chunks = TextChunker.chunk_page_words(words, page_number=1, chunk_size=250, overlap=50)
    
    # Verifikasi jumlah chunk
    # Total 300 kata. Chunk 1: index 0-250 (250 kata).
    # Step = 250 - 50 = 200. Chunk 2: index 200-300 (100 kata).
    assert len(chunks) == 2
    
    # Uji Chunk 1
    c1 = chunks[0]
    assert len(c1["text"].split()) == 250
    assert c1["text"].startswith("word0 ")
    assert c1["text"].endswith(" word249")
    assert c1["metadata"]["page_number"] == 1
    assert c1["metadata"]["bounding_box"]["x1"] == 0.0
    assert c1["metadata"]["bounding_box"]["y1"] == 0.0
    assert c1["metadata"]["bounding_box"]["x2"] == float(249 * 10 + 8)
    assert c1["metadata"]["bounding_box"]["y2"] == float(249 * 10 + 8)
    
    # Uji Chunk 2 (dengan overlap dari word200)
    c2 = chunks[1]
    assert len(c2["text"].split()) == 100
    assert c2["text"].startswith("word200 ")
    assert c2["text"].endswith(" word299")
    assert c2["metadata"]["bounding_box"]["x1"] == float(200 * 10)
    assert c2["metadata"]["bounding_box"]["y1"] == float(200 * 10)
    assert c2["metadata"]["bounding_box"]["x2"] == float(299 * 10 + 8)
    assert c2["metadata"]["bounding_box"]["y2"] == float(299 * 10 + 8)

def test_text_embedder():
    embedder = get_text_embedder()
    assert embedder is not None
    
    passages = [
        "Sistem deteksi orisinalitas laporan praktikum STITEK Bontang.",
        "Menggunakan teknologi NLP dan representasi vektor semantik."
    ]
    
    # Uji encode passages (menyisipkan prefix 'passage: ')
    embeddings = embedder.encode_passages(passages)
    assert len(embeddings) == 2
    assert len(embeddings[0]) == 768 # Dimensi vektor E5 Base adalah 768
    
    # Uji encode queries (menyisipkan prefix 'query: ')
    queries = ["bagaimana cara mendeteksi plagiarisme?"]
    query_embeddings = embedder.encode_queries(queries)
    assert len(query_embeddings) == 1
    assert len(query_embeddings[0]) == 768
