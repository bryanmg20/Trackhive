-- Legacy requesters remain NULL: do not invent demographic information.
ALTER TABLE "requesters"
  ADD COLUMN "municipality" VARCHAR(120),
  ADD COLUMN "age_range" VARCHAR(5),
  ADD COLUMN "population_group" VARCHAR(80),
  ADD CONSTRAINT "requesters_age_range_check"
    CHECK ("age_range" IS NULL OR "age_range" IN ('0-5', '6-11', '12-17', '18-28', '29-59', '60+')),
  ADD CONSTRAINT "requesters_municipality_check"
    CHECK ("municipality" IS NULL OR length(btrim("municipality")) > 0),
  ADD CONSTRAINT "requesters_population_group_check"
    CHECK ("population_group" IS NULL OR "population_group" IN (
      'COMUNIDADES_NEGRAS_PALENQUERAS', 'PUEBLOS_INDIGENAS', 'DISCAPACIDAD',
      'MIGRANTE', 'PUEBLOS_ROM', 'VICTIMAS_DEL_CONFLICTO', 'COMUNIDADES_RURALES',
      'MADRES_CABEZA_DE_FAMILIA', 'PADRES_CABEZA_DE_FAMILIA', 'LGBTIQ_PLUS',
      'PREFIERO_NO_RESPONDER'
    ));
