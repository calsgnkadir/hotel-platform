-- FAZ 4.7 fix: applications/job_listings/shift_slots'a Hibernate'in eski @Version
-- denemesinde eklediği version sutununa DEFAULT 0 koy. Boylece Hibernate
-- INSERT'e version koymasa bile MySQL default 0 atar.
--
-- (@Version'i ileride entity'ye geri eklemek istendiginde sorunsuz olur.)

ALTER TABLE `applications` MODIFY COLUMN `version` BIGINT NOT NULL DEFAULT 0;
ALTER TABLE `job_listings` MODIFY COLUMN `version` BIGINT NOT NULL DEFAULT 0;
ALTER TABLE `shift_slots`  MODIFY COLUMN `version` BIGINT NOT NULL DEFAULT 0;
