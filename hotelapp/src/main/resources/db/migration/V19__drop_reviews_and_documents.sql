-- Puanlama (reviews) ve uygulama ici belge sistemi (documents, document_requests)
-- tamamen kaldirildi; kod bu tablolari artik kullanmiyor. Belgeler yalnizca
-- sohbet eki olarak gonderilir (messages tablosu).
-- Diger tablolardan bu tablolara foreign key yok.
DROP TABLE IF EXISTS document_requests;
DROP TABLE IF EXISTS documents;
DROP TABLE IF EXISTS reviews;
