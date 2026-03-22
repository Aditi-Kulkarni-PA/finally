"""LiteLLM wrapper: call LLM or return mock response based on LLM_MOCK env var."""

from __future__ import annotations

import json
import logging
import os

import litellm
from pydantic import BaseModel

logger = logging.getLogger(__name__)

MOCK_LLM_RESPONSE = {
    "message": "I've reviewed your portfolio. You have $10,000 in cash and no open positions. Consider buying some AAPL to get started.",
    "trades": [],
    "watchlist_changes": [],
}


class LLMResponse(BaseModel):
    message: str
    trades: list = []
    watchlist_changes: list = []


async def call_llm(messages: list[dict]) -> LLMResponse:
    """Call LLM or return mock response based on LLM_MOCK env var."""
    if os.getenv("LLM_MOCK", "false").lower() == "true":
        logger.debug("LLM_MOCK=true, returning mock response")
        return LLMResponse(**MOCK_LLM_RESPONSE)

    response = await litellm.acompletion(
        model="openrouter/openai/gpt-oss-120b",
        messages=messages,
        extra_body={"provider": {"order": ["cerebras"]}},
        response_format={"type": "json_object"},
        api_key=os.getenv("OPENROUTER_API_KEY"),
        api_base="https://openrouter.ai/api/v1",
    )

    content = response.choices[0].message.content
    try:
        data = json.loads(content)
        return LLMResponse(
            message=data.get("message", ""),
            trades=data.get("trades", []),
            watchlist_changes=data.get("watchlist_changes", []),
        )
    except (json.JSONDecodeError, Exception):
        logger.warning("LLM returned malformed JSON, using raw content as message")
        return LLMResponse(message=content or "", trades=[], watchlist_changes=[])
