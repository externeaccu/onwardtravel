#!/bin/bash
# Runs every documented scenario command (header comments) at its own width and, for
# scenarios not tied to one width, at the other width too. Prints PASS/FAIL per run.
cd "$1"
pass=0; fail=0
for f in test/scenarios/{admin-edge,admin-manage,admin,booking,critic-*,fix-*,integration-extras,public-null,trek-map,overview}.mjs; do
  grep -o "node test/run.mjs[^\`]*" "$f" | sed 's/[[:space:]]*$//' | while read -r cmd; do
    for w in 390 1440; do
      c=$(echo "$cmd" | sed -E "s/--width [0-9]+/--width $w/")
      echo "$c" | grep -q -- "--width" || c="$c --width $w"
      out=$(eval "$c" 2>&1 | tail -4)
      if echo "$out" | grep -q "ERRORS: none" && ! echo "$out" | grep -q "THREW"; then echo "PASS $w $(basename $f)"; else echo "FAIL $w $(basename $f) :: $(echo "$out" | tr '\n' ' ' | cut -c1-300)"; fi
    done
  done
done
