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
chmod 0700 "$T" "$T/exports" "$T/import"
printf '#!/bin/sh\necho "STUB $*"\n' > "$T/clpctl"
chmod +x "$T/clpctl"
# CloudPanel 2.5's real /usr/bin/clpctl, verbatim except that the privileged call
# (`sudo /usr/bin/clpctlWrapper`) is replaced by printing each argument it would
# have received. It re-quotes its arguments with printf %q and runs `bash -c` on
# the result, which is what the wrapper's character limits exist for.
cat > "$T/clpctl-requote" <<'EOF'
#!/bin/bash
if [ "$#" -eq 0 ]; then
  printf 'ARG<%s>\n' $@
else
  args=$(printf ' "%q"' "$@")
  bash -c "printf 'ARG<%s>\n' $args"
fi
EOF
chmod +x "$T/clpctl-requote"
# Prints the environment clpctl receives.
printf '#!/bin/sh\necho STUB; env\n' > "$T/clpctl-env"
chmod +x "$T/clpctl-env"
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
OUT=""
# STDIN is what the wrapper reads on stdin (empty by default).
STDIN=""
run() { OUT="$(printf '%s' "$STDIN" | bash "$WRAPPER" "$@" 2>&1)"; }
check() {
  local expect="$1" desc="$2" rc
  shift 2
  run "$@"
  rc=$?
  if { [ "$expect" = ok ] && [ $rc -eq 0 ]; } || { [ "$expect" = refuse ] && [ $rc -ne 0 ] && [[ $OUT != *STUB* ]] && [[ $OUT != *ARG\<* ]]; }; then
    PASS=$((PASS + 1))
  else
    FAIL=$((FAIL + 1))
    echo "FAIL ($expect): $desc"
    echo "     -> rc=$rc $OUT"
  fi
}
# refuse_because <text the refusal must contain> <desc> <args...>
refuse_because() {
  local why="$1" desc="$2"
  shift 2
  check refuse "$desc" "$@"
  if [[ $OUT != *"$why"* ]]; then
    PASS=$((PASS - 1)); FAIL=$((FAIL + 1))
    echo "FAIL (refused for the wrong reason, want '$why'): $desc"
    echo "     -> $OUT"
  fi
}
# expect_out <text clpctl's output must contain> <desc>
expect_out() {
  if [[ $OUT == *"$1"* ]]; then PASS=$((PASS + 1)); else
    FAIL=$((FAIL + 1)); echo "FAIL (output lacks '$1'): $2"; echo "     -> $OUT"; fi
}

PW='s3cret-Pass#9'
CANARY="$T/PWNED"

# Gated verbs are covered by their own section; everything else runs with the
# marker present so a refusal can only come from the check under test.
touch "$T/marker"

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
check ok     "SAN list"                            lets-encrypt:install:certificate --domainName=acme.example.com "--subjectAlternativeName=www.acme.example.com,api.acme.example.com"
check refuse "SAN list with spaces"                lets-encrypt:install:certificate --domainName=acme.example.com "--subjectAlternativeName=www.acme.example.com, api.acme.example.com"
check refuse "SAN list with an empty item"         lets-encrypt:install:certificate --domainName=acme.example.com "--subjectAlternativeName=www.acme.example.com,"
check refuse "siteUser = existing account"         site:add:static --domainName=acme.example.com --siteUser=root "--siteUserPassword=$PW"
check refuse "siteUser uppercase"                  site:add:static --domainName=acme.example.com --siteUser=Acme "--siteUserPassword=$PW"
check refuse "port out of range"                   site:add:nodejs --domainName=acme.example.com --nodejsVersion=22 --appPort=70000 --siteUser=acme_test1 "--siteUserPassword=$PW"
check refuse "short password"                      user:reset:password --userName=a --password=short
check refuse "password with a space"               user:reset:password --userName=a "--password=two words here"
check refuse "bad role"                            user:add --userName=a --email=a@example.com --firstName=A --lastName=B "--password=$PW" '--role=admin;x'
check refuse "role CloudPanel does not have"       user:add --userName=a --email=a@example.com --firstName=A --lastName=B "--password=$PW" --role=superadmin
check ok     "user:add, every flag"                user:add --userName=jane.doe --email=jane+cp@example.com --firstName=Jane --lastName=Doe-Smith "--password=$PW" --role=user --sites=acme.example.com,b.example.com --timezone=Europe/Berlin --status=1
check refuse "bad status"                          user:add --userName=a --email=a@example.com --firstName=A --lastName=B "--password=$PW" --role=user --status=root
check refuse "email with a quote"                  user:add --userName=a "--email=a'b@example.com" --firstName=A --lastName=B "--password=$PW" --role=user
check refuse "name with a space"                   user:add --userName=a --email=a@example.com "--firstName=Mary Ann" --lastName=B "--password=$PW" --role=user
check refuse "proxy to file://"                    site:add:reverse-proxy --domainName=acme.example.com --reverseProxyUrl=file:///etc/passwd --siteUser=acme_test1 "--siteUserPassword=$PW"
check ok     "vhost template with a space"         site:add:php --domainName=acme.example.com --phpVersion=8.3 "--vhostTemplate=Laravel 11" --siteUser=acme_test1 "--siteUserPassword=$PW"
check refuse "vhost template word that is a flag"  site:add:php --domainName=acme.example.com --phpVersion=8.3 "--vhostTemplate=Generic --force" --siteUser=acme_test1 "--siteUserPassword=$PW"

# --- CloudPanel's clpctl re-runs its arguments through `bash -c` ---
# With a non-ASCII byte in the value, printf %q emits $'...', which clpctl's
# double quotes do not neutralise: before this check, each of these ran the
# command substitution as root. The canary file must never appear.
export CLPCTL_BIN="$T/clpctl-requote"
refuse_because "may only contain" "password: \$() + non-ASCII byte" \
  site:add:static --domainName=acme.example.com --siteUser=acme_test1 "--siteUserPassword=\$(touch $CANARY)é1234567"
refuse_because "may only contain" "password: \$() + invalid UTF-8 byte" \
  user:reset:password --userName=a "--password=\$(touch $CANARY)$(printf '\xff')1234567"
refuse_because "may only contain" "name: backtick + non-ASCII byte" \
  user:add --userName=a --email=a@example.com "--firstName=\`touch $CANARY\`é" --lastName=B "--password=$PW" --role=user
refuse_because "may only contain" "password: pure-ASCII \$()" \
  user:reset:password --userName=a "--password=\$(touch $CANARY)xx"
refuse_because "may only contain" "password: backtick" \
  user:reset:password --userName=a "--password=\`touch $CANARY\`xx"
refuse_because "may only contain" "name: non-ASCII letter" \
  user:add --userName=a --email=a@example.com --firstName=José --lastName=B "--password=$PW" --role=user
STDIN="\$(touch $CANARY)é1234567
"
refuse_because "may only contain" "password on stdin: \$() + non-ASCII byte" \
  user:reset:password --userName=a --password=-
STDIN=""
if [ -e "$CANARY" ]; then FAIL=$((FAIL + 1)); echo "FAIL: a payload executed (canary exists)"; else PASS=$((PASS + 1)); fi
# What does pass reaches clpctlWrapper unchanged after CloudPanel's re-quoting.
SAFE_PW='Aa0#%+./:=@_-Zz9'
check ok     "allowed password survives re-quoting" user:reset:password --userName=jane.doe "--password=$SAFE_PW"
expect_out   "ARG<--password=$SAFE_PW>" "allowed password survives re-quoting"
export CLPCTL_BIN="$T/clpctl"

# --- passwords on stdin ---
STDIN="$PW
"
check ok     "password read from stdin"            user:reset:password --userName=a --password=-
expect_out   "--password=$PW" "password read from stdin reaches clpctl"
STDIN="$PW
other-Pass#2
"
check ok     "two stdin secrets, in argument order" db:add --domainName=acme.example.com --databaseName=a --databaseUserName=b --databaseUserPassword=-
expect_out   "--databaseUserPassword=$PW" "first stdin line goes to the first secret flag"
STDIN=""
refuse_because "standard input" "stdin secret missing"  user:reset:password --userName=a --password=-
STDIN="jane
"
check refuse "'-' is read from stdin only for secrets" user:reset:password --userName=- "--password=$PW"
STDIN=""

# --- clpctl gets an empty environment ---
export CLPCTL_BIN="$T/clpctl-env"
export SECRET_CANARY=leak PHPRC="$T/php.ini"
check ok     "env stub runs"                       user:list
unset SECRET_CANARY PHPRC
if [[ $OUT == *SECRET_CANARY* || $OUT == *PHPRC* || $OUT == *CLPCTL_BIN* ]]; then
  FAIL=$((FAIL + 1)); echo "FAIL: caller environment reached clpctl"; echo "     -> $OUT"
else PASS=$((PASS + 1)); fi
expect_out "PATH=/usr/sbin:/usr/bin:/sbin:/bin" "clpctl gets the fixed PATH"
export CLPCTL_BIN="$T/clpctl"

# --- db:export writes only into the export dir ---
check ok     "export into export dir"              db:export --databaseName=acme --file="$T/exports/acme.sql.gz"
check refuse "export to /etc/passwd"               db:export --databaseName=acme --file=/etc/passwd
check refuse "export to sudoers.d"                 db:export --databaseName=acme --file=/etc/sudoers.d/zz
check refuse "export into a subdirectory"          db:export --databaseName=acme --file="$T/exports/adir/x.sql"
check refuse "export with traversal"               db:export --databaseName=acme --file="$T/exports/../elsewhere/x.sql"
check refuse "export over a planted symlink"       db:export --databaseName=acme --file="$T/exports/link.sql.gz"
check refuse "export onto a directory"             db:export --databaseName=acme --file="$T/exports/adir"
check refuse "export, relative path"               db:export --databaseName=acme --file=acme.sql.gz

# --- gated verbs: destructive, or handing out panel access ---
rm -f "$T/marker"
refuse_because "does not exist" "site:delete without marker"         site:delete --domainName=acme.example.com --force
refuse_because "does not exist" "user:delete without marker"         user:delete --userName=a
refuse_because "does not exist" "user:disable:mfa without marker"    user:disable:mfa --userName=a
refuse_because "does not exist" "db:import without marker"           db:import --databaseName=acme --file="$T/import/dump.sql"
refuse_because "does not exist" "user:add without marker"            user:add --userName=a --email=a@example.com --firstName=A --lastName=B "--password=$PW" --role=admin
refuse_because "does not exist" "user:reset:password without marker" user:reset:password --userName=a "--password=$PW"
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
chmod 0770 "$T"
refuse_because "group- or world-writable" "parent of import dir group-writable" db:import --databaseName=acme --file="$T/import/dump.sql"
chmod 0700 "$T"
mv "$T/exports" "$T/exports-real"
ln -s "$T/exports-real" "$T/exports"
check refuse "export dir is a symlink"             db:export --databaseName=acme --file="$T/exports/acme2.sql.gz"
rm "$T/exports"
check ok     "missing export dir is created 0700"  db:export --databaseName=acme --file="$T/exports/acme3.sql.gz"
[ "$(stat -c %a "$T/exports")" = 700 ] && PASS=$((PASS + 1)) || { FAIL=$((FAIL + 1)); echo "FAIL: created export dir is $(stat -c %a "$T/exports"), want 700"; }

echo "$PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
