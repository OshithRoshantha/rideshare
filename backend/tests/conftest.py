import os
import shutil
import sys
import tempfile

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ.setdefault("JWT_SECRET", "test-secret")


@pytest.fixture
def repos():
    from app.config import get_settings
    from app.storage.repositories import get_repos

    tmp_dir = tempfile.mkdtemp()
    get_settings.cache_clear()
    os.environ["DATA_DIR"] = tmp_dir
    get_settings.cache_clear()
    get_repos.cache_clear()
    r = get_repos()
    yield r
    get_repos.cache_clear()
    get_settings.cache_clear()
    shutil.rmtree(tmp_dir, ignore_errors=True)
    os.environ.pop("DATA_DIR", None)
