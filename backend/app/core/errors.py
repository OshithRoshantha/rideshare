from fastapi import HTTPException, status


class ApiError(HTTPException):
    """Carries {"detail": ..., "code": ...} as a flat dict in .detail — see the
    exception handler in main.py, which returns this dict as the response body
    as-is instead of nesting it under another "detail" key."""

    def __init__(self, status_code: int, code: str, detail: str):
        super().__init__(status_code=status_code, detail={"detail": detail, "code": code})


def not_found(code: str = "NOT_FOUND", detail: str = "Resource not found") -> ApiError:
    return ApiError(status.HTTP_404_NOT_FOUND, code, detail)


def bad_request(code: str, detail: str) -> ApiError:
    return ApiError(status.HTTP_400_BAD_REQUEST, code, detail)


def forbidden(code: str = "FORBIDDEN", detail: str = "Not allowed") -> ApiError:
    return ApiError(status.HTTP_403_FORBIDDEN, code, detail)


def unauthorized(code: str = "UNAUTHORIZED", detail: str = "Invalid credentials") -> ApiError:
    return ApiError(status.HTTP_401_UNAUTHORIZED, code, detail)


def conflict(code: str, detail: str) -> ApiError:
    return ApiError(status.HTTP_409_CONFLICT, code, detail)
