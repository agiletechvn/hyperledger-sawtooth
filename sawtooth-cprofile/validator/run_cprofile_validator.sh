#!/bin/bash
python3 ./cprof_authorization_handlers.py
wait
python3 ./cprof_batch_tracker.py
wait
python3 ./cprof_block_cache.py