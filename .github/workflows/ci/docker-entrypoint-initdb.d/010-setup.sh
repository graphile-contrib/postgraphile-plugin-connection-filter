#!/usr/bin/env bash
set -e

createdb graphile_test_c -U postgres --template template0 --lc-collate C
