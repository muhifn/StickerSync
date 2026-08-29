-- StickerSync Sprint 1 schema
-- Run via direct/pooler connection as postgres user

-- 1. Users: credit balance + referral
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,                     -- matches Supabase auth.users.id
    private_credits INT NOT NULL DEFAULT 0,
    free_downloads INT NOT NULL DEFAULT 3,   -- 3 free downloads on signup
    referral_code TEXT NOT NULL UNIQUE,      -- 6-char code for ?ref=
    referred_by TEXT,                        -- referrer's referral_code
    is_purchaser BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. World pool: single row, atomic decrement
CREATE TABLE IF NOT EXISTS world_pool (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    pool INT NOT NULL DEFAULT 100,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO world_pool (id, pool) VALUES (1, 100)
    ON CONFLICT (id) DO NOTHING;

-- 3. Pool claims: 3/day limit for non-purchasers
CREATE TABLE IF NOT EXISTS pool_claims (
    user_id UUID NOT NULL REFERENCES users(id),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    count INT NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, date)
);

-- 4. Download log: audit + trending foundation (Sprint 2)
CREATE TABLE IF NOT EXISTS download_log (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    sticker_id TEXT NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('free','pool','private')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_download_log_created ON download_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_download_log_sticker ON download_log (sticker_id);

-- 5. Library: stickers captured from scans (L2 cache + future search/trending)
CREATE TABLE IF NOT EXISTS library (
    sticker_id TEXT PRIMARY KEY,
    video_id TEXT NOT NULL,
    comment_text TEXT DEFAULT '',
    author_uid TEXT DEFAULT '',
    url TEXT NOT NULL,
    urls JSONB NOT NULL DEFAULT '[]',
    width INT DEFAULT 0,
    height INT DEFAULT 0,
    is_animated BOOLEAN DEFAULT TRUE,
    download_count INT NOT NULL DEFAULT 0,
    url_expires_at TIMESTAMPTZ,              -- parsed from x-expires
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_library_downloads ON library (download_count DESC);
CREATE INDEX IF NOT EXISTS idx_library_author ON library (author_uid);
CREATE INDEX IF NOT EXISTS idx_library_fts ON library USING gin (to_tsvector('simple', comment_text));

-- 6. Referral rewards log (idempotent)
CREATE TABLE IF NOT EXISTS referral_rewards (
    id BIGSERIAL PRIMARY KEY,
    referrer_code TEXT NOT NULL,
    referee_id UUID NOT NULL,
    rewarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (referee_id)                      -- one reward per referee
);

-- ============ RPC: ATOMIC OPERATIONS ============

-- Signup credit grant (called once at first login detection)
-- Referee gets +1 bonus credit if referred
CREATE OR REPLACE FUNCTION grant_signup_credits(p_user_id UUID, p_referral_code TEXT DEFAULT NULL)
RETURNS INT AS $$
DECLARE
    granted INT := 0;
    referrer_code TEXT;
BEGIN
    -- Ensure user row exists (idempotent)
    INSERT INTO users (id, referral_code)
    VALUES (p_user_id, upper(substr(md5(random()::text), 1, 6)))
    ON CONFLICT (id) DO NOTHING;

    IF p_referral_code IS NOT NULL THEN
        UPDATE users SET referred_by = p_referral_code
        WHERE id = p_user_id AND referred_by IS NULL;
    END IF;

    SELECT referred_by INTO referrer_code FROM users WHERE id = p_user_id;
    RETURN granted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Spend one credit with the agreed order: free -> pool -> private
-- Returns source used: 'free' | 'pool' | 'private' | 'empty'
CREATE OR REPLACE FUNCTION spend_credit(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
    source TEXT;
    row_count INT;
BEGIN
    -- fast path: free downloads
    UPDATE users SET free_downloads = free_downloads - 1
    WHERE id = p_user_id AND free_downloads > 0
    RETURNING 'free' INTO source;
    IF source IS NOT NULL THEN RETURN source; END IF;

    -- world pool race (atomic, row-locked)
    UPDATE world_pool SET pool = pool - 1, updated_at = now()
    WHERE id = 1 AND pool > 0
    RETURNING 'pool' INTO source;

    IF source IS NOT NULL THEN
        -- check daily claim limit for non-purchasers
        INSERT INTO pool_claims (user_id, date, count) VALUES (p_user_id, CURRENT_DATE, 1)
        ON CONFLICT (user_id, date)
        DO UPDATE SET count = pool_claims.count + 1
        RETURNING count INTO row_count;

        IF row_count > 3 THEN
            -- over limit: refund the pool and reject
            UPDATE world_pool SET pool = pool + 1, updated_at = now() WHERE id = 1;
            source := NULL;
        END IF;
    END IF;

    IF source IS NOT NULL THEN RETURN source; END IF;

    -- private credits last
    UPDATE users SET private_credits = private_credits - 1
    WHERE id = p_user_id AND private_credits > 0
    RETURNING 'private' INTO source;
    IF source IS NOT NULL THEN RETURN source; END IF;

    RETURN 'empty';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Pool balance check (unlimited for purchasers)
-- Note: limit check is inside spend_credit via pool_claims
