# Copyright 2016, 2017 Intel Corporation
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
# ------------------------------------------------------------------------------

import unittest
import time

from sawtooth_signing import create_context
from sawtooth_signing.secp256k1 import Secp256k1PrivateKey

from sawtooth_poet_simulator.poet_enclave_simulator.enclave_wait_timer \
    import EnclaveWaitTimer





def _create_random_key():
    return Secp256k1PrivateKey.new_random()

def test_create_wait_timer(benchmark):
    @benchmark
    def do_create_wait_timer():
        wait_timer = \
            EnclaveWaitTimer(
                validator_address='1600 Pennsylvania Avenue NW',
                duration=3.14159,
                previous_certificate_id='Bond.  James Bond.',
                local_mean=2.71828)

    

def test_serialize_wait_timer(benchmark):
    @benchmark
    def do_serialize_wait_timer():
        wait_timer = \
            EnclaveWaitTimer(
                validator_address='1600 Pennsylvania Avenue NW',
                duration=3.14159,
                previous_certificate_id='Bond.  James Bond.',
                local_mean=2.71828)

    

def test_deserialized_wait_timer(benchmark):
    @benchmark
    def do_deserialized_wait_timer():
        wait_timer = \
            EnclaveWaitTimer(
                validator_address='1600 Pennsylvania Avenue NW',
                duration=3.14159,
                previous_certificate_id='Bond.  James Bond.',
                local_mean=2.71828)

        serialized = wait_timer.serialize()
        private_key = _create_random_key()
        wait_timer.signature = \
            create_context('secp256k1').sign(serialized.encode(), private_key)

        copy_wait_timer = \
            EnclaveWaitTimer.wait_timer_from_serialized(
                serialized,
                wait_timer.signature)

    