'use strict';

const azure = require('azure-storage');
const debug = require('debug')('Controller');
const debugFile = require('debug')('RemoteFile');
const debugDirectory = require('debug')('Directory');
const debugLocalFile = require('debug')('LocalFile');
const fs = require('fs');
const path = require('path');
const _ = require('lodash');

async function getConfig() {
    const configFileName = 'config.json';
    if (!fs.existsSync(configFileName)) {
        throw new Error(`The config file '${configFileName}' was not found.`);
    }

    const file = fs.readFileSync(configFileName);
    const config = JSON.parse(file);

    if (!config || !config.storageAccountName || !config.storageAccountKey) {
        throw new Error(`The config file '${configFileName}' has missing data.`);
    }

    return config;
}

function beginSync(config) {
    const blobService = azure.createBlobService(config.storageAccountName, config.storageAccountKey);

    blobService.listContainersSegmented(null, {}, function (error, result) {

        if (error) {
            debug('Get Containers Error: ', error);
            return;
        }

        var processBatch = function (containerName, continuationToken = null) {

            return new Promise(function (resolve, reject) {

                const storeDirectory = `${config.storeDirectory}${config.storageAccountName}/${containerName}/`;

                fs.lstat(storeDirectory, (err, storeDirectoryStats) => {

                    if (err) {
                        if (err.code === 'ENOENT') {
                            debug(`Container ${containerName} does not exist locally, will not sync this container, create the folder if you want to sync it.`);
                        } else {
                            debug('Unable to load local container ${containerName} directory', err);
                        }
                        resolve();
                        return;
                    }

                    fs.readdir(storeDirectory, (err, files) => {

                        debug(`${storeDirectoryStats.isSymbolicLink() ? 'Symbolic ' : ''}Container ${containerName} found, it contains ${files.length} files, and will now sync...`);

                        blobService.listBlobsSegmented(containerName, continuationToken, {maxResults: 5000}, (error, result) => {

                            if (error) {
                                debug(`Get Blobs Error (${containerName}):`, error);
                                reject();
                                return;
                            }

                            let queue = Promise.resolve();

                            const resolution = {
                                continuationToken: result.continuationToken,
                                queue: queue,
                                localCopiesAlreadyExisted: 0,
                                containerName
                            };

                            // debug(`Blobs in ${containerResult.name}`, result.entries);

                            debugDirectory(`Found the first ${result.entries.length} items in container ${containerName}`);

                            _.forEach(result.entries, function (blobResult) {
                                //debug(`Examining ${blobResult.name} (${blobResult.properties['content-type']} ${blobResult.properties['content-length']} bytes)`);

                                var localFilePath = `${storeDirectory}${blobResult.name}`;

                                queue = queue.then(() => {
                                    return new Promise((downloadFinished, downloadFailed) => {
                                        fs.access(localFilePath, fs.F_OK, function (err, stats) {
                                            if (err) {
                                                if (err.code === 'ENOENT') {
                                                    debugFile(`${blobResult.name} > ${localFilePath} - TODO`);

                                                    blobService.getBlobToStream(containerName, blobResult.name, fs.createWriteStream(localFilePath), {}, function (error, result, response) {
                                                        if (error) {
                                                            debugFile(`${blobResult.name} > ${localFilePath} - FAILED`, err);
                                                            downloadFinished();
                                                            return;
                                                        }
                                                        debugFile(`${blobResult.name} > ${localFilePath} - COMPLETE - SUCCESS = ${response.isSuccessful}`);
                                                        downloadFinished();
                                                    });

                                                } else {
                                                    debugFile(`${blobResult.name} > ${localFilePath} - ERROR: `, err);
                                                    downloadFinished();
                                                }
                                                return;
                                            }

                                            if (!config.logDownloadsOnly) {
                                                debugLocalFile(`${blobResult.name} > ${localFilePath} - EXISTS `);
                                            }
                                            resolution.localCopiesAlreadyExisted += 1;

                                            downloadFinished();
                                        });
                                    });
                                });

                            });

                            queue = queue.then(() => {
                                if (resolution.localCopiesAlreadyExisted > 0) {
                                    debugDirectory(`${resolution.localCopiesAlreadyExisted} local files already existed.`);
                                }
                                return Promise.resolve();
                            });

                            if (result.continuationToken) {
                                debugDirectory(`There are additional results still to load for container ${containerName}.`)
                            }

                            resolve(resolution);

                        });
                    });

                });

            });


        };

        var batchQueue = Promise.resolve();

        _.forEach(result.entries, function (containerResult) {
            if (containerResult.name === '$root') {
                debug('Skipping root container.');
                return;
            }


            const processBatchQueueItem = (containerName, continuationToken = null) => {

                return processBatch(containerName, continuationToken)
                    .then(function (batchResults) {
                        if (!batchResults) {
                            debugDirectory(`Finished ${batchResults.containerName}, but no results...`);
                            return Promise.resolve();
                        }
                        if (batchResults.continuationToken) {
                            debugDirectory(`Staring next batch for ${batchResults.containerName}`);
                            return processBatchQueueItem(containerName, batchResults.continuationToken);
                        } else {
                            debugDirectory(`Finished ${batchResults.containerName}`);
                            return Promise.resolve();
                        }
                    })
            };

            batchQueue = batchQueue.then(() => {

                debugDirectory(`Starting ${containerResult.name}`);

                return processBatchQueueItem(containerResult.name)
                    .catch(() => {
                        debugDirectory(`Failed ${containerResult.name}`);
                        return Promise.resolve();
                    });
            });

            debug(`Queued up ${containerResult.name}`);

        });


        batchQueue.then(() => {
            debug('All finished.');
        });
    });
}

(async function() {
    try {
        const config = await getConfig();
        beginSync(config);
    } catch (e) {
        debug(e);
    }
})();
