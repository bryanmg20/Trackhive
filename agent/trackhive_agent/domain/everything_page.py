"""One page of the folders-only search, as Everything answered it (HU-166)."""

from __future__ import annotations

from dataclasses import dataclass

from .errors import EverythingError


@dataclass(frozen=True)
class EverythingPage:
    """The body goes to Trackhive byte for byte, CRLF and tabs included: the
    mapping of HU-135 lives in the backend. The agent only reads how many
    results the search has and how many came, to know where the next page
    starts."""

    body: bytes
    # totalResults of Everything: every result of the search, not of the page
    total_results: int
    # Results that came in this page
    results: int

    def __post_init__(self) -> None:
        if self.total_results < 0 or self.results < 0:
            raise EverythingError('Everything devolvió un número de resultados negativo')

    def next_offset(self, offset: int) -> int | None:
        """Offset of the next page of the same root, or None when the root is
        done: an empty page, or every result already received."""
        following = offset + self.results
        if self.results == 0 or following >= self.total_results:
            return None
        return following
