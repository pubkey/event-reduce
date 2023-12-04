#!/bin/bash
set -e

nohup npm run optimize-parallel > optimize.nohup.out &
