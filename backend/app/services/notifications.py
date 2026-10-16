from app.storage.repositories import get_repos


def notify(user_id: str, title: str, body: str, link: str | None = None) -> dict:
    repos = get_repos()
    return repos.notifications.insert(
        {"user_id": user_id, "title": title, "body": body, "read": False, "link": link}
    )
