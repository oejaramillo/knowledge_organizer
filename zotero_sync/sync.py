from zotero_client import ZoteroClient


def main():

    client = ZoteroClient()

    info = client.get_library_info()

    print("=" * 60)
    print("Connected to Zotero")
    print("=" * 60)
    print(info)

    collections = client.get_collections()

    print(f"\nCollections: {len(collections)}")

    papers = client.get_top_level_items()

    print(f"Papers: {len(papers)}")

    if papers:

        paper = papers[0]["data"]

        print("\nFirst paper")

        print("----------------")

        print("Title:", paper.get("title"))

        print("Item type:", paper.get("itemType"))

        print("Date:", paper.get("date"))

        print("DOI:", paper.get("DOI"))

        print("Creators:")

        for creator in paper.get("creators", []):

            first = creator.get("firstName", "")
            last = creator.get("lastName", "")

            print(f"  • {first} {last}")


if __name__ == "__main__":
    main()