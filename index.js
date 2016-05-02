'use strict';

var azure = require('azure-storage');
var debug = require('debug')('App:Index');
var fs = require('fs');
var path = require('path');
var _ = require('lodash');

const storageAccountName = '***REMOVED***';
const storageAccountKey = '***REMOVED***'

const blobService = azure.createBlobService(storageAccountName, storageAccountKey);

blobService.listContainersSegmented(null, {}, function (error, result) {

    if (error) {
        debug('Get Containers Error: ', error);
        return;
    }

    var processBatch = function (containerName, continuationToken) {

        return new Promise(function (resolve, reject) {

            var storeDirectory = `../AzureContainers/${storageAccountName}/${containerName}/`;

            fs.readdir(storeDirectory, function (err, files) {
                if (err) {
                    if (err.code === 'ENOENT') {
                        debug(`Container ${containerName} does not exist locally, will not sync this container, create the folder if you want to sync it.`);
                    } else {
                        debug('Unable to load local container ${containerName} directory', err);
                    }
                    resolve();
                    return;
                }
                debug(`Container ${containerName} found, it contains ${files.length} files, and will now sync...`);

                blobService.listBlobsSegmented(containerName, continuationToken, {maxResults: 5000}, function (error, result) {

                    if (error) {
                        debug(`Get Blobs Error (${containerName}):`, error);
                        reject();
                        return;
                    }

                    let queue = Promise.resolve();

                    // debug(`Blobs in ${containerResult.name}`, result.entries);

                    debug(`Found the first ${result.entries.length} items in container ${containerName}`);

                    _.forEach(result.entries, function (blobResult) {
                        //debug(`Examining ${blobResult.name} (${blobResult.properties['content-type']} ${blobResult.properties['content-length']} bytes)`);

                        var localFilePath = `${storeDirectory}${blobResult.name}`;

                        queue = queue.then(() => {
                            return new Promise((downloadFinished, downloadFailed) => {
                                fs.access(localFilePath, fs.F_OK, function (err, stats) {
                                    if (err) {
                                        if (err.code === 'ENOENT') {
                                            debug(`${blobResult.name} > ${localFilePath} - TODO`);

                                            blobService.getBlobToStream(containerName, blobResult.name, fs.createWriteStream(localFilePath), {}, function (error, result, response) {
                                                if (error) {
                                                    debug(`${blobResult.name} > ${localFilePath} - FAILED`, err);
                                                    downloadFinished();
                                                    return;
                                                }
                                                debug(`${blobResult.name} > ${localFilePath} - COMPLETE - SUCCESS = ${response.isSuccessful}`);
                                                downloadFinished();
                                            });

                                        } else {
                                            debug(`${blobResult.name} > ${localFilePath} - ERROR: `, err);
                                            downloadFinished();
                                        }
                                        return;
                                    }

                                    debug(`${blobResult.name} > ${localFilePath} - EXISTS `);
                                    downloadFinished();
                                });
                            });
                        });


                    });

                    resolve({
                        continuationToken: result.continuationToken,
                        queue: queue
                    });
                    if (result.continuationToken) {
                        debug(`There are additional results still to load for container ${containerName}.`)
                    }
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


        batchQueue = batchQueue.then(() => {

            var continuationToken = null;
            var hasRun = false;

            debug(`Starting ${containerResult.name}`);

            return processBatch(containerResult.name, continuationToken)
                .then(function (batchResults) {
                    if (!batchResults) {
                        debug(`Finished ${containerResult.name}, but no results...`);
                        return Promise.resolve();
                    }
                    debug(`Finished ${containerResult.name}`);
                    hasRun = true;
                    continuationToken = batchResults.nextContinuationToken;

                    batchResults.queue = batchResults.queue.then(() => {
                        if (continuationToken) {
                            debug('Preparing second batch.');
                            processBatch(containerResult.name, continuationToken)
                                .then(function (nextContinuationToken) {
                                    hasRun = true;
                                    continuationToken = nextContinuationToken;
                                    debug('Preparing another batch.');

                                    if (continuationToken) {

                                    }
                                });
                        }
                    });

                    return batchResults.queue;

                })
                .catch(() => {
                    debug(`Failed ${containerResult.name}`);
                    return Promise.resolve();
                });
        });

        debug(`Queued up ${containerResult.name}`);

    });


    batchQueue.then(() => {
        debug('All finished.');
    });
});