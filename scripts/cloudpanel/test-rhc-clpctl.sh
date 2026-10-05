#!/usr/bin/env bash
#
# Allowlist tests for rhc-clpctl, run against a stub clpctl in a temp directory.
#
#   bash scripts/cloudpanel/test-rhc-clpctl.sh
#
# Runs as a normal user only: under root or sudo the wrapper ignores every
# override and would point at the real /usr/bin/clpctl.

set -uo pipefail

if [ "$(id -u)" = 0 ] || [ -n "${SUDO_USER:-}" ]; then
  echo "run as a normal user, not root/sudo" >&2
  exit 2
fi

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WRAPPER="$HERE/rhc-clpctl"
T="$(mktemp -d)"
trap 'chmod -R u+w "$T" 2>/dev/null; rm -rf "$T"' EXIT

mkdir -p "$T/exports" "$T/import" "$T/elsewhere"
chmod 0700 "$T/exports" "$T/import"
printf '#!/bin/sh\necho "STUB $*"\n' > "$T/clpctl"
chmod +x "$T/clpctl"
echo "-- SQL" > "$T/import/dump.sql"
echo "key" > "$T/import/site.key"
echo "secret" > "$T/elsewhere/secret"
ln -s "$T/elsewhere/secret" "$T/import/link.sql"
ln -s "$T/elsewhere/secret" "$T/exports/link.sql.gz"
mkdir "$T/exports/adir"

export CLPCTL_BIN="$T/clpctl"
export CLPCTL_DESTRUCTIVE_MARKER="$T/marker"
export RHC_CLPCTL_EXPORT_DIR="$T/exports"
export RHC_CLPCTL_IMPORT_DIR="$T/import"

PASS=0
FAIL=0
check() {
  local expect="$1" desc="$2" out rc
  shift 2
  out="$(bash "$WRAPPER" "$@" 2>&1)"
  rc=$?
  if { [ "$expect" = ok ] && [ $rc -eq 0 ]; } || { [ "$expect" = refuse ] && [ $rc -ne 0 ] && [[ $out != *STUB* ]]; }; then
    PASS=$((PASS + 1))
  else
    FAIL=$((FAIL + 1))
    echo "FAIL ($expect): $desc"
    echo "     -> rc=$rc $out"
  fi
}

PW='s3cret-Pass!'

# --- commands ---
check ok     "listed safe command"                 user:list
check refuse "unknown command"                     db:show:master-credentials
check refuse "empty command"                       ''
check refuse "command with path"                   ../../bin/sh
check refuse "no command"

# --- per-command flags ---
check ok     "site:add:nodejs, own flags"          site:add:nodejs --domainName=acme.example.com --nodejsVersion=22 --appPort=3000 --siteUser=acme_test1 "--siteUserPassword=$PW"
check refuse "--file on a command that has none"   user:list --file="$T/exports/x.sql"
check refuse "--force outside site:delete"         user:list --force
check refuse "flag from another verb"              db:add --domainName=acme.example.com --databaseName=a --databaseUserName=b "--databaseUserPassword=$PW" --role=admin
check refuse "empty flag name"                     user:list --=x
check refuse "empty value"                         user:reset:password --userName= "--password=$PW"
check refuse "positional argument"                 user:list extra
check refuse "duplicate flag"                      user:reset:password --userName=a --userName=b "--password=$PW"
check refuse "newline in value"                    user:reset:password "--userName=a
b" "--password=$PW"

# --- value shapes ---
check refuse "bad domain"                          lets-encrypt:install:certificate --domainName='acme;rm -rf /'
check refuse "domain without a dot"                lets-encrypt:install:certificate --domainName=localhost
check ok     "SAN list with spaces"                lets-encrypt:install:certificate --domainName=acme.example.com "--subjectAlternativeName=www.acme.example.com, api.acme.example.com"
check refuse "siteUser = existing account"         site:add:static --domainName=acme.example.com --siteUser=root "--siteUserPassword=$PW"
check refuse "siteUser uppercase"                  site:add:static --domainName=acme.example.com --siteUser=Acme "--siteUserPassword=$PW"
check refuse "port out of range"                   site:add:nodejs --domainName=acme.example.com --nodejsVersion=22 --appPort=70000 --siteUser=acme_test1 "--siteUserPassword=$PW"
check refuse "short password"                      user:reset:password --userName=a --password=short
check refuse "bad role"                            user:add --userName=a --email=a@example.com --firstName=A --lastName=B "--password=$PW" '--role=admin;x'
check refuse "bad status"                          user:add --userName=a --email=a@example.com --firstName=A --lastName=B "--password=$PW" --role=user --status=root
check refuse "proxy to file://"                    site:add:reverse-proxy --domainName=acme.example.com --reverseProxyUrl=file:///etc/passwd --siteUser=acme_test1 "--siteUserPassword=$PW"

# --- db:export writes only into the export dir ---
check ok     "export into export dir"              db:export --databaseName=acme --file="$T/exports/acme.sql.gz"
check refuse "export to /etc/passwd"               db:export --databaseName=acme --file=/etc/passwd
check refuse "export to sudoers.d"                 db:export --databaseName=acme --file=/etc/sudoers.d/zz
check refuse "export into a subdirectory"          db:export --databaseName=acme --file="$T/exports/adir/x.sql"
check refuse "export with traversal"               db:export --databaseName=acme --file="$T/exports/../elsewhere/x.sql"
check refuse "export over a planted symlink"       db:export --databaseName=acme --file="$T/exports/link.sql.gz"
check refuse "export onto a directory"             db:export --databaseName=acme --file="$T/exports/adir"
check refuse "export, relative path"               db:export --databaseName=acme --file=acme.sql.gz

# --- destructive gate ---
check refuse "site:delete without marker"          site:delete --domainName=acme.example.com --force
touch "$T/marker"
check ok     "site:delete with marker"             site:delete --domainName=acme.example.com --force

# --- reads only from the import dir ---
check ok     "import from import dir"              db:import --databaseName=acme --file="$T/import/dump.sql"
check refuse "import /etc/shadow"                  db:import --databaseName=acme --file=/etc/shadow
check refuse "import via symlink"                  db:import --databaseName=acme --file="$T/import/link.sql"
check refuse "import missing file"                 db:import --databaseName=acme --file="$T/import/nope.sql"
check refuse "import from export dir"              db:import --databaseName=acme --file="$T/exports/acme.sql.gz"
check ok     "certificate from import dir"         site:install:certificate --domainName=acme.example.com --privateKey="$T/import/site.key" --certificate="$T/import/site.key"
check refuse "certificate key = /etc/shadow"       site:install:certificate --domainName=acme.example.com --privateKey=/etc/shadow --certificate="$T/import/site.key"

# --- directory hygiene ---
chmod 0770 "$T/import"
check refuse "import dir group-writable"           db:import --databaseName=acme --file="$T/import/dump.sql"
chmod 0700 "$T/import"
mv "$T/exports" "$T/exports-real"
ln -s "$T/exports-real" "$T/exports"
check refuse "export dir is a symlink"             db:export --databaseName=acme --file="$T/exports/acme2.sql.gz"
rm "$T/exports"
check ok     "missing export dir is created 0700"  db:export --databaseName=acme --file="$T/exports/acme3.sql.gz"
[ "$(stat -c %a "$T/exports")" = 700 ] && PASS=$((PASS + 1)) || { FAIL=$((FAIL + 1)); echo "FAIL: created export dir is $(stat -c %a "$T/exports"), want 700"; }

echo "$PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
