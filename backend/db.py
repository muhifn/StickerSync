"""Database layer — asyncpg pool to Supabase (Supavisor transaction mode)."""
import os
import uuid
from typing import Any, Optional

import asyncpg

_pool: Optional[asyncpg.Pool] = None


def _conn_kwargs() -> dict[str, Any]:
    return dict(
        host=os.environ.get("SUPABASE_DB_HOST", ""),
        port=int(os.environ.get("SUPABASE_DB_PORT", "6543")),
        user=os.environ.get("SUPABASE_DB_USER", ""),
        password=os.environ.get("SUPABASE_DB_PASSWORD", ""),
        database=os.environ.get("SUPABASE_DB_NAME", "postgres"),
        ssl="require",
        # REQUIRED: Supavisor transaction mode does not support prepared stmts
        statement_cache_size=0,
        max_size=5,          # small pool: free tier connection limits
        min_size=1,
        command_timeout=15,
    )


async def init_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(**_conn_kwargs())
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


async def fetch_one(query: str, *args: Any) -> Optional[asyncpg.Record]:
    pool = await init_pool()
    async with pool.acquire() as conn:
        return await conn.fetchrow(query, *args)


async def fetch_all(query: str, *args: Any) -> list[asyncpg.Record]:
    pool = await init_pool()
    async with pool.acquire() as conn:
        return await conn.fetch(query, *args)


async def execute(query: str, *args: Any) -> str:
    pool = await init_pool()
    async with pool.acquire() as conn:
        return await conn.execute(query, *args)


async def fetch_val(query: str, *args: Any) -> Any:
    pool = await init_pool()
    async with pool.acquire() as conn:
        return await conn.fetchval(query, *args)
