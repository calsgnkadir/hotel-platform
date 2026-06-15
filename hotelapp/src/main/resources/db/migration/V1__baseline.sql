-- FAZ 4.3 — V1 baseline (canli DB'den otomatik dump)
-- 2026-06-14T23:59:57.491019500

SET FOREIGN_KEY_CHECKS=0;

-- ──────── application_shift_slots ────────
CREATE TABLE `application_shift_slots` (
  `application_id` bigint NOT NULL,
  `shift_slot_id` bigint NOT NULL,
  PRIMARY KEY (`application_id`,`shift_slot_id`),
  KEY `FK57l6j16dhbefomtl5uquc6ajm` (`shift_slot_id`),
  CONSTRAINT `FK4fu8owjvbbl6rwy64awl3t58q` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`),
  CONSTRAINT `FK57l6j16dhbefomtl5uquc6ajm` FOREIGN KEY (`shift_slot_id`) REFERENCES `shift_slots` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ──────── applications ────────
CREATE TABLE `applications` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `cover_letter` text,
  `created_at` datetime(6) NOT NULL,
  `deadline` datetime(6) NOT NULL,
  `no_show` bit(1) NOT NULL,
  `note` varchar(255) DEFAULT NULL,
  `reviewed_at` datetime(6) DEFAULT NULL,
  `status` varchar(20) NOT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `candidate_id` bigint NOT NULL,
  `job_listing_id` bigint NOT NULL,
  `hold_deadline` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FK32iahkg1fqci0pt76uql80nj7` (`candidate_id`),
  KEY `FKk0nbh7a4olvjc73i2ctr80mom` (`job_listing_id`),
  CONSTRAINT `FK32iahkg1fqci0pt76uql80nj7` FOREIGN KEY (`candidate_id`) REFERENCES `users` (`id`),
  CONSTRAINT `FKk0nbh7a4olvjc73i2ctr80mom` FOREIGN KEY (`job_listing_id`) REFERENCES `job_listings` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ──────── audit_logs ────────
CREATE TABLE `audit_logs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `action` varchar(40) NOT NULL,
  `actor_email` varchar(120) NOT NULL,
  `actor_id` bigint DEFAULT NULL,
  `actor_role` varchar(20) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL,
  `details` text,
  `target_id` bigint DEFAULT NULL,
  `target_type` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ──────── availabilities ────────
CREATE TABLE `availabilities` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `day_of_week` enum('MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY') NOT NULL,
  `end_time` time(6) NOT NULL,
  `start_time` time(6) NOT NULL,
  `application_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FKoxxjt1c9v4xk8s3ogm6e0im1o` (`application_id`),
  CONSTRAINT `FKoxxjt1c9v4xk8s3ogm6e0im1o` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ──────── business_favorites ────────
CREATE TABLE `business_favorites` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `note` text,
  `business_id` bigint NOT NULL,
  `candidate_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_business_candidate` (`business_id`,`candidate_id`),
  KEY `idx_fav_business` (`business_id`),
  KEY `idx_fav_candidate` (`candidate_id`),
  CONSTRAINT `FKdpysb8m6tbgapjawvyvwihmn2` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`),
  CONSTRAINT `FKfuewleh94vg5llggx7qky14nm` FOREIGN KEY (`candidate_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ──────── business_photos ────────
CREATE TABLE `business_photos` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `file_path` varchar(255) NOT NULL,
  `business_id` bigint NOT NULL,
  `display_order` int NOT NULL,
  `is_cover` bit(1) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FK5thkaqs289ttf5at1xjk8dll2` (`business_id`),
  CONSTRAINT `FK5thkaqs289ttf5at1xjk8dll2` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ──────── businesses ────────
CREATE TABLE `businesses` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `address` varchar(255) DEFAULT NULL,
  `category` varchar(255) DEFAULT NULL,
  `city` varchar(255) NOT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  `description` text,
  `district` varchar(255) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `phone` varchar(255) DEFAULT NULL,
  `type` enum('HOTEL','RESTAURANT','CAFE') NOT NULL,
  `website` varchar(255) DEFAULT NULL,
  `owner_id` bigint NOT NULL,
  `facebook` varchar(255) DEFAULT NULL,
  `instagram` varchar(255) DEFAULT NULL,
  `working_hours` text,
  `logo_path` varchar(255) DEFAULT NULL,
  `neighborhood` varchar(255) DEFAULT NULL,
  `latitude` decimal(10,7) DEFAULT NULL,
  `longitude` decimal(10,7) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FKdh1y7wew1fqwy531d5ojohod5` (`owner_id`),
  CONSTRAINT `FKdh1y7wew1fqwy531d5ojohod5` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ──────── conversations ────────
CREATE TABLE `conversations` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `last_message_at` datetime(6) NOT NULL,
  `application_id` bigint DEFAULT NULL,
  `business_owner_id` bigint NOT NULL,
  `candidate_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_conv_candidate_business` (`candidate_id`,`business_owner_id`),
  KEY `idx_conv_candidate` (`candidate_id`),
  KEY `idx_conv_business_owner` (`business_owner_id`),
  KEY `idx_conv_last_message_at` (`last_message_at`),
  KEY `FKqkcq12upmrrowkcy7qid0i96w` (`application_id`),
  CONSTRAINT `FKdwsr9rg81f5jc6840vbq3xd0x` FOREIGN KEY (`candidate_id`) REFERENCES `users` (`id`),
  CONSTRAINT `FKmxa1b8dnqnxaw68l6ykw4axyp` FOREIGN KEY (`business_owner_id`) REFERENCES `users` (`id`),
  CONSTRAINT `FKqkcq12upmrrowkcy7qid0i96w` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ──────── document_requests ────────
CREATE TABLE `document_requests` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `document_type` enum('CV','TRANSCRIPT','STUDENT_CERTIFICATE','CRIMINAL_RECORD','HEALTH_CERTIFICATE','IDENTITY_DOCUMENT') NOT NULL,
  `requested_at` datetime(6) DEFAULT NULL,
  `responded_at` datetime(6) DEFAULT NULL,
  `status` enum('PENDING','GRANTED','DENIED') NOT NULL,
  `application_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FKc2je7jh43h0kru5mri6etk2n6` (`application_id`),
  CONSTRAINT `FKc2je7jh43h0kru5mri6etk2n6` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ──────── documents ────────
CREATE TABLE `documents` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `file_path` varchar(255) NOT NULL,
  `is_sensitive` bit(1) NOT NULL,
  `original_file_name` varchar(255) DEFAULT NULL,
  `type` enum('CV','TRANSCRIPT','STUDENT_CERTIFICATE','CRIMINAL_RECORD','HEALTH_CERTIFICATE','IDENTITY_DOCUMENT') NOT NULL,
  `uploaded_at` datetime(6) DEFAULT NULL,
  `verified` bit(1) NOT NULL,
  `verified_at` datetime(6) DEFAULT NULL,
  `student_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FKl8jfa6b5rwoypt1i3j7i362s1` (`student_id`),
  CONSTRAINT `FKl8jfa6b5rwoypt1i3j7i362s1` FOREIGN KEY (`student_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ──────── job_listings ────────
CREATE TABLE `job_listings` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `description` text NOT NULL,
  `end_date` date DEFAULT NULL,
  `job_type` enum('PERMANENT','SEASONAL','DAILY','PART_TIME') NOT NULL,
  `position` enum('WAITER','DISHWASHER','HOUSEKEEPING','RECEPTION','KITCHEN_STAFF','BELLBOY','SECURITY') NOT NULL,
  `requirements` text,
  `salary_max` decimal(38,2) DEFAULT NULL,
  `salary_min` decimal(38,2) DEFAULT NULL,
  `shift_end` time(6) DEFAULT NULL,
  `shift_start` time(6) DEFAULT NULL,
  `start_date` date DEFAULT NULL,
  `status` enum('ACTIVE','PAUSED','CLOSED') NOT NULL,
  `title` varchar(255) NOT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `business_id` bigint NOT NULL,
  `shift` enum('MORNING','EVENING','NIGHT') DEFAULT NULL,
  `salary_type` enum('HOURLY','DAILY','MONTHLY','NEGOTIABLE') DEFAULT NULL,
  `tips_included` bit(1) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FKthewtdh49nvou2kptjut1yxt0` (`business_id`),
  CONSTRAINT `FKthewtdh49nvou2kptjut1yxt0` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ──────── messages ────────
CREATE TABLE `messages` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `content` text NOT NULL,
  `is_read` bit(1) NOT NULL,
  `sent_at` datetime(6) NOT NULL,
  `conversation_id` bigint NOT NULL,
  `sender_id` bigint NOT NULL,
  `attachment_name` varchar(200) DEFAULT NULL,
  `attachment_size` bigint DEFAULT NULL,
  `attachment_type` varchar(20) DEFAULT NULL,
  `attachment_url` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_msg_conversation` (`conversation_id`,`sent_at`),
  KEY `idx_msg_conversation_unread` (`conversation_id`,`is_read`),
  KEY `FK4ui4nnwntodh6wjvck53dbk9m` (`sender_id`),
  CONSTRAINT `FK4ui4nnwntodh6wjvck53dbk9m` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`),
  CONSTRAINT `FKt492th6wsovh1nush5yl5jj8e` FOREIGN KEY (`conversation_id`) REFERENCES `conversations` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=35 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ──────── notifications ────────
CREATE TABLE `notifications` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `is_read` bit(1) NOT NULL,
  `link` varchar(50) DEFAULT NULL,
  `message` text,
  `title` varchar(150) NOT NULL,
  `type` varchar(40) NOT NULL,
  `recipient_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_notif_recipient` (`recipient_id`,`is_read`),
  CONSTRAINT `FKqqnsjxlwleyjbxlmm213jaj3f` FOREIGN KEY (`recipient_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=49 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ──────── password_reset_tokens ────────
CREATE TABLE `password_reset_tokens` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `expires_at` datetime(6) NOT NULL,
  `token` varchar(64) NOT NULL,
  `used_at` datetime(6) DEFAULT NULL,
  `user_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_prt_token` (`token`),
  KEY `idx_prt_user` (`user_id`),
  CONSTRAINT `FKk3ndxg5xp6v7wd4gjyusp15gq` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ──────── push_subscriptions ────────
CREATE TABLE `push_subscriptions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `auth_secret` varchar(100) DEFAULT NULL,
  `created_at` datetime(6) NOT NULL,
  `endpoint` varchar(500) NOT NULL,
  `p256dh` varchar(200) DEFAULT NULL,
  `user_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK_6vabkyu7g789ehysoff7cfumf` (`endpoint`),
  KEY `idx_push_user` (`user_id`),
  CONSTRAINT `FK1v577hpc7v9mdrm2uyk6kqgnl` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ──────── refresh_tokens ────────
CREATE TABLE `refresh_tokens` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `expires_at` datetime(6) NOT NULL,
  `last_used_at` datetime(6) DEFAULT NULL,
  `revoked` bit(1) NOT NULL,
  `token_hash` varchar(64) NOT NULL,
  `user_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_refresh_token_hash` (`token_hash`),
  KEY `idx_refresh_user` (`user_id`),
  KEY `idx_refresh_expires` (`expires_at`),
  CONSTRAINT `FK1lih5y2npsf8u5o3vhdb9y0os` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=59 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ──────── reports ────────
CREATE TABLE `reports` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `admin_note` text,
  `created_at` datetime(6) NOT NULL,
  `description` text,
  `reason` enum('FAKE','SPAM','SCAM','INAPPROPRIATE','HARASSMENT','OTHER') NOT NULL,
  `reviewed_at` datetime(6) DEFAULT NULL,
  `status` enum('PENDING','RESOLVED','DISMISSED') NOT NULL,
  `target_id` bigint NOT NULL,
  `target_type` enum('LISTING','BUSINESS','USER') NOT NULL,
  `reporter_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FKd3qiw2om5d2oh5xb7fbdcq225` (`reporter_id`),
  CONSTRAINT `FKd3qiw2om5d2oh5xb7fbdcq225` FOREIGN KEY (`reporter_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ──────── reviews ────────
CREATE TABLE `reviews` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `by_role` varchar(10) NOT NULL,
  `comment` text,
  `created_at` datetime(6) NOT NULL,
  `rating` int NOT NULL,
  `application_id` bigint NOT NULL,
  `aspect1` int DEFAULT NULL,
  `aspect2` int DEFAULT NULL,
  `aspect3` int DEFAULT NULL,
  `aspect4` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_review_application_role` (`application_id`,`by_role`),
  CONSTRAINT `FKomqwp3i5egjrpwflovsyx0fq5` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ──────── shift_slots ────────
CREATE TABLE `shift_slots` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `date` date NOT NULL,
  `end_time` time(6) NOT NULL,
  `slots_filled` int NOT NULL,
  `slots_needed` int NOT NULL,
  `start_time` time(6) NOT NULL,
  `job_listing_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FK18ufqe31f2627acgep284px0c` (`job_listing_id`),
  CONSTRAINT `FK18ufqe31f2627acgep284px0c` FOREIGN KEY (`job_listing_id`) REFERENCES `job_listings` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ──────── user_availability_types ────────
CREATE TABLE `user_availability_types` (
  `user_id` bigint NOT NULL,
  `availability_type` enum('PERMANENT','SEASONAL','DAILY','PART_TIME') DEFAULT NULL,
  KEY `FK4fr5743gbx9288i4tu26qf2q1` (`user_id`),
  CONSTRAINT `FK4fr5743gbx9288i4tu26qf2q1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ──────── user_languages ────────
CREATE TABLE `user_languages` (
  `user_id` bigint NOT NULL,
  `language` enum('TURKISH','ENGLISH','GERMAN','RUSSIAN','ARABIC','FRENCH','SPANISH','ITALIAN') DEFAULT NULL,
  KEY `FKt3sjkb7b30p03i378qdcr2s9k` (`user_id`),
  CONSTRAINT `FKt3sjkb7b30p03i378qdcr2s9k` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ──────── user_preferred_districts ────────
CREATE TABLE `user_preferred_districts` (
  `user_id` bigint NOT NULL,
  `district` varchar(50) DEFAULT NULL,
  KEY `FKgocmrgphs04l9ffdw098l4x8d` (`user_id`),
  CONSTRAINT `FKgocmrgphs04l9ffdw098l4x8d` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ──────── user_preferred_positions ────────
CREATE TABLE `user_preferred_positions` (
  `user_id` bigint NOT NULL,
  `position` enum('WAITER','DISHWASHER','HOUSEKEEPING','RECEPTION','KITCHEN_STAFF','BELLBOY','SECURITY') DEFAULT NULL,
  KEY `FKhp1a3hts49np8ptm3o77wy65u` (`user_id`),
  CONSTRAINT `FKhp1a3hts49np8ptm3o77wy65u` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ──────── users ────────
CREATE TABLE `users` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `banned_until` datetime(6) DEFAULT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  `email` varchar(255) NOT NULL,
  `enabled` bit(1) NOT NULL,
  `full_name` varchar(255) NOT NULL,
  `is_student` bit(1) NOT NULL,
  `password` varchar(255) NOT NULL,
  `phone` varchar(255) DEFAULT NULL,
  `role` enum('CANDIDATE','BUSINESS_OWNER','ADMIN') NOT NULL,
  `strikes_remaining` int NOT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `birth_date` date DEFAULT NULL,
  `district` varchar(255) DEFAULT NULL,
  `education` enum('HIGH_SCHOOL','UNIVERSITY_STUDENT','UNIVERSITY_GRADUATE','MASTERS','PHD') DEFAULT NULL,
  `gender` enum('MALE','FEMALE','OTHER') DEFAULT NULL,
  `has_license` bit(1) DEFAULT NULL,
  `previous_experience` text,
  `smokes` bit(1) DEFAULT NULL,
  `avatar_path` varchar(255) DEFAULT NULL,
  `neighborhood` varchar(255) DEFAULT NULL,
  `provider` enum('LOCAL','GOOGLE') NOT NULL,
  `provider_id` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK_6dotkott2kjsp8vw4d0m25fb7` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=35 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ──────── work_sessions ────────
CREATE TABLE `work_sessions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `clock_in_at` datetime(6) NOT NULL,
  `clock_in_distance_meters` int DEFAULT NULL,
  `clock_in_lat` decimal(10,7) DEFAULT NULL,
  `clock_in_lng` decimal(10,7) DEFAULT NULL,
  `clock_out_at` datetime(6) DEFAULT NULL,
  `clock_out_distance_meters` int DEFAULT NULL,
  `clock_out_lat` decimal(10,7) DEFAULT NULL,
  `clock_out_lng` decimal(10,7) DEFAULT NULL,
  `application_id` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_ws_app` (`application_id`),
  KEY `idx_ws_open` (`application_id`,`clock_out_at`),
  CONSTRAINT `FKcekfycq068w6ceh7gg67bhrjv` FOREIGN KEY (`application_id`) REFERENCES `applications` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

SET FOREIGN_KEY_CHECKS=1;
