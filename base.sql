-- esquema de base de datos subido en supabase 

CREATE TABLE surveys (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    creator_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    status TEXT CHECK (status IN ('active', 'closed', 'draft')) NOT NULL DEFAULT 'draft',
    unique_code TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    closed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE questions (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    survey_id BIGINT REFERENCES surveys(id) ON DELETE CASCADE,
    question_type TEXT CHECK (question_type IN ('open', 'multiple_choice', 'yes_no')) NOT NULL,
    content TEXT NOT NULL,
    options JSONB, -- Ejemplo: ["Rojo", "Azul", "Verde"]. Es NULL para 'open' y 'yes_no'
    position INT DEFAULT 0 -- Para mantener el orden de las preguntas
);

CREATE TABLE responses (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    survey_id BIGINT REFERENCES surveys(id) ON DELETE CASCADE,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE answers (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    response_id BIGINT REFERENCES responses(id) ON DELETE CASCADE,
    question_id BIGINT REFERENCES questions(id) ON DELETE CASCADE,
    answer_text TEXT NOT NULL, -- Aquí guardas la opción elegida o el texto libre
    is_voice BOOLEAN NOT NULL DEFAULT FALSE, -- US-17: marca "por voz" para las respuestas dictadas
    language TEXT -- US-18: idioma detectado por Whisper (ISO 639-1), NULL si fue escrita
);

-- Migracion para bases existentes (idempotente):
-- US-17:
-- ALTER TABLE answers ADD COLUMN IF NOT EXISTS is_voice BOOLEAN NOT NULL DEFAULT FALSE;
-- US-18:
-- ALTER TABLE answers ADD COLUMN IF NOT EXISTS language TEXT;