"""Errors of the agent. The message is what the log and Trackhive show."""

from __future__ import annotations


class AgentError(Exception):
    """Base of every error the agent expects."""


class InvalidConfigError(AgentError):
    """The configuration is wrong or unsafe: the agent refuses to run."""


class EverythingError(AgentError):
    """Everything answered something the sync cannot use: 401, another HTTP
    status or not the JSON of a search."""


class EverythingUnavailableError(EverythingError):
    """Everything did not answer: it is not running, refused the connection
    or took longer than the timeout."""


class TrackhiveError(AgentError):
    """Trackhive answered with an error that trying again will not fix
    (4xx, sync disabled, a redirection, an invalid certificate)."""

    def __init__(self, message: str, status: int | None = None, code: str | None = None) -> None:
        super().__init__(message)
        # HTTP status and the stable `code` of the API error, when it answered
        self.status = status
        self.code = code


class TrackhiveUnavailableError(TrackhiveError):
    """Trackhive did not answer (network, timeout) or answered 5xx: the
    request is worth retrying."""
