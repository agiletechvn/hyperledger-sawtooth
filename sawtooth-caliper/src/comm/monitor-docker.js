/**
 * Copyright 2017 HUAWEI. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 * @file, definition of the MonitorDocker class
 *        which is used to watch the resource consumption of specific local docker containers
 */

"use strict";

// todo: now we record the performance information in local variable, should use db later

var MonitorInterface = require("./monitor-interface");
class MonitorDocker extends MonitorInterface {
    constructor(filter, interval) {
        super(filter, interval);
        this.si = require("../../lib/systeminformation");
        this.Docker = require("dockerode");
        this.containers = []; // {id, name, obj}
        this.isReading = false;
        this.intervalObj = null;
        this.stats = { time: [] };
        this.hasContainters = findContainers.call(this);
        /* this.stats : record statistics of each container
            {
                'time' : [] // time slot
                'container_id" : {              // refer to https://www.npmjs.com/package/systeminformatioin
                    'mem_usage'   : [],
                    'mem_percent' : [],
                    'cpu_percent' : [],
                    'netIO_rx'    : [],
                    'netIO_tx'    : [],
                    'blockIO_rx'  : [],
                    'blockIO_wx'  : []
                }
                next container
                .....
            }
        */
    }

    start() {
        return this.hasContainters
            .then(() => {
                var self = this;
                function readContainerStats() {
                    if (self.isReading) {
                        return;
                    }
                    self.isReading = true;
                    var statPromises = [];
                    for (let i = 0; i < self.containers.length; i++) {
                        if (self.containers[i].remote === null) {
                            // local
                            statPromises.push(
                                self.si.dockerContainerStats(
                                    self.containers[i].id
                                )
                            );
                        } else {
                            // remote
                            statPromises.push(
                                self.containers[i].remote.stats({
                                    stream: false
                                })
                            );
                        }
                    }
                    Promise.all(statPromises)
                        .then(results => {
                            self.stats.time.push(Date.now() / 1000);
                            for (let i = 0; i < results.length; i++) {
                                let stat = results[i];
                                let id = stat.id;
                                if (id !== self.containers[i].id) {
                                    console.log(
                                        "monitor-docker: inconsistent id"
                                    );
                                    continue;
                                }
                                if (self.containers[i].remote === null) {
                                    // local
                                    self.stats[id].mem_usage.push(
                                        stat.mem_usage
                                    );
                                    self.stats[id].mem_percent.push(
                                        stat.mem_percent
                                    );
                                    self.stats[id].cpu_percent.push(
                                        stat.cpu_percent
                                    );
                                    self.stats[id].netIO_rx.push(stat.netIO.rx);
                                    self.stats[id].netIO_tx.push(stat.netIO.tx);
                                    self.stats[id].blockIO_rx.push(
                                        stat.blockIO.r
                                    );
                                    self.stats[id].blockIO_wx.push(
                                        stat.blockIO.w
                                    );
                                } else {
                                    // remote
                                    self.stats[id].mem_usage.push(
                                        stat.memory_stats.usage
                                    );
                                    self.stats[id].mem_percent.push(
                                        stat.memory_stats.usage /
                                            stat.memory_stats.limit
                                    );
                                    //self.stats[id].cpu_percent.push((stat.cpu_stats.cpu_usage.total_usage - stat.precpu_stats.cpu_usage.total_usage) / (stat.cpu_stats.system_cpu_usage - stat.precpu_stats.system_cpu_usage) * 100);
                                    let cpuDelta =
                                        stat.cpu_stats.cpu_usage.total_usage -
                                        stat.precpu_stats.cpu_usage.total_usage;
                                    let sysDelta =
                                        stat.cpu_stats.system_cpu_usage -
                                        stat.precpu_stats.system_cpu_usage;
                                    if (cpuDelta > 0 && sysDelta > 0) {
                                        if (
                                            stat.cpu_stats.cpu_usage.hasOwnProperty(
                                                "percpu_usage"
                                            ) &&
                                            stat.cpu_stats.cpu_usage
                                                .percpu_usage != null
                                        ) {
                                            self.stats[id].cpu_percent.push(
                                                cpuDelta /
                                                    sysDelta *
                                                    stat.cpu_stats.cpu_usage
                                                        .percpu_usage.length *
                                                    100.0
                                            );
                                        } else {
                                            self.stats[id].cpu_percent.push(
                                                cpuDelta / sysDelta * 100.0
                                            );
                                        }
                                    } else {
                                        self.stats[id].cpu_percent.push(0);
                                    }
                                    let ioRx = 0,
                                        ioTx = 0;
                                    for (let eth in stat.networks) {
                                        ioRx += stat.networks[eth].rx_bytes;
                                        ioTx += stat.networks[eth].tx_bytes;
                                    }
                                    self.stats[id].netIO_rx.push(ioRx);
                                    self.stats[id].netIO_tx.push(ioTx);
                                    self.stats[id].blockIO_rx.push(0);
                                    self.stats[id].blockIO_wx.push(0);
                                }
                            }
                            self.isReading = false;
                        })
                        .catch(err => {
                            self.isReading = false;
                        });
                }

                readContainerStats(); // read stats  immediately
                this.intervalObj = setInterval(
                    readContainerStats,
                    this.interval
                );
                return Promise.resolve();
            })
            .catch(err => {
                return Promise.reject(err);
            });
    }

    restart() {
        clearInterval(this.intervalObj);
        for (let key in this.stats) {
            if (key === "time") {
                this.stats[key] = [];
            } else {
                for (let v in this.stats[key]) {
                    this.stats[key][v] = [];
                }
            }
        }

        return this.start();
    }

    stop() {
        clearInterval(this.intervalObj);
        this.containers = [];
        this.stats = { time: [] };

        return sleep(100);
    }

    getPeers() {
        var info = [];
        for (let i in this.containers) {
            let c = this.containers[i];
            if (c.hasOwnProperty("id")) {
                info.push({
                    key: c.id,
                    info: {
                        TYPE: "Docker",
                        NAME: c.name
                    }
                });
            }
        }
        return info;
    }

    getMemHistory(key) {
        return this.stats[key].mem_usage;
    }

    getCpuHistory(key) {
        return this.stats[key].cpu_percent;
    }

    getNetworkHistory(key) {
        return { in: this.stats[key].netIO_rx, out: this.stats[key].netIO_tx };
    }
}
module.exports = MonitorDocker;

/**
 * Find local containers according to searching filters
 */
function findContainers() {
    var filterName = { local: [], remote: {} };
    var url = require("url");
    if (this.filter.hasOwnProperty("name")) {
        for (let key in this.filter.name) {
            let name = this.filter.name[key];
            if (name.indexOf("http://") === 0) {
                let remote = url.parse(name, true);
                if (
                    remote.hostname === null ||
                    remote.port === null ||
                    remote.pathname === "/"
                ) {
                    console.log("monitor-docker: unrecognized host, " + name);
                } else if (filterName.remote.hasOwnProperty(remote.hostname)) {
                    filterName.remote[remote.hostname].containers.push(
                        remote.pathname
                    );
                } else {
                    filterName.remote[remote.hostname] = {
                        port: remote.port,
                        containers: [remote.pathname]
                    };
                }
            } else {
                filterName.local.push(name);
            }
        }
    }

    var promises = [];

    // find local containers by name
    if (filterName.local.length > 0) {
        let p = this.si
            .dockerContainers("active")
            .then(containers => {
                let size = containers.length;
                if (size === 0) {
                    console.log(
                        "monitor-docker: could not find active local container"
                    );
                    return Promise.resolve();
                }

                if (filterName.local.indexOf("all") != -1) {
                    for (let i = 0; i < size; i++) {
                        this.containers.push({
                            id: containers[i].id,
                            name: containers[i].name,
                            remote: null
                        });
                        this.stats[containers[i].id] = newContainerStat();
                    }
                } else {
                    const filterRegLocal = filterName.local.map(filter =>
                        RegExp(filter)
                    );
                    for (let container of containers) {
                        const test = filterRegLocal.some(filter =>
                            filter.test(container.name)
                        );
                        if (test) {
                            this.containers.push({
                                id: container.id,
                                name: container.name,
                                remote: null
                            });
                            this.stats[container.id] = newContainerStat();
                        }
                    }
                }

                return Promise.resolve();
            })
            .catch(err => {
                console.log("Error(monitor-docker):" + err);
                return Promise.resolve();
            });
        promises.push(p);
    }
    // find remote containers by name
    for (let h in filterName.remote) {
        let docker = new this.Docker({
            host: h,
            port: filterName.remote[h].port
            // version: 'v1.20'
        });
        let p = docker
            .listContainers()
            .then(containers => {
                let size = containers.length;
                if (size === 0) {
                    console.log(
                        "monitor-docker: could not find remote container at " +
                            h
                    );
                    return Promise.resolve();
                }

                if (filterName.remote[h].containers.indexOf("all") != -1) {
                    for (let i = 0; i < size; i++) {
                        let container = docker.getContainer(containers[i].Id);
                        this.containers.push({
                            id: containers[i].Id,
                            name: h + containers[i].Names[0],
                            remote: container
                        });
                        this.stats[containers[i].Id] = newContainerStat();
                    }
                } else {
                    for (let i = 0; i < size; i++) {
                        if (
                            filterName.remote[h].containers.indexOf(
                                containers[i].Names[0]
                            ) != -1
                        ) {
                            let container = docker.getContainer(
                                containers[i].Id
                            );
                            this.containers.push({
                                id: containers[i].Id,
                                name: h + containers[i].Names[0],
                                remote: container
                            });
                            this.stats[containers[i].Id] = newContainerStat();
                        }
                    }
                }
                return Promise.resolve();
            })
            .catch(err => {
                console.log("Error(monitor-docker):" + err);
                return Promise.resolve();
            });
        promises.push(p);
    }

    return Promise.all(promises);
}

function newContainerStat() {
    return {
        mem_usage: [],
        mem_percent: [],
        cpu_percent: [],
        netIO_rx: [],
        netIO_tx: [],
        blockIO_rx: [],
        blockIO_wx: []
    };
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
