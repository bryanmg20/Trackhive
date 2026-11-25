"""JSON of the ingest endpoints of Trackhive <-> objects of the agent (R8 of D-25)."""

from __future__ import annotations

import json
from typing import Any

from ..application.dto import ClosedRun, RequestedRun, RunSummary
from ..domain.agent_run import CloseRequest
from ..domain.errors import TrackhiveError


class TrackhiveMapper:
    @staticmethod
    def to_requested_run(body: dict[str, Any]) -> RequestedRun | None:
        """RequestedSyncRunResponseDto: the run PEDIDA (HU-138), or None."""
        requested = body.get('requested')
        if not isinstance(requested, bool):
            raise TrackhiveError(
                'La respuesta de Trackhive no dice si hay una sincronización pedida: ¿trackhive.url es la dirección '
                'de Trackhive, en una versión con «Sincronizar ahora» (HU-138)?'
            )
        if not requested:
            return None
        requested_at = body.get('requestedAt')
        return RequestedRun(requested_at=requested_at if isinstance(requested_at, str) else 'sin fecha')

    @staticmethod
    def close_body(request: CloseRequest) -> bytes:
        """`{"result":"OK","pageCount":N}` or `{"result":"ERROR","errorMessage":"…"}` (CloseSyncRunDto)."""
        payload: dict[str, Any] = {'result': request.result}
        if request.page_count is not None:
            payload['pageCount'] = request.page_count
        if request.error_message is not None:
            payload['errorMessage'] = request.error_message
        return json.dumps(payload, ensure_ascii=False).encode('utf-8')

    @staticmethod
    def to_closed_run(body: dict[str, Any]) -> ClosedRun:
        """ClosedSyncRunResponseDto: the status, the error and what it did with the catalog."""
        error = body.get('errorMessage')
        return ClosedRun(
            status=str(body.get('status')),
            error_message=error if isinstance(error, str) else None,
            summary=TrackhiveMapper._summary(body.get('summary')),
        )

    @staticmethod
    def error_of(body: bytes) -> tuple[str | None, str | None]:
        """`code` and `message` of an error of the API (ErrorResponseDto), if the body is one."""
        try:
            document = json.loads(body)
        except (ValueError, UnicodeDecodeError):
            return None, None
        if not isinstance(document, dict):
            return None, None
        code, message = document.get('code'), document.get('message')
        return (code if isinstance(code, str) else None, message if isinstance(message, str) else None)

    @staticmethod
    def _summary(value: object) -> RunSummary | None:
        if not isinstance(value, dict):
            return None

        def count(key: str) -> int:
            number = value.get(key)
            return number if isinstance(number, int) and not isinstance(number, bool) else 0

        return RunSummary(
            leaves=count('leaves'),
            created=count('created'),
            updated=count('updated'),
            not_found=count('notFound'),
            for_review=count('forReview'),
        )
