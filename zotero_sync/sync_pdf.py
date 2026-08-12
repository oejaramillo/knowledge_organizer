from db import get_db_connection
from urllib.parse import unquote, urlparse

def sync_pdf_paths(client):
    print("Syncing PDF paths...")
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT paper_id, zotero_key FROM papers")
            papers = cur.fetchall()

            for paper in papers:
                children = client.get_children(paper['zotero_key'])
                for child in children:
                    data = child['data']
                    if data.get('itemType') == 'attachment' and data.get('contentType') == 'application/pdf':
                        pdf_path = data.get('path')
                        if pdf_path:
                            # Strip file:// scheme and decode %20 problem with spaces and others.
                            if pdf_path.startswith('file://'):
                                pdf_path = urlparse(pdf_path).path
                            pdf_path = unquote(pdf_path)

                            cur.execute("""
                                UPDATE papers SET pdf_path = %s 
                                WHERE paper_id = %s
                            """, (pdf_path, paper['paper_id']))
            conn.commit()
    print("PDF paths updated.")