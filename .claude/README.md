# Claude Code yapılandırması

Bu klasör projeye özel Claude Code ayarlarını içerir.

## `agents/`

Projeye özel subagent tanımları. Her `.md` dosyası bir agent.

| Agent | Görev |
|---|---|
| `backend-fixer.md` | Spring Boot controller/service/DTO yazımı |
| `frontend-builder.md` | React + Tailwind sayfa/component üretimi |
| `db-schema.md` | JPA entity + MySQL şema değişiklikleri |
| `api-tester.md` | curl ile endpoint duman testi (Windows) |
| `code-reviewer.md` | Güvenlik + ölü kod + convention denetimi |

Claude Code oturumunda kullanım:
- Otomatik: ben görevi sezip uygun agent'a delege ederim
- Açık çağrı: `@backend-fixer ApplicationController yaz`
- UI: `/agents` komutu ile listele/düzenle

## `settings.local.json` (gitignore'da)

Kullanıcının lokal Claude Code izin tercihleri. Repo'ya commit edilmez, kişiseldir.
