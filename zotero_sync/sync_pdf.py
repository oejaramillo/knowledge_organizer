from db import get_db_connection

def sync_pdf_paths(client):
    print("Syncing PDF paths...")
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            # We fetch all papers that don't have a PDF path yet
            cur.execute("SELECT paper_id, zotero_key FROM papers")
            papers = cur.fetchall()

            for paper in papers:
                children = client.get_children(paper['zotero_key'])
                for child in children:
                    data = child['data']
                    # Look for the PDF attachment
                    if data.get('itemType') == 'attachment' and data.get('contentType') == 'application/pdf':
                        # The Local API provides the relative path or absolute path
                        # Using 'path' from Zotero metadata
                        pdf_path = data.get('path')
                        if pdf_path:
                            cur.execute("""
                                UPDATE papers SET pdf_path = %s 
                                WHERE paper_id = %s
                            """, (pdf_path, paper['paper_id']))
            conn.commit()
    print("PDF paths updated.")