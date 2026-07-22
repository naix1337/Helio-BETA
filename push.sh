# alle geänderten Dateien wurden erstellt/aktualisiert
git add -A
git commit -m "v2.1.0: Production-Ready Release - Security Hardening, Observability, Bugfixes"

git tag -a v2.1.0 -m "v2.1.0 - Production-Ready Release"
git push origin main --tags
