import json
import re

from db import get_db_connection


def parse_page_number(page_label):
    if page_label is None:
        return None
    if isinstance(page_label, int):
        return page_label

    match = re.search(r"\d+", str(page_label))
    return int(match.group(0)) if match else None


def parse_annotation_position(raw_position):
    if not raw_position:
        return None

    if isinstance(raw_position, dict):
        return json.dumps(raw_position)

    if isinstance(raw_position, str):
        try:
            parsed = json.loads(raw_position)
            return json.dumps(parsed)
        except (json.JSONDecodeError, ValueError):
            return None

    return None


def normalize_annotation(data):
    raw_type = data.get("annotationType")

    if raw_type == "text":
        return {
            "annotation_type": "note",
            "highlight_text": None,
            "user_note": data.get("annotationText") or data.get("annotationComment"),
        }

    if raw_type == "highlight":
        return {
            "annotation_type": "highlight",
            "highlight_text": data.get("annotationText"),
            "user_note": data.get("annotationComment"),
        }

    if raw_type in {"note", "image", "ink"}:
        return {
            "annotation_type": raw_type,
            "highlight_text": data.get("annotationText"),
            "user_note": data.get("annotationComment"),
        }

    return {
        "annotation_type": "note",
        "highlight_text": data.get("annotationText"),
        "user_note": data.get("annotationComment"),
    }


def sync_annotations(client, since=None, since_date=None):
    label = (
        f"(incremental since v{since})" if since is not None
        else f"(incremental since {since_date})" if since_date is not None
        else "(full sync)"
    )
    print(f"Syncing annotations... {label}")

    annotations = client.get_annotations(since=since, since_date=since_date)

    if not annotations:
        print("No annotation changes detected.")
        return

    synced_annotations = 0
    skipped_annotations = 0

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            for item in annotations:
                data = item.get("data", {})

                if data.get("itemType") != "annotation":
                    continue

                zotero_annotation_key = data.get("key")
                parent_attachment_key = data.get("parentItem")

                if not zotero_annotation_key or not parent_attachment_key:
                    skipped_annotations += 1
                    continue

                cur.execute(
                    """
                    SELECT attachment_id, paper_id
                    FROM attachments
                    WHERE zotero_attachment_key = %s
                    """,
                    (parent_attachment_key,),
                )
                attachment_row = cur.fetchone()

                if not attachment_row:
                    skipped_annotations += 1
                    continue

                normalized = normalize_annotation(data)

                cur.execute(
                    """
                    INSERT INTO annotations (
                        paper_id,
                        attachment_id,
                        page_number,
                        highlight_text,
                        user_note,
                        color,
                        annotation_type,
                        annotation_position,
                        annotation_sort_index,
                        zotero_annotation_key
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s)
                    ON CONFLICT (zotero_annotation_key)
                    DO UPDATE SET
                        paper_id = EXCLUDED.paper_id,
                        attachment_id = EXCLUDED.attachment_id,
                        page_number = EXCLUDED.page_number,
                        highlight_text = EXCLUDED.highlight_text,
                        user_note = EXCLUDED.user_note,
                        color = EXCLUDED.color,
                        annotation_type = EXCLUDED.annotation_type,
                        annotation_position = EXCLUDED.annotation_position,
                        annotation_sort_index = EXCLUDED.annotation_sort_index,
                        synced_at = NOW()
                    """,
                    (
                        attachment_row["paper_id"],
                        attachment_row["attachment_id"],
                        parse_page_number(data.get("annotationPageLabel")),
                        normalized["highlight_text"],
                        normalized["user_note"],
                        data.get("annotationColor"),
                        normalized["annotation_type"],
                        parse_annotation_position(data.get("annotationPosition")),
                        data.get("annotationSortIndex"),
                        zotero_annotation_key,
                    ),
                )
                synced_annotations += 1

            conn.commit()

    print(f"Successfully synced {synced_annotations} annotations.")
    if skipped_annotations:
        print(f"Skipped {skipped_annotations} annotations (attachment not found in DB).")